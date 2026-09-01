package dev.formetric;

import java.io.IOException;
import java.util.Set;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Impede que o service worker e o manifesto sejam servidos de cache.
 *
 * <p>Os arquivos com hash no nome ({@code /assets/**}) podem ser guardados para sempre, porque um
 * conteúdo novo vem com um nome novo. O {@code sw.js} é o oposto: o nome é fixo e é ele quem decide
 * qual versão do aplicativo o usuário recebe. Servido de um cache intermediário, um worker antigo
 * continuaria entregando a versão anterior mesmo depois do deploy — e como o worker também é quem
 * serve a casca, o usuário ficaria preso numa versão antiga sem nenhuma forma de sair.
 *
 * <p>O mesmo vale para o manifesto, que carrega o {@code id} e os ícones usados na instalação.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class PwaCacheHeadersFilter extends OncePerRequestFilter {

    private static final Set<String> NEVER_CACHED = Set.of(
            "/sw.js",
            "/registerSW.js",
            "/manifest.webmanifest",
            "/index.html",
            "/");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (NEVER_CACHED.contains(request.getRequestURI())) {
            response.setHeader("Cache-Control", "no-cache, must-revalidate");
        }
        chain.doFilter(request, response);
    }
}
