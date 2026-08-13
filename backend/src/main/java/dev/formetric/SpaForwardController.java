package dev.formetric;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Supports refreshes on known React Router entry points without swallowing API,
 * actuator, documentation or static-asset requests.
 */
@Controller
class SpaForwardController {

    @GetMapping({"/login", "/accept-invite", "/profile", "/settings", "/settings/**"})
    String forwardKnownClientRoute() {
        return "forward:/index.html";
    }
}
