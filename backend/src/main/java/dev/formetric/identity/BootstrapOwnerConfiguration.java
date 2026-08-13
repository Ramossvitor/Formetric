package dev.formetric.identity;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
class BootstrapOwnerConfiguration implements ApplicationRunner {

    private static final Logger LOGGER = LoggerFactory.getLogger(BootstrapOwnerConfiguration.class);
    private final IdentityService identityService;
    private final String email;
    private final String password;
    private final String displayName;

    BootstrapOwnerConfiguration(
            IdentityService identityService,
            @Value("${formetric.bootstrap.admin-email:}") String email,
            @Value("${formetric.bootstrap.admin-password:}") String password,
            @Value("${formetric.bootstrap.admin-display-name:Formetric Owner}") String displayName) {
        this.identityService = identityService;
        this.email = email;
        this.password = password;
        this.displayName = displayName;
    }

    @Override
    public void run(ApplicationArguments arguments) {
        boolean hasEmail = !email.isBlank();
        boolean hasPassword = !password.isBlank();
        if (!hasEmail && !hasPassword) {
            return;
        }
        if (!hasEmail || !hasPassword) {
            throw new IllegalStateException(
                    "BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must be configured together");
        }
        if (email.length() > 320 || !email.contains("@")) {
            throw new IllegalStateException("BOOTSTRAP_ADMIN_EMAIL is invalid");
        }
        if (password.length() < 12 || password.length() > 128) {
            throw new IllegalStateException("BOOTSTRAP_ADMIN_PASSWORD must contain between 12 and 128 characters");
        }
        if (displayName.strip().length() < 2 || displayName.strip().length() > 100) {
            throw new IllegalStateException("BOOTSTRAP_ADMIN_DISPLAY_NAME must contain between 2 and 100 characters");
        }
        identityService.bootstrapOwner(email, password, displayName);
        LOGGER.info("Bootstrap owner account is ready");
    }
}
