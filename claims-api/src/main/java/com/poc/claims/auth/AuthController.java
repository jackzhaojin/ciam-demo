package com.poc.claims.auth;

import com.poc.claims.auth.dto.PkceCallbackRequest;
import com.poc.claims.auth.dto.PkceCallbackResponse;
import com.poc.claims.auth.strategy.TokenValidationStrategy;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /**
     * Exchange an authorization code + PKCE verifier for tokens,
     * then validate using the selected strategy.
     */
    @PostMapping("/pkce-callback")
    public ResponseEntity<PkceCallbackResponse> pkceCallback(@Valid @RequestBody PkceCallbackRequest request) {
        PkceCallbackResponse response = authService.exchangeAndValidate(
            request.getAuthorizationCode(),
            request.getCodeVerifier(),
            request.getRedirectUri(),
            request.getStrategy()
        );
        return ResponseEntity.ok(response);
    }

    /**
     * Returns the list of available validation strategies.
     */
    @GetMapping("/strategies")
    public ResponseEntity<List<Map<String, Object>>> getStrategies() {
        List<Map<String, Object>> list = new ArrayList<>();
        for (TokenValidationStrategy strategy : authService.getStrategies().values()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("key", strategy.getKey());
            item.put("label", strategy.getLabel());
            item.put("offline", strategy.getKey().startsWith("jwks"));
            list.add(item);
        }
        return ResponseEntity.ok(list);
    }

    /**
     * Returns public config needed by the frontend for PKCE flow.
     */
    @GetMapping("/config")
    public ResponseEntity<Map<String, String>> getConfig() {
        Map<String, String> config = new LinkedHashMap<>();
        config.put("issuerUri", authService.getIssuerUri());
        config.put("clientId", authService.getFrontendClientId());
        return ResponseEntity.ok(config);
    }
}
