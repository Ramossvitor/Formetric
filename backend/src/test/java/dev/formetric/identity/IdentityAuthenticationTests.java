package dev.formetric.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class IdentityAuthenticationTests {

    private static final UUID ACCOUNT_ID = UUID.fromString("7eb297b4-b76a-426b-a77d-d2a75a3b04bb");
    private static final String EMAIL = "person@example.com";
    private static final String PASSWORD = "valid-password";
    private static final String PASSWORD_HASH = "current-password-hash";
    private static final Instant NOW = Instant.parse("2026-08-20T12:00:00Z");

    private final UserAccountRepository accounts = mock(UserAccountRepository.class);
    private final UserProfileRepository profiles = mock(UserProfileRepository.class);
    private final UserInviteRepository invites = mock(UserInviteRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final LoginAccountSnapshots snapshots = mock(LoginAccountSnapshots.class);
    private final InviteAcceptanceTransactions inviteAcceptanceTransactions = mock(InviteAcceptanceTransactions.class);
    private IdentityService service;

    @BeforeEach
    void setUp() {
        when(passwordEncoder.encode(anyString())).thenReturn("dummy-password-hash");
        service = new IdentityService(
                accounts,
                profiles,
                invites,
                passwordEncoder,
                new PasswordComputationGate(2, java.time.Duration.ZERO),
                snapshots,
                inviteAcceptanceTransactions,
                mock(InviteTokenGenerator.class),
                Clock.fixed(NOW, ZoneOffset.UTC));
        clearInvocations(passwordEncoder, snapshots, inviteAcceptanceTransactions);
    }

    @Test
    void verifiesThePasswordBetweenTwoShortAccountSnapshots() {
        LoginCredentialSnapshot credential = credential();
        CurrentLoginSnapshot current = current(PASSWORD_HASH, AccountStatus.ACTIVE);
        when(snapshots.credentialFor(EMAIL)).thenReturn(Optional.of(credential));
        when(passwordEncoder.matches(PASSWORD, PASSWORD_HASH)).thenReturn(true);
        when(snapshots.currentFor(ACCOUNT_ID)).thenReturn(Optional.of(current));

        AuthenticatedUser authenticated = service.authenticate(EMAIL, PASSWORD);

        assertThat(authenticated).isEqualTo(current.authenticatedUser());
        var order = inOrder(snapshots, passwordEncoder);
        order.verify(snapshots).credentialFor(EMAIL);
        order.verify(passwordEncoder).matches(PASSWORD, PASSWORD_HASH);
        order.verify(snapshots).currentFor(ACCOUNT_ID);
    }

    @Test
    void rejectsAValidPasswordWhenTheAccountChangesBeforeTheFinalSnapshot() {
        when(snapshots.credentialFor(EMAIL)).thenReturn(Optional.of(credential()));
        when(passwordEncoder.matches(PASSWORD, PASSWORD_HASH)).thenReturn(true);
        when(snapshots.currentFor(ACCOUNT_ID))
                .thenReturn(Optional.of(current("changed-password-hash", AccountStatus.ACTIVE)));

        assertThatThrownBy(() -> service.authenticate(EMAIL, PASSWORD))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void performsDummyVerificationForAnUnknownAccountWithoutRequestingAProfileSnapshot() {
        when(snapshots.credentialFor(EMAIL)).thenReturn(Optional.empty());
        when(passwordEncoder.matches(PASSWORD, "dummy-password-hash")).thenReturn(false);

        assertThatThrownBy(() -> service.authenticate(EMAIL, PASSWORD))
                .isInstanceOf(InvalidCredentialsException.class);

        verify(passwordEncoder).matches(PASSWORD, "dummy-password-hash");
        verify(snapshots, never()).currentFor(ACCOUNT_ID);
    }

    @Test
    void hashesAnAcceptedInvitationPasswordBetweenTwoShortTransactions() {
        String token = "valid-invitation-token";
        String tokenHash = IdentitySupport.hashToken(token);
        InviteAcceptanceCandidate candidate = new InviteAcceptanceCandidate(
                EMAIL, UserRole.USER, NOW.plusSeconds(3600), null);
        AuthenticatedUser expected = new AuthenticatedUser(ACCOUNT_ID, EMAIL, "Pessoa Teste", UserRole.USER);
        when(inviteAcceptanceTransactions.candidateFor(tokenHash)).thenReturn(Optional.of(candidate));
        when(passwordEncoder.encode(PASSWORD)).thenReturn(PASSWORD_HASH);
        when(inviteAcceptanceTransactions.complete(
                        eq(tokenHash), eq("Pessoa Teste"), eq(PASSWORD_HASH), eq(NOW)))
                .thenReturn(expected);

        AuthenticatedUser accepted = service.acceptInvite(token, " Pessoa Teste ", PASSWORD);

        assertThat(accepted).isEqualTo(expected);
        var order = inOrder(inviteAcceptanceTransactions, passwordEncoder);
        order.verify(inviteAcceptanceTransactions).candidateFor(tokenHash);
        order.verify(passwordEncoder).encode(PASSWORD);
        order.verify(inviteAcceptanceTransactions)
                .complete(tokenHash, "Pessoa Teste", PASSWORD_HASH, NOW);
    }

    private static LoginCredentialSnapshot credential() {
        return new LoginCredentialSnapshot(ACCOUNT_ID, EMAIL, PASSWORD_HASH, AccountStatus.ACTIVE);
    }

    private static CurrentLoginSnapshot current(String passwordHash, AccountStatus status) {
        return new CurrentLoginSnapshot(
                ACCOUNT_ID,
                EMAIL,
                passwordHash,
                status,
                UserRole.USER,
                "Pessoa Teste");
    }
}
