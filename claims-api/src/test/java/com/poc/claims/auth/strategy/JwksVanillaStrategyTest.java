package com.poc.claims.auth.strategy;

import com.sun.net.httpserver.HttpServer;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.interfaces.RSAPublicKey;
import java.util.Base64;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit test for JwksVanillaStrategy — self-signed RSA keypair,
 * manually constructed JWT, validated without Spring context.
 */
class JwksVanillaStrategyTest {

    private static KeyPair keyPair;
    private static HttpServer jwksServer;
    private static int serverPort;

    @BeforeAll
    static void setUp() throws Exception {
        // Generate an RSA key pair
        KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
        gen.initialize(2048);
        keyPair = gen.generateKeyPair();

        // Start a local HTTP server to serve JWKS
        jwksServer = HttpServer.create(new InetSocketAddress(0), 0);
        serverPort = jwksServer.getAddress().getPort();

        RSAPublicKey pub = (RSAPublicKey) keyPair.getPublic();
        String jwksJson = buildJwksJson(pub, "test-key-id");

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
        String jwt = buildSignedJwt(issuerUri, "test@example.com", "gold", "test-key-id");

        JwksVanillaStrategy strategy = new JwksVanillaStrategy();
        TokenValidationResult result = strategy.validate(jwt, issuerUri, Collections.emptyMap());

        assertTrue(result.isValid(), "Token should be valid. Error: " + result.getError());
        assertEquals("test@example.com", result.getEmail());
        assertNull(result.getError());
        assertFalse(result.getValidationSteps().isEmpty());
        assertTrue(result.getDurationMs() >= 0);
        assertEquals("gold", result.getClaims().get("loyalty_tier"));
    }

    @Test
    void expiredToken_shouldFailValidation() throws Exception {
        String issuerUri = "http://localhost:" + serverPort + "/realms/test-realm";
        String jwt = buildSignedJwt(issuerUri, "test@example.com", "gold", "test-key-id", -3600);

        JwksVanillaStrategy strategy = new JwksVanillaStrategy();
        TokenValidationResult result = strategy.validate(jwt, issuerUri, Collections.emptyMap());

        assertFalse(result.isValid());
        assertNotNull(result.getError());
        assertTrue(result.getError().contains("expired"));
    }

    @Test
    void wrongIssuer_shouldFailValidation() throws Exception {
        String issuerUri = "http://localhost:" + serverPort + "/realms/test-realm";
        String jwt = buildSignedJwt("http://wrong-issuer/realms/test-realm", "test@example.com", "gold", "test-key-id");

        JwksVanillaStrategy strategy = new JwksVanillaStrategy();
        TokenValidationResult result = strategy.validate(jwt, issuerUri, Collections.emptyMap());

        assertFalse(result.isValid());
        assertNotNull(result.getError());
        assertTrue(result.getError().contains("Issuer mismatch"));
    }

    @Test
    void strategyMetadata_shouldBeCorrect() {
        JwksVanillaStrategy strategy = new JwksVanillaStrategy();
        assertEquals("jwks-vanilla", strategy.getKey());
        assertTrue(strategy.getLabel().contains("Vanilla"));
    }

    // ── Helper methods ──────────────────────────────────────────────────────────

    private String buildSignedJwt(String issuer, String email, String loyaltyTier, String kid) throws Exception {
        return buildSignedJwt(issuer, email, loyaltyTier, kid, 3600);
    }

    private String buildSignedJwt(String issuer, String email, String loyaltyTier, String kid, int expiryOffset) throws Exception {
        long now = System.currentTimeMillis() / 1000;

        JSONObject header = new JSONObject();
        header.put("alg", "RS256");
        header.put("kid", kid);
        header.put("typ", "JWT");

        JSONObject payload = new JSONObject();
        payload.put("iss", issuer);
        payload.put("email", email);
        payload.put("loyalty_tier", loyaltyTier);
        payload.put("iat", now);
        payload.put("exp", now + expiryOffset);

        String headerB64 = base64url(header.toString().getBytes(StandardCharsets.UTF_8));
        String payloadB64 = base64url(payload.toString().getBytes(StandardCharsets.UTF_8));
        String signingInput = headerB64 + "." + payloadB64;

        Signature signer = Signature.getInstance("SHA256withRSA");
        signer.initSign(keyPair.getPrivate());
        signer.update(signingInput.getBytes(StandardCharsets.UTF_8));
        byte[] signature = signer.sign();
        String signatureB64 = base64url(signature);

        return signingInput + "." + signatureB64;
    }

    private static String buildJwksJson(RSAPublicKey pub, String kid) {
        JSONObject key = new JSONObject();
        key.put("kty", "RSA");
        key.put("kid", kid);
        key.put("use", "sig");
        key.put("alg", "RS256");
        key.put("n", base64url(toUnsignedBytes(pub.getModulus())));
        key.put("e", base64url(toUnsignedBytes(pub.getPublicExponent())));

        JSONObject jwks = new JSONObject();
        jwks.put("keys", new JSONArray().put(key));
        return jwks.toString();
    }

    private static String base64url(byte[] data) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(data);
    }

    private static byte[] toUnsignedBytes(BigInteger bigInt) {
        byte[] bytes = bigInt.toByteArray();
        if (bytes[0] == 0) {
            byte[] trimmed = new byte[bytes.length - 1];
            System.arraycopy(bytes, 1, trimmed, 0, trimmed.length);
            return trimmed;
        }
        return bytes;
    }
}
