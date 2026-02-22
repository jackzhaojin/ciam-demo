package com.poc.claims.auth.strategy;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.jwk.source.JWKSourceBuilder;
import com.nimbusds.jose.proc.JWSKeySelector;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.proc.DefaultJWTClaimsVerifier;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;

import java.net.URI;
import java.net.URL;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * JWKS validation using Nimbus JOSE+JWT library.
 * ~15 lines of real logic vs ~60 in the vanilla strategy.
 * Shows the power of a well-designed library.
 */
public class JwksNimbusStrategy implements TokenValidationStrategy {

    @Override
    public String getLabel() { return "JWKS \u2014 Nimbus JOSE+JWT"; }

    @Override
    public String getKey() { return "jwks-nimbus"; }

    @Override
    public TokenValidationResult validate(String accessToken, String issuerUri, Map<String, String> config) {
        TokenValidationResult result = new TokenValidationResult();
        long start = System.currentTimeMillis();

        try {
            // Step 1: Configure JWKS source
            String jwksUrl = issuerUri + "/protocol/openid-connect/certs";
            result.addStep("Configuring RemoteJWKSet from: " + jwksUrl);
            URL jwksEndpoint = URI.create(jwksUrl).toURL();
            JWKSource<SecurityContext> jwkSource = JWKSourceBuilder.create(jwksEndpoint).build();
            result.addStep("JWKS source created (handles caching + rotation automatically)");

            // Step 2: Create JWT processor with RS256 key selector
            DefaultJWTProcessor<SecurityContext> processor = new DefaultJWTProcessor<>();
            JWSKeySelector<SecurityContext> keySelector = new JWSVerificationKeySelector<>(JWSAlgorithm.RS256, jwkSource);
            processor.setJWSKeySelector(keySelector);
            result.addStep("JWT processor configured: RS256 + JWKS key selector");

            // Step 3: Configure claims verification (issuer + expiration)
            DefaultJWTClaimsVerifier<SecurityContext> claimsVerifier = new DefaultJWTClaimsVerifier<>(
                new JWTClaimsSet.Builder().issuer(issuerUri).build(),
                new HashSet<>(Arrays.asList("exp", "iat", "iss"))
            );
            processor.setJWTClaimsSetVerifier(claimsVerifier);
            result.addStep("Claims verifier configured: required=[exp, iat, iss], issuer=" + issuerUri);

            // Step 4: Process (verify signature + validate claims in one call)
            result.addStep("Processing JWT (signature verification + claims validation)...");
            JWTClaimsSet claimsSet = processor.process(accessToken, null);
            result.addStep("JWT processed successfully \u2014 signature valid, claims verified \u2714");

            // Step 5: Extract claims
            Map<String, Object> claims = new LinkedHashMap<>();
            claims.put("iss", claimsSet.getIssuer());
            claims.put("email", claimsSet.getStringClaim("email"));
            if (claimsSet.getExpirationTime() != null) {
                claims.put("exp", claimsSet.getExpirationTime().getTime() / 1000);
            }
            if (claimsSet.getIssueTime() != null) {
                claims.put("iat", claimsSet.getIssueTime().getTime() / 1000);
            }
            String loyaltyTier = claimsSet.getStringClaim("loyalty_tier");
            if (loyaltyTier != null) {
                claims.put("loyalty_tier", loyaltyTier);
            }
            Object orgs = claimsSet.getClaim("organizations");
            if (orgs != null) {
                claims.put("organizations", orgs);
            }
            result.addStep("Extracted claims: email=" + claimsSet.getStringClaim("email")
                + ", loyalty_tier=" + (loyaltyTier != null ? loyaltyTier : "N/A"));

            result.setValid(true);
            result.setEmail(claimsSet.getStringClaim("email"));
            result.setSubject(claimsSet.getSubject());
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
}
