package com.poc.claims;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

/**
 * Test configuration that provides a mock JWT decoder so that tests
 * don't need a running Keycloak instance. The SecurityMockMvcRequestPostProcessors.jwt()
 * helper bypasses the decoder entirely, but Spring Boot requires a JwtDecoder bean
 * to exist at startup.
 */
@TestConfiguration
public class TestSecurityConfig {

    @Bean
    public JwtDecoder jwtDecoder() {
        // Create a decoder with a dummy key - tests use SecurityMockMvcRequestPostProcessors.jwt()
        // which bypasses the decoder. This bean exists only to satisfy Spring Boot auto-configuration.
        byte[] key = new byte[32];
        SecretKey secretKey = new SecretKeySpec(key, "HmacSHA256");
        return NimbusJwtDecoder.withSecretKey(secretKey).build();
    }
}
