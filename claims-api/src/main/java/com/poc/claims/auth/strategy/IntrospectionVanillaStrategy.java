package com.poc.claims.auth.strategy;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Token introspection using vanilla Java HttpURLConnection.
 * POSTs to the Keycloak introspection endpoint with Basic auth.
 * Online validation — requires network call to the IdP for every check.
 *
 * Config keys: introspection.client_id, introspection.client_secret
 */
public class IntrospectionVanillaStrategy implements TokenValidationStrategy {

    @Override
    public String getLabel() { return "Introspection \u2014 Vanilla Java"; }

    @Override
    public String getKey() { return "introspection-vanilla"; }

    @Override
    public TokenValidationResult validate(String accessToken, String issuerUri, Map<String, String> config) {
        TokenValidationResult result = new TokenValidationResult();
        long start = System.currentTimeMillis();

        try {
            String clientId = config.get("introspection.client_id");
            String clientSecret = config.get("introspection.client_secret");
            if (clientId == null || clientSecret == null) {
                throw new IllegalArgumentException("introspection.client_id and introspection.client_secret are required");
            }

            // Step 1: Build the introspection URL
            String introspectionUrl = issuerUri + "/protocol/openid-connect/token/introspect";
            result.addStep("Introspection endpoint: " + introspectionUrl);

            // Step 2: Prepare Basic auth header
            String credentials = clientId + ":" + clientSecret;
            String basicAuth = "Basic " + Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
            result.addStep("Using Basic auth: client_id=" + clientId);

            // Step 3: POST the token for introspection
            String body = "token=" + java.net.URLEncoder.encode(accessToken, "UTF-8") + "&token_type_hint=access_token";
            result.addStep("POSTing token to introspection endpoint (token_type_hint=access_token)...");

            HttpURLConnection conn = (HttpURLConnection) URI.create(introspectionUrl).toURL().openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            conn.setRequestProperty("Authorization", basicAuth);
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");

            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.getBytes(StandardCharsets.UTF_8));
            }

            int responseCode = conn.getResponseCode();
            result.addStep("Introspection response: HTTP " + responseCode);

            if (responseCode != 200) {
                throw new RuntimeException("Introspection endpoint returned HTTP " + responseCode);
            }

            // Step 4: Parse response
            StringBuilder sb = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
            } finally {
                conn.disconnect();
            }

            JSONObject response = new JSONObject(sb.toString());
            result.addStep("Parsed introspection response (" + response.length() + " fields)");

            // Step 5: Check the active flag
            boolean active = response.optBoolean("active", false);
            if (!active) {
                throw new SecurityException("Token is NOT active (introspection returned active=false)");
            }
            result.addStep("Token is active=true \u2714");

            // Step 6: Extract claims from the introspection response
            Map<String, Object> claims = new LinkedHashMap<>();
            claims.put("active", true);
            if (response.has("iss")) claims.put("iss", response.getString("iss"));
            if (response.has("email")) claims.put("email", response.getString("email"));
            if (response.has("exp")) claims.put("exp", response.getLong("exp"));
            if (response.has("iat")) claims.put("iat", response.getLong("iat"));
            if (response.has("client_id")) claims.put("client_id", response.getString("client_id"));
            if (response.has("loyalty_tier")) claims.put("loyalty_tier", response.getString("loyalty_tier"));
            if (response.has("organizations")) claims.put("organizations", response.getJSONObject("organizations").toMap());
            result.addStep("Extracted claims: email=" + response.optString("email") + ", active=true");

            result.setValid(true);
            result.setEmail(response.optString("email"));
            result.setSubject(response.optString("sub"));
            result.setClaims(claims);
            result.addStep("Validation complete: PASS (online introspection)");

        } catch (Exception e) {
            result.setValid(false);
            result.setError(e.getClass().getSimpleName() + ": " + e.getMessage());
            result.addStep("Validation FAILED: " + e.getMessage());
        }

        result.setDurationMs(System.currentTimeMillis() - start);
        return result;
    }
}
