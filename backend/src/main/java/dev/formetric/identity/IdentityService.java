package dev.formetric.identity;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Locale;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class IdentityService {

    private final UserAccountRepository accounts;
    private final UserProfileRepository profiles;
    private final UserInviteRepository invites;
    private final PasswordEncoder passwordEncoder;
    private final PasswordComputationGate passwordComputationGate;
    private final LoginAccountSnapshots loginAccountSnapshots;
    private final InviteAcceptanceTransactions inviteAcceptanceTransactions;
    private final String dummyPasswordHash;
    private final InviteTokenGenerator tokenGenerator;
    private final Clock clock;

    IdentityService(
            UserAccountRepository accounts,
            UserProfileRepository profiles,
            UserInviteRepository invites,
            PasswordEncoder passwordEncoder,
            PasswordComputationGate passwordComputationGate,
            LoginAccountSnapshots loginAccountSnapshots,
            InviteAcceptanceTransactions inviteAcceptanceTransactions,
            InviteTokenGenerator tokenGenerator,
            Clock clock) {
        this.accounts = accounts;
        this.profiles = profiles;
        this.invites = invites;
        this.passwordEncoder = passwordEncoder;
        this.passwordComputationGate = passwordComputationGate;
        this.loginAccountSnapshots = loginAccountSnapshots;
        this.inviteAcceptanceTransactions = inviteAcceptanceTransactions;
        this.dummyPasswordHash = passwordEncoder.encode("formetric-login-timing-sentinel-" + UUID.randomUUID());
        this.tokenGenerator = tokenGenerator;
        this.clock = clock;
    }

    AuthenticatedUser authenticate(String email, String password) {
        String normalizedEmail = IdentitySupport.normalizeEmail(email);
        LoginCredentialSnapshot credential = loginAccountSnapshots.credentialFor(normalizedEmail).orElse(null);
        String passwordHash = credential == null ? dummyPasswordHash : credential.passwordHash();
        boolean passwordMatches = passwordComputationGate.compute(
                () -> passwordEncoder.matches(password, passwordHash));

        if (credential == null || credential.status() != AccountStatus.ACTIVE || !passwordMatches) {
            throw new InvalidCredentialsException();
        }

        CurrentLoginSnapshot current = loginAccountSnapshots.currentFor(credential.id()).orElse(null);
        if (current == null
                || current.status() != AccountStatus.ACTIVE
                || !current.email().equals(credential.email())
                || !current.passwordHash().equals(credential.passwordHash())) {
            throw new InvalidCredentialsException();
        }
        return current.authenticatedUser();
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

    AuthenticatedUser acceptInvite(String token, String displayName, String password) {
        String normalizedDisplayName = normalizeDisplayName(displayName);
        String tokenHash = IdentitySupport.hashToken(token);
        InviteAcceptanceCandidate candidate = inviteAcceptanceTransactions.candidateFor(tokenHash)
                .orElseThrow(() -> new InvalidInviteException("Convite inválido."));
        candidate.requireUsable(clock.instant());
        String passwordHash = passwordComputationGate.compute(() -> passwordEncoder.encode(password));
        return inviteAcceptanceTransactions.complete(
                tokenHash, normalizedDisplayName, passwordHash, clock.instant());
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

    private static String normalizeDisplayName(String value) {
        String normalized = value == null ? "" : value.strip();
        if (normalized.length() < 2 || normalized.length() > 100) {
            throw new InvalidProfileException(
                    "displayName", "O nome deve possuir entre 2 e 100 caracteres sem espaços externos.");
        }
        return normalized;
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
