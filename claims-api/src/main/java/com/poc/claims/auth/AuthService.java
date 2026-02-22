package com.poc.claims.auth;

import com.poc.claims.auth.dto.PkceCallbackResponse;
import com.poc.claims.auth.strategy.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class AuthService {

    private final String issuerUri;
    private final String frontendClientId;
    private final String introspectionClientId;
    private final String introspectionClientSecret;
    private final Map<String, TokenValidationStrategy> strategies;

    public AuthService(
            @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuerUri,
            @Value("${app.auth.frontend-client-id}") String frontendClientId,
            @Value("${app.auth.introspection-client-id}") String introspectionClientId,
            @Value("${app.auth.introspection-client-secret:}") String introspectionClientSecret) {
        this.issuerUri = issuerUri;
        this.frontendClientId = frontendClientId;
        this.introspectionClientId = introspectionClientId;
        this.introspectionClientSecret = introspectionClientSecret;

        this.strategies = new LinkedHashMap<>();
        registerStrategy(new JwksVanillaStrategy());
        registerStrategy(new JwksNimbusStrategy());
        registerStrategy(new IntrospectionVanillaStrategy());
        registerStrategy(new IntrospectionNimbusStrategy());
    }

    private void registerStrategy(TokenValidationStrategy strategy) {
        strategies.put(strategy.getKey(), strategy);
    }

    public Map<String, TokenValidationStrategy> getStrategies() {
        return Collections.unmodifiableMap(strategies);
    }

    public String getIssuerUri() {
        return issuerUri;
    }

    public String getFrontendClientId() {
        return frontendClientId;
    }

    /**
     * Exchange an authorization code for tokens via Keycloak's token endpoint,
     * then validate the access token using the selected strategy.
     */
    public PkceCallbackResponse exchangeAndValidate(String authorizationCode, String codeVerifier,
                                                      String redirectUri, String strategyKey) {
        PkceCallbackResponse response = new PkceCallbackResponse();
        response.setStrategy(strategyKey);

        TokenValidationStrategy strategy = strategies.get(strategyKey);
        if (strategy == null) {
            response.setSuccess(false);
            response.setError("Unknown strategy: " + strategyKey + ". Available: " + strategies.keySet());
            return response;
        }
        response.setStrategyLabel(strategy.getLabel());

        try {
            // Step 1: Exchange code for tokens
            String tokenEndpoint = issuerUri + "/protocol/openid-connect/token";
            Map<String, Object> tokenData = exchangeCodeForTokens(tokenEndpoint, authorizationCode, codeVerifier, redirectUri);
            String accessToken = (String) tokenData.get("access_token");

            // Step 2: Validate with selected strategy
            Map<String, String> config = new HashMap<>();
            config.put("introspection.client_id", introspectionClientId);
            config.put("introspection.client_secret", introspectionClientSecret);

            TokenValidationResult result = strategy.validate(accessToken, issuerUri, config);

            // Step 3: Build response
            response.setSuccess(result.isValid());
            response.setTokenSummary(result.getClaims());

            PkceCallbackResponse.ValidationDetails details = new PkceCallbackResponse.ValidationDetails();
            details.setMethod(strategy.getLabel());
            details.setOfflineValidation(strategyKey.startsWith("jwks"));
            details.setSteps(result.getValidationSteps());
            details.setDurationMs(result.getDurationMs());
            response.setValidationDetails(details);

            if (result.isValid()) {
                // Attach tokens so the frontend can create a session
                PkceCallbackResponse.TokenData tokens = new PkceCallbackResponse.TokenData();
                tokens.setAccessToken(accessToken);
                tokens.setRefreshToken((String) tokenData.get("refresh_token"));
                tokens.setIdToken((String) tokenData.get("id_token"));
                tokens.setExpiresIn(((Number) tokenData.get("expires_in")).longValue());
                response.setTokens(tokens);
            } else {
                response.setError(result.getError());
            }

        } catch (Exception e) {
            response.setSuccess(false);
            response.setError("Token exchange failed: " + e.getMessage());
        }

        return response;
    }

    private Map<String, Object> exchangeCodeForTokens(String tokenEndpoint, String code, String codeVerifier, String redirectUri) throws Exception {
        String body = "grant_type=authorization_code"
                + "&code=" + java.net.URLEncoder.encode(code, "UTF-8")
                + "&client_id=" + java.net.URLEncoder.encode(frontendClientId, "UTF-8")
                + "&code_verifier=" + java.net.URLEncoder.encode(codeVerifier, "UTF-8")
                + "&redirect_uri=" + java.net.URLEncoder.encode(redirectUri, "UTF-8");

        HttpURLConnection conn = (HttpURLConnection) URI.create(tokenEndpoint).toURL().openConnection();
        conn.setRequestMethod("POST");
        conn.setDoOutput(true);
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(10000);
        conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");

        try (OutputStream os = conn.getOutputStream()) {
            os.write(body.getBytes(StandardCharsets.UTF_8));
        }

        int status = conn.getResponseCode();
        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(status >= 400 ? conn.getErrorStream() : conn.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
        } finally {
            conn.disconnect();
        }

        if (status != 200) {
            throw new RuntimeException("Token exchange returned HTTP " + status + ": " + sb);
        }

        org.json.JSONObject tokenResponse = new org.json.JSONObject(sb.toString());
        String accessToken = tokenResponse.optString("access_token");
        if (accessToken == null || accessToken.isEmpty()) {
            throw new RuntimeException("No access_token in token response");
        }

        Map<String, Object> result = new HashMap<>();
        result.put("access_token", accessToken);
        result.put("refresh_token", tokenResponse.optString("refresh_token", null));
        result.put("id_token", tokenResponse.optString("id_token", null));
        result.put("expires_in", tokenResponse.optInt("expires_in", 300));
        return result;
    }
}
