package dev.formetric.identity;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
class AuthenticationController {

    private final IdentityService identityService;
    private final CurrentUserProvider currentUserProvider;
    private final LoginAttemptLimiter loginAttemptLimiter;
    private final Clock clock;
    private final HttpSessionSecurityContextRepository securityContextRepository =
            new HttpSessionSecurityContextRepository();

    AuthenticationController(
            IdentityService identityService,
            CurrentUserProvider currentUserProvider,
            LoginAttemptLimiter loginAttemptLimiter,
            Clock clock) {
        this.identityService = identityService;
        this.currentUserProvider = currentUserProvider;
        this.loginAttemptLimiter = loginAttemptLimiter;
        this.clock = clock;
    }

    @GetMapping("/csrf")
    CsrfResponse csrf(CsrfToken csrfToken) {
        return new CsrfResponse(csrfToken.getToken(), csrfToken.getHeaderName());
    }

    @PostMapping("/login")
    SessionResponse login(
            @Valid @RequestBody LoginRequest body,
            HttpServletRequest request,
            HttpServletResponse response) {
        String normalizedEmail = IdentitySupport.normalizeEmail(body.email());
        String rateLimitKey = normalizedEmail + "|" + request.getRemoteAddr();
        Instant now = clock.instant();
        loginAttemptLimiter.checkAllowed(rateLimitKey, now);
        try {
            AuthenticatedUser user = identityService.authenticate(normalizedEmail, body.password());
            loginAttemptLimiter.recordSuccess(rateLimitKey);
            establishSession(user, request, response);
            return SessionResponse.from(user);
        } catch (InvalidCredentialsException exception) {
            loginAttemptLimiter.recordFailure(rateLimitKey, now);
            throw exception;
        }
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
    }

    @GetMapping("/session")
    SessionResponse session() {
        AuthenticatedUser current = currentUserProvider.requireCurrentUser();
        IdentityService.ProfileView profile = identityService.profile(current.id());
        return SessionResponse.from(new AuthenticatedUser(
                profile.id(), profile.email(), profile.displayName(), profile.role()));
    }

    void establishSession(AuthenticatedUser user, HttpServletRequest request, HttpServletResponse response) {
        HttpSession previousSession = request.getSession(false);
        if (previousSession != null) {
            previousSession.invalidate();
        }
        var authentication = new UsernamePasswordAuthenticationToken(
                user,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.role().name())));
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
    }
}

@RestController
@RequestMapping("/api/v1/invites")
class InviteController {

    private final IdentityService identityService;
    private final CurrentUserProvider currentUserProvider;
    private final AuthenticationController authenticationController;

    InviteController(
            IdentityService identityService,
            CurrentUserProvider currentUserProvider,
            AuthenticationController authenticationController) {
        this.identityService = identityService;
        this.currentUserProvider = currentUserProvider;
        this.authenticationController = authenticationController;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    CreatedInviteResponse create(@Valid @RequestBody CreateInviteRequest body) {
        AuthenticatedUser creator = currentUserProvider.requireCurrentUser();
        IdentityService.CreatedInvite invite = identityService.createInvite(
                creator.id(),
                new IdentityService.CreateInviteCommand(
                        body.email(), body.role(), Duration.ofHours(body.expiresInHours())));
        return CreatedInviteResponse.from(invite);
    }

    @PostMapping("/accept")
    @ResponseStatus(HttpStatus.CREATED)
    SessionResponse accept(
            @Valid @RequestBody AcceptInviteRequest body,
            HttpServletRequest request,
            HttpServletResponse response) {
        AuthenticatedUser user = identityService.acceptInvite(body.token(), body.displayName(), body.password());
        authenticationController.establishSession(user, request, response);
        return SessionResponse.from(user);
    }
}

@RestController
@RequestMapping("/api/v1/profile")
class ProfileController {

    private final IdentityService identityService;
    private final CurrentUserProvider currentUserProvider;

    ProfileController(IdentityService identityService, CurrentUserProvider currentUserProvider) {
        this.identityService = identityService;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping
    IdentityService.ProfileView profile() {
        return identityService.profile(currentUserProvider.requireCurrentUser().id());
    }

    @PatchMapping
    IdentityService.ProfileView update(@Valid @RequestBody UpdateProfileRequest body) {
        return identityService.updateProfile(
                currentUserProvider.requireCurrentUser().id(),
                new IdentityService.UpdateProfileCommand(
                        body.displayName(),
                        body.locale(),
                        body.timeZone(),
                        body.unitSystem(),
                        body.birthDate(),
                        body.formulaSex()));
    }
}

record CsrfResponse(String token, String headerName) {
}

record LoginRequest(
        @NotBlank @Size(max = 320) @Pattern(regexp = "^\\s*[^\\s@]+@[^\\s@]+\\s*$") String email,
        @NotBlank @Size(max = 128) String password) {
}

record CreateInviteRequest(
        @NotBlank @Size(max = 320) @Pattern(regexp = "^\\s*[^\\s@]+@[^\\s@]+\\s*$") String email,
        @NotNull UserRole role,
        @Min(1) @Max(720) int expiresInHours) {
}

record AcceptInviteRequest(
        @NotBlank @Size(max = 200) String token,
        @NotBlank @Size(min = 2, max = 100) String displayName,
        @NotBlank @Size(min = 12, max = 128) String password) {
}

record UpdateProfileRequest(
        @NotBlank @Size(min = 2, max = 100) String displayName,
        @NotBlank @Size(max = 35) String locale,
        @NotBlank @Size(max = 63) String timeZone,
        @NotNull UnitSystem unitSystem,
        @PastOrPresent LocalDate birthDate,
        FormulaSex formulaSex) {
}

record SessionResponse(boolean authenticated, AuthenticatedUser user) {
    static SessionResponse from(AuthenticatedUser user) {
        return new SessionResponse(true, user);
    }
}

record CreatedInviteResponse(UUID id, String email, UserRole role, Instant expiresAt, String token) {
    static CreatedInviteResponse from(IdentityService.CreatedInvite invite) {
        return new CreatedInviteResponse(invite.id(), invite.email(), invite.role(), invite.expiresAt(), invite.token());
    }
}
