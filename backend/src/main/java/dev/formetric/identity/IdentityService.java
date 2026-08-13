package dev.formetric.identity;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Locale;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class IdentityService {

    private final UserAccountRepository accounts;
    private final UserProfileRepository profiles;
    private final UserInviteRepository invites;
    private final PasswordEncoder passwordEncoder;
    private final String dummyPasswordHash;
    private final InviteTokenGenerator tokenGenerator;
    private final Clock clock;

    IdentityService(
            UserAccountRepository accounts,
            UserProfileRepository profiles,
            UserInviteRepository invites,
            PasswordEncoder passwordEncoder,
            InviteTokenGenerator tokenGenerator,
            Clock clock) {
        this.accounts = accounts;
        this.profiles = profiles;
        this.invites = invites;
        this.passwordEncoder = passwordEncoder;
        this.dummyPasswordHash = passwordEncoder.encode("formetric-login-timing-sentinel-" + UUID.randomUUID());
        this.tokenGenerator = tokenGenerator;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    AuthenticatedUser authenticate(String email, String password) {
        String normalizedEmail = IdentitySupport.normalizeEmail(email);
        UserAccount account = accounts.findByEmail(normalizedEmail).orElse(null);
        if (account == null) {
            passwordEncoder.matches(password, dummyPasswordHash);
            throw new InvalidCredentialsException();
        }
        if (account.status() != AccountStatus.ACTIVE || !passwordEncoder.matches(password, account.passwordHash())) {
            throw new InvalidCredentialsException();
        }
        UserProfile profile = profiles.findById(account.id())
                .orElseThrow(() -> new IllegalStateException("Active account has no profile"));
        return authenticatedUser(account, profile);
    }

    @Transactional
    CreatedInvite createInvite(UUID creatorId, CreateInviteCommand command) {
        String email = IdentitySupport.normalizeEmail(command.email());
        if (accounts.existsByEmail(email)) {
            throw new IdentityConflictException("Já existe uma conta para este e-mail.");
        }
        Instant now = clock.instant();
        String token = tokenGenerator.generate();
        UserInvite invite = UserInvite.create(
                email,
                command.role(),
                IdentitySupport.hashToken(token),
                now.plus(command.validFor()),
                creatorId,
                now);
        invites.save(invite);
        return new CreatedInvite(invite.id(), invite.email(), invite.role(), invite.expiresAt(), token);
    }

    @Transactional
    AuthenticatedUser acceptInvite(String token, String displayName, String password) {
        Instant now = clock.instant();
        UserInvite invite = invites.findByTokenHashForUpdate(IdentitySupport.hashToken(token))
                .orElseThrow(() -> new InvalidInviteException("Convite inválido."));
        if (invite.isAccepted()) {
            throw new InvalidInviteException("Este convite já foi utilizado.");
        }
        if (invite.isExpired(now)) {
            throw new InvalidInviteException("Este convite expirou.");
        }
        if (accounts.existsByEmail(invite.email())) {
            throw new IdentityConflictException("Já existe uma conta para este e-mail.");
        }

        UserAccount account = UserAccount.create(invite.email(), passwordEncoder.encode(password), invite.role(), now);
        UserProfile profile = UserProfile.defaults(account.id(), displayName.strip(), now);
        try {
            accounts.saveAndFlush(account);
            profiles.save(profile);
            invite.accept(account.id(), now);
        } catch (DataIntegrityViolationException exception) {
            throw new IdentityConflictException("Não foi possível criar a conta para este convite.");
        }
        return authenticatedUser(account, profile);
    }

    @Transactional(readOnly = true)
    ProfileView profile(UUID userId) {
        UserAccount account = accounts.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Conta não encontrada."));
        UserProfile profile = profiles.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Perfil não encontrado."));
        return ProfileView.from(account, profile);
    }

    @Transactional
    ProfileView updateProfile(UUID userId, UpdateProfileCommand command) {
        validateLocale(command.locale());
        validateTimeZone(command.timeZone());
        UserAccount account = accounts.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Conta não encontrada."));
        UserProfile profile = profiles.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Perfil não encontrado."));
        profile.update(
                command.displayName().strip(),
                command.locale(),
                command.timeZone(),
                command.unitSystem(),
                command.birthDate(),
                command.formulaSex(),
                clock.instant());
        return ProfileView.from(account, profile);
    }

    @Transactional
    AuthenticatedUser bootstrapOwner(String email, String password, String displayName) {
        String normalizedEmail = IdentitySupport.normalizeEmail(email);
        return accounts.findByEmail(normalizedEmail).map(account -> {
            if (account.role() != UserRole.OWNER) {
                throw new IllegalStateException("Bootstrap e-mail already belongs to a non-owner account");
            }
            UserProfile profile = profiles.findById(account.id())
                    .orElseThrow(() -> new IllegalStateException("Bootstrap account has no profile"));
            return authenticatedUser(account, profile);
        }).orElseGet(() -> accounts.findFirstByRole(UserRole.OWNER).map(existingOwner -> {
            UserProfile profile = profiles.findById(existingOwner.id())
                    .orElseThrow(() -> new IllegalStateException("Existing owner has no profile"));
            return authenticatedUser(existingOwner, profile);
        }).orElseGet(() -> {
            Instant now = clock.instant();
            UserAccount account = UserAccount.create(normalizedEmail, passwordEncoder.encode(password), UserRole.OWNER, now);
            UserProfile profile = UserProfile.defaults(account.id(), displayName.strip(), now);
            accounts.save(account);
            profiles.save(profile);
            return authenticatedUser(account, profile);
        }));
    }

    private static AuthenticatedUser authenticatedUser(UserAccount account, UserProfile profile) {
        return new AuthenticatedUser(account.id(), account.email(), profile.displayName(), account.role());
    }

    private static void validateLocale(String value) {
        Locale locale = Locale.forLanguageTag(value);
        if (locale.getLanguage().isBlank() || !locale.toLanguageTag().equalsIgnoreCase(value)) {
            throw new InvalidProfileException("locale", "Informe um locale BCP 47 válido.");
        }
    }

    private static void validateTimeZone(String value) {
        try {
            ZoneId.of(value);
        } catch (RuntimeException exception) {
            throw new InvalidProfileException("timeZone", "Informe um fuso horário IANA válido.");
        }
    }

    record CreateInviteCommand(String email, UserRole role, Duration validFor) {
    }

    record CreatedInvite(UUID id, String email, UserRole role, Instant expiresAt, String token) {
    }

    record UpdateProfileCommand(
            String displayName,
            String locale,
            String timeZone,
            UnitSystem unitSystem,
            java.time.LocalDate birthDate,
            FormulaSex formulaSex) {
    }

    record ProfileView(
            UUID id,
            String email,
            String displayName,
            String locale,
            String timeZone,
            UnitSystem unitSystem,
            java.time.LocalDate birthDate,
            FormulaSex formulaSex,
            UserRole role) {
        static ProfileView from(UserAccount account, UserProfile profile) {
            return new ProfileView(
                    account.id(),
                    account.email(),
                    profile.displayName(),
                    profile.locale(),
                    profile.timeZone(),
                    profile.unitSystem(),
                    profile.birthDate(),
                    profile.formulaSex(),
                    account.role());
        }
    }
}

class InvalidCredentialsException extends RuntimeException {
    InvalidCredentialsException() {
        super("E-mail ou senha inválidos.");
    }
}

class InvalidProfileException extends RuntimeException {
    private final String field;

    InvalidProfileException(String field, String message) {
        super(message);
        this.field = field;
    }

    String field() {
        return field;
    }
}
