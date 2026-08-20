package dev.formetric.identity;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.filter.OncePerRequestFilter;

/** Revalidates mutable account state before authorization decisions use a session principal. */
final class AuthenticatedSessionRevalidationFilter extends OncePerRequestFilter {

    private final AuthenticatedSessionIdentityProvider identityProvider;
    private final HttpSessionSecurityContextRepository securityContextRepository =
            new HttpSessionSecurityContextRepository();

    AuthenticatedSessionRevalidationFilter(AuthenticatedSessionIdentityProvider identityProvider) {
        this.identityProvider = identityProvider;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        SecurityContext context = SecurityContextHolder.getContext();
        Authentication authentication = context.getAuthentication();
        HttpSession existingSession = request.getSession(false);
        if (existingSession == null || !isFormetricSession(authentication)) {
            filterChain.doFilter(request, response);
            return;
        }

        AuthenticatedUser currentPrincipal = (AuthenticatedUser) authentication.getPrincipal();
        var currentIdentity = identityProvider.findById(currentPrincipal.id());
        if (currentIdentity.isEmpty() || !currentIdentity.orElseThrow().isActive()) {
            revokeSession(existingSession);
            writeUnauthorized(response);
            return;
        }

        AuthenticatedUser refreshedPrincipal = currentIdentity.orElseThrow().toPrincipal();
        if (!refreshedPrincipal.equals(currentPrincipal)
                || !hasCurrentAuthority(authentication, refreshedPrincipal.role())) {
            var refreshedAuthentication = new UsernamePasswordAuthenticationToken(
                    refreshedPrincipal,
                    null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + refreshedPrincipal.role().name())));
            refreshedAuthentication.setDetails(authentication.getDetails());
            context.setAuthentication(refreshedAuthentication);
            securityContextRepository.saveContext(context, request, response);
        }

        filterChain.doFilter(request, response);
    }

    private static boolean isFormetricSession(Authentication authentication) {
        return authentication != null
                && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken)
                && authentication.getPrincipal() instanceof AuthenticatedUser;
    }

    private static boolean hasCurrentAuthority(Authentication authentication, UserRole role) {
        String expectedAuthority = "ROLE_" + role.name();
        return authentication.getAuthorities().size() == 1
                && authentication.getAuthorities().iterator().next().getAuthority().equals(expectedAuthority);
    }

    private static void revokeSession(HttpSession session) {
        session.invalidate();
        SecurityContextHolder.clearContext();
    }

    private static void writeUnauthorized(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/problem+json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("""
                {"title":"Não autenticado","status":401,"detail":"A sessão não é mais válida."}
                """);
    }
}
