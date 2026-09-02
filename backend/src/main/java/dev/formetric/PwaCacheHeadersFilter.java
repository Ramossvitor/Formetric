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
 * <p>O {@code sw.js} tem nome fixo e é ele quem decide qual versão do aplicativo o usuário recebe.
 * Servido de um cache intermediário, um worker antigo continuaria entregando a versão anterior
 * mesmo depois do deploy — e como o worker também é quem serve a casca, o usuário ficaria preso numa
 * versão antiga sem nenhuma forma de sair. {@code no-cache} (e não {@code no-store}) permite ao
 * navegador revalidar em vez de baixar de novo.
 *
 * <p>O mesmo vale para o manifesto, que carrega o {@code id} e os ícones usados na instalação.
 *
 * <p>Tudo o que não está nesta lista recebe o {@code no-store} padrão do Spring Security — inclusive
 * os arquivos com hash em {@code /assets/**}, que poderiam ficar guardados para sempre. Hoje quem os
 * guarda é o precache do service worker, não o cache HTTP do navegador.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class PwaCacheHeadersFilter extends OncePerRequestFilter {

    private static final Set<String> NEVER_CACHED = Set.of(
            "/sw.js",
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
