package com.poc.claims.auth.strategy;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigInteger;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.Signature;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.RSAPublicKeySpec;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * JWKS validation using only vanilla Java — no libraries beyond JDK + org.json.
 * Fetches the JWKS endpoint, manually constructs an RSA public key from n/e,
 * and verifies the JWT signature using java.security.Signature.
 *
 * This is the most verbose strategy (~60 lines of real logic) to show what
 * libraries like Nimbus abstract away.
 */
public class JwksVanillaStrategy implements TokenValidationStrategy {

    @Override
    public String getLabel() { return "JWKS \u2014 Vanilla Java"; }

    @Override
    public String getKey() { return "jwks-vanilla"; }

    @Override
    public TokenValidationResult validate(String accessToken, String issuerUri, Map<String, String> config) {
        TokenValidationResult result = new TokenValidationResult();
        long start = System.currentTimeMillis();

        try {
            // Step 1: Split the JWT into parts
            String[] parts = accessToken.split("\\.");
            if (parts.length != 3) {
                throw new IllegalArgumentException("JWT must have 3 parts (header.payload.signature), got " + parts.length);
            }
            result.addStep("Split JWT into 3 parts: header, payload, signature");

            // Step 2: Decode the header to get key ID (kid) and algorithm
            String headerJson = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
            JSONObject header = new JSONObject(headerJson);
            String kid = header.getString("kid");
            String alg = header.getString("alg");
            result.addStep("Decoded JWT header: alg=" + alg + ", kid=" + kid);

            if (!"RS256".equals(alg)) {
                throw new IllegalArgumentException("Unsupported algorithm: " + alg + " (only RS256 supported)");
            }

            // Step 3: Fetch the JWKS from the well-known endpoint
            String jwksUrl = issuerUri + "/protocol/openid-connect/certs";
            result.addStep("Fetching JWKS from: " + jwksUrl);
            String jwksJson = httpGet(jwksUrl);
            result.addStep("JWKS response received (" + jwksJson.length() + " bytes)");

            // Step 4: Find the matching key by kid
            JSONObject jwks = new JSONObject(jwksJson);
            JSONArray keys = jwks.getJSONArray("keys");
            JSONObject matchingKey = null;
            for (int i = 0; i < keys.length(); i++) {
                JSONObject key = keys.getJSONObject(i);
                if (kid.equals(key.optString("kid"))) {
                    matchingKey = key;
                    break;
                }
            }
            if (matchingKey == null) {
                throw new IllegalArgumentException("No key found in JWKS for kid: " + kid);
            }
            result.addStep("Found matching JWK for kid=" + kid + " (kty=" + matchingKey.getString("kty") + ")");

            // Step 5: Build RSA public key from n (modulus) and e (exponent)
            BigInteger modulus = new BigInteger(1, Base64.getUrlDecoder().decode(matchingKey.getString("n")));
            BigInteger exponent = new BigInteger(1, Base64.getUrlDecoder().decode(matchingKey.getString("e")));
            RSAPublicKeySpec spec = new RSAPublicKeySpec(modulus, exponent);
            RSAPublicKey publicKey = (RSAPublicKey) KeyFactory.getInstance("RSA").generatePublic(spec);
            result.addStep("Constructed RSA public key from JWK (modulus: " + modulus.bitLength() + " bits)");

            // Step 6: Verify the signature
            byte[] signedContent = (parts[0] + "." + parts[1]).getBytes(StandardCharsets.UTF_8);
            byte[] signature = Base64.getUrlDecoder().decode(parts[2]);
            Signature verifier = Signature.getInstance("SHA256withRSA");
            verifier.initVerify(publicKey);
            verifier.update(signedContent);
            boolean signatureValid = verifier.verify(signature);
            if (!signatureValid) {
                throw new SecurityException("JWT signature verification failed");
            }
            result.addStep("Signature verified: SHA256withRSA \u2714");

            // Step 7: Decode and validate the payload
            String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            JSONObject payload = new JSONObject(payloadJson);
            result.addStep("Decoded JWT payload (" + payload.length() + " claims)");

            // Step 8: Validate expiration
            long exp = payload.getLong("exp");
            long now = System.currentTimeMillis() / 1000;
            if (now >= exp) {
                throw new SecurityException("Token expired at " + exp + " (current time: " + now + ")");
            }
            result.addStep("Expiration check passed: exp=" + exp + ", now=" + now + " (TTL: " + (exp - now) + "s)");

            // Step 9: Validate issuer
            String iss = payload.getString("iss");
            if (!issuerUri.equals(iss)) {
                throw new SecurityException("Issuer mismatch: expected " + issuerUri + ", got " + iss);
            }
            result.addStep("Issuer check passed: " + iss + " \u2714");

            // Step 10: Extract claims
            Map<String, Object> claims = new LinkedHashMap<>();
            claims.put("iss", payload.optString("iss"));
            claims.put("email", payload.optString("email"));
            claims.put("exp", payload.optLong("exp"));
            claims.put("iat", payload.optLong("iat"));
            if (payload.has("loyalty_tier")) {
                claims.put("loyalty_tier", payload.getString("loyalty_tier"));
            }
            if (payload.has("organizations")) {
                claims.put("organizations", payload.getJSONObject("organizations").toMap());
            }
            result.addStep("Extracted claims: email=" + payload.optString("email") + ", loyalty_tier=" + payload.optString("loyalty_tier", "N/A"));

            result.setValid(true);
            result.setEmail(payload.optString("email"));
            result.setSubject(payload.optString("sub"));
            result.setClaims(claims);
            result.addStep("Validation complete: PASS");

        } catch (Exception e) {
            result.setValid(false);
            result.setError(e.getClass().getSimpleName() + ": " + e.getMessage());
            result.addStep("Validation FAILED: " + e.getMessage());
        }

        result.setDurationMs(System.currentTimeMillis() - start);
        return result;
    }

    private String httpGet(String urlStr) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) URI.create(urlStr).toURL().openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(5000);

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            return sb.toString();
        } finally {
            conn.disconnect();
        }
    }
}
