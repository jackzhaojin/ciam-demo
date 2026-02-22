package com.poc.claims.auth.strategy;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.Collections;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit test for JwksNimbusStrategy — uses Nimbus to sign JWTs,
 * validates with the Nimbus-based strategy. No Spring context.
 */
class JwksNimbusStrategyTest {

    private static KeyPair keyPair;
    private static RSAKey rsaJWK;
    private static HttpServer jwksServer;
    private static int serverPort;

    @BeforeAll
    static void setUp() throws Exception {
        // Generate RSA key pair
        KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
        gen.initialize(2048);
        keyPair = gen.generateKeyPair();

        // Build JWK
        rsaJWK = new RSAKey.Builder((RSAPublicKey) keyPair.getPublic())
            .privateKey((RSAPrivateKey) keyPair.getPrivate())
            .keyID("nimbus-test-key")
            .keyUse(com.nimbusds.jose.jwk.KeyUse.SIGNATURE)
            .algorithm(JWSAlgorithm.RS256)
            .build();

        // Start local JWKS server
        JWKSet jwkSet = new JWKSet(rsaJWK.toPublicJWK());
        String jwksJson = jwkSet.toString();

        jwksServer = HttpServer.create(new InetSocketAddress(0), 0);
        serverPort = jwksServer.getAddress().getPort();

        jwksServer.createContext("/realms/test-realm/protocol/openid-connect/certs", exchange -> {
            byte[] response = jwksJson.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.getResponseBody().close();
        });
        jwksServer.start();
    }

    @AfterAll
    static void tearDown() {
        if (jwksServer != null) {
            jwksServer.stop(0);
        }
    }

    @Test
    void validToken_shouldPassValidation() throws Exception {
        String issuerUri = "http://localhost:" + serverPort + "/realms/test-realm";
        String jwt = buildSignedJwt(issuerUri, "nimbus@example.com", "silver");

        JwksNimbusStrategy strategy = new JwksNimbusStrategy();
        TokenValidationResult result = strategy.validate(jwt, issuerUri, Collections.emptyMap());

        assertTrue(result.isValid(), "Token should be valid. Error: " + result.getError());
        assertEquals("nimbus@example.com", result.getEmail());
        assertNull(result.getError());
        assertFalse(result.getValidationSteps().isEmpty());
        assertTrue(result.getDurationMs() >= 0);
        assertEquals("silver", result.getClaims().get("loyalty_tier"));
    }

    @Test
    void expiredToken_shouldFailValidation() throws Exception {
        String issuerUri = "http://localhost:" + serverPort + "/realms/test-realm";
        String jwt = buildSignedJwt(issuerUri, "nimbus@example.com", "silver", -3600);

        JwksNimbusStrategy strategy = new JwksNimbusStrategy();
        TokenValidationResult result = strategy.validate(jwt, issuerUri, Collections.emptyMap());

        assertFalse(result.isValid());
        assertNotNull(result.getError());
    }

    @Test
    void strategyMetadata_shouldBeCorrect() {
        JwksNimbusStrategy strategy = new JwksNimbusStrategy();
        assertEquals("jwks-nimbus", strategy.getKey());
        assertTrue(strategy.getLabel().contains("Nimbus"));
    }

    // ── Helper methods ──────────────────────────────────────────────────────────

    private String buildSignedJwt(String issuer, String email, String loyaltyTier) throws Exception {
        return buildSignedJwt(issuer, email, loyaltyTier, 3600);
    }

    private String buildSignedJwt(String issuer, String email, String loyaltyTier, int expiryOffset) throws Exception {
        long now = System.currentTimeMillis();

        JWTClaimsSet claimsSet = new JWTClaimsSet.Builder()
            .issuer(issuer)
            .claim("email", email)
            .claim("loyalty_tier", loyaltyTier)
            .issueTime(new Date(now))
            .expirationTime(new Date(now + expiryOffset * 1000L))
            .build();

        JWSHeader header = new JWSHeader.Builder(JWSAlgorithm.RS256)
            .keyID(rsaJWK.getKeyID())
            .build();

        SignedJWT signedJWT = new SignedJWT(header, claimsSet);
        signedJWT.sign(new RSASSASigner(rsaJWK));

        return signedJWT.serialize();
    }
}
