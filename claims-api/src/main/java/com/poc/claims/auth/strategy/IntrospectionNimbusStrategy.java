package com.poc.claims.auth.strategy;

import com.nimbusds.oauth2.sdk.TokenIntrospectionRequest;
import com.nimbusds.oauth2.sdk.TokenIntrospectionResponse;
import com.nimbusds.oauth2.sdk.TokenIntrospectionSuccessResponse;
import com.nimbusds.oauth2.sdk.auth.ClientSecretBasic;
import com.nimbusds.oauth2.sdk.auth.Secret;
import com.nimbusds.oauth2.sdk.id.ClientID;
import com.nimbusds.oauth2.sdk.token.BearerAccessToken;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Token introspection using Nimbus OAuth2 SDK.
 * Same introspection logic as the vanilla strategy, but the library
 * handles HTTP, parsing, and credential encoding.
 *
 * Config keys: introspection.client_id, introspection.client_secret
 */
public class IntrospectionNimbusStrategy implements TokenValidationStrategy {

    @Override
    public String getLabel() { return "Introspection \u2014 Nimbus OAuth2 SDK"; }

    @Override
    public String getKey() { return "introspection-nimbus"; }

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

            // Step 1: Build introspection URI
            URI introspectionEndpoint = URI.create(issuerUri + "/protocol/openid-connect/token/introspect");
            result.addStep("Introspection endpoint: " + introspectionEndpoint);

            // Step 2: Create client credentials
            ClientID client = new ClientID(clientId);
            Secret secret = new Secret(clientSecret);
            ClientSecretBasic clientAuth = new ClientSecretBasic(client, secret);
            result.addStep("Created ClientSecretBasic credentials: client_id=" + clientId);

            // Step 3: Create and send introspection request
            BearerAccessToken token = new BearerAccessToken(accessToken);
            TokenIntrospectionRequest request = new TokenIntrospectionRequest(introspectionEndpoint, clientAuth, token);
            result.addStep("Sending TokenIntrospectionRequest...");

            TokenIntrospectionResponse response = TokenIntrospectionResponse.parse(request.toHTTPRequest().send());
            result.addStep("Received introspection response");

            // Step 4: Check for success
            if (!response.indicatesSuccess()) {
                throw new RuntimeException("Introspection request failed: " + response.toHTTPResponse().getStatusCode());
            }

            TokenIntrospectionSuccessResponse successResponse = response.toSuccessResponse();
            result.addStep("Introspection response parsed successfully");

            // Step 5: Check active flag
            boolean active = successResponse.isActive();
            if (!active) {
                throw new SecurityException("Token is NOT active (introspection returned active=false)");
            }
            result.addStep("Token is active=true \u2714");

            // Step 6: Extract claims from response
            Map<String, Object> claims = new LinkedHashMap<>();
            claims.put("active", true);

            // The Nimbus response provides typed accessors
            net.minidev.json.JSONObject jsonParams = successResponse.toJSONObject();
            if (jsonParams.containsKey("iss")) claims.put("iss", jsonParams.getAsString("iss"));
            if (jsonParams.containsKey("email")) claims.put("email", jsonParams.getAsString("email"));
            if (jsonParams.containsKey("exp")) claims.put("exp", jsonParams.get("exp"));
            if (jsonParams.containsKey("iat")) claims.put("iat", jsonParams.get("iat"));
            if (jsonParams.containsKey("client_id")) claims.put("client_id", jsonParams.getAsString("client_id"));
            if (jsonParams.containsKey("loyalty_tier")) claims.put("loyalty_tier", jsonParams.getAsString("loyalty_tier"));
            if (jsonParams.containsKey("organizations")) claims.put("organizations", jsonParams.get("organizations"));
            result.addStep("Extracted claims: email=" + jsonParams.getAsString("email") + ", active=true");

            result.setValid(true);
            result.setEmail(jsonParams.getAsString("email"));
            result.setSubject(jsonParams.getAsString("sub"));
            result.setClaims(claims);
            result.addStep("Validation complete: PASS (online introspection via Nimbus)");

        } catch (Exception e) {
            result.setValid(false);
            result.setError(e.getClass().getSimpleName() + ": " + e.getMessage());
            result.addStep("Validation FAILED: " + e.getMessage());
        }

        result.setDurationMs(System.currentTimeMillis() - start);
        return result;
    }
}
