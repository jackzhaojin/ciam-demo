package com.poc.claims.auth.dto;

import jakarta.validation.constraints.NotBlank;

public class PkceCallbackRequest {

    @NotBlank(message = "authorizationCode is required")
    private String authorizationCode;

    @NotBlank(message = "codeVerifier is required")
    private String codeVerifier;

    @NotBlank(message = "strategy is required")
    private String strategy;

    @NotBlank(message = "redirectUri is required")
    private String redirectUri;

    public String getAuthorizationCode() { return authorizationCode; }
    public void setAuthorizationCode(String authorizationCode) { this.authorizationCode = authorizationCode; }

    public String getCodeVerifier() { return codeVerifier; }
    public void setCodeVerifier(String codeVerifier) { this.codeVerifier = codeVerifier; }

    public String getStrategy() { return strategy; }
    public void setStrategy(String strategy) { this.strategy = strategy; }

    public String getRedirectUri() { return redirectUri; }
    public void setRedirectUri(String redirectUri) { this.redirectUri = redirectUri; }
}
