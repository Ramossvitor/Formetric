package dev.formetric.identity;

import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletRequestWrapper;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Resolves the unforwarded transport peer used to scope login throttling.
 *
 * <p>The application currently has no provisioned, verifiable trusted-proxy chain. Therefore this
 * resolver deliberately unwraps framework request decorators and ignores {@code Forwarded} and
 * {@code X-Forwarded-For}. Behind Cloud Run this key can represent the platform proxy rather than
 * the end user; the global login bucket remains the fail-safe until an edge topology is explicitly
 * provisioned and tested.</p>
 */
@Component
class LoginRequestOriginResolver {

    private static final int MAX_WRAPPER_DEPTH = 32;
    private static final int MAX_PEER_LENGTH = 64;
    private static final String UNKNOWN_TRANSPORT_PEER = "transport-peer:unknown";

    private final Strategy strategy;

    LoginRequestOriginResolver(
            @Value("${formetric.security.login-origin.strategy:TRANSPORT_PEER}") Strategy strategy) {
        this.strategy = strategy;
    }

    String resolve(HttpServletRequest request) {
        return switch (strategy) {
            case TRANSPORT_PEER -> transportPeer(request);
        };
    }

    private static String transportPeer(HttpServletRequest request) {
        ServletRequest candidate = request;
        int depth = 0;
        while (candidate instanceof ServletRequestWrapper wrapper && depth++ < MAX_WRAPPER_DEPTH) {
            ServletRequest nested = wrapper.getRequest();
            if (nested == candidate) {
                return UNKNOWN_TRANSPORT_PEER;
            }
            candidate = nested;
        }
        if (candidate instanceof ServletRequestWrapper) {
            return UNKNOWN_TRANSPORT_PEER;
        }
        if (!(candidate instanceof HttpServletRequest transportRequest)) {
            return UNKNOWN_TRANSPORT_PEER;
        }

        String peer = transportRequest.getRemoteAddr();
        if (peer == null) {
            return UNKNOWN_TRANSPORT_PEER;
        }
        String normalized = peer.strip().toLowerCase(Locale.ROOT);
        if (normalized.isBlank() || normalized.length() > MAX_PEER_LENGTH) {
            return UNKNOWN_TRANSPORT_PEER;
        }
        return "transport-peer:" + normalized;
    }

    enum Strategy {
        /** Uses only the connection peer supplied by the servlet container; forwarded headers are ignored. */
        TRANSPORT_PEER
    }
}
