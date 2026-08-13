package dev.formetric.identity;

import java.io.Serial;
import java.io.Serializable;
import java.security.Principal;
import java.util.UUID;

/** Authenticated identity exposed to the other application modules. */
public record AuthenticatedUser(UUID id, String email, String displayName, UserRole role)
        implements Principal, Serializable {
    @Serial
    private static final long serialVersionUID = 1L;

    @Override
    public String getName() {
        return email;
    }
}
