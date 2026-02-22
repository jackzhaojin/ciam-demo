package com.poc.claims.auth.strategy;

import java.util.Map;

/**
 * Strategy interface for token validation. Implementations must use only
 * JDK 8 APIs + org.json + Nimbus — zero Spring imports.
 */
public interface TokenValidationStrategy {

    /**
     * Validate an access token and return a detailed result including
     * step-by-step logs for the teaching UI.
     *
     * @param accessToken the raw JWT access token string
     * @param issuerUri   the expected issuer URI (e.g., https://host/realms/realm)
     * @param config      strategy-specific configuration (e.g., introspection credentials)
     * @return validation result with steps, claims, and timing
     */
    TokenValidationResult validate(String accessToken, String issuerUri, Map<String, String> config);

    /** Human-readable strategy name (e.g., "JWKS — Vanilla Java") */
    String getLabel();

    /** Machine-readable strategy key (e.g., "jwks-vanilla") */
    String getKey();
}
