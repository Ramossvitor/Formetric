package dev.formetric.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

class AuthenticatedSessionRevalidationFilterTests {

    @Test
    void doesNotRevalidateOrPersistAnAuthenticatedPrincipalWithoutAnExistingSession() throws Exception {
        AuthenticatedSessionIdentityProvider identityProvider = mock(AuthenticatedSessionIdentityProvider.class);
        AuthenticatedSessionRevalidationFilter filter = new AuthenticatedSessionRevalidationFilter(identityProvider);
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        AuthenticatedUser principal = new AuthenticatedUser(
                UUID.randomUUID(), "person@example.com", "Pessoa", UserRole.USER);
        var authentication = new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        SecurityContextHolder.getContext().setAuthentication(authentication);

        try {
            filter.doFilter(request, response, new MockFilterChain());
        } finally {
            SecurityContextHolder.clearContext();
        }

        verifyNoInteractions(identityProvider);
        assertThat(request.getSession(false)).isNull();
    }
}
