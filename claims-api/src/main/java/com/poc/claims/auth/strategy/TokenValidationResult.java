package com.poc.claims.auth.strategy;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Result of a token validation attempt. Contains success/failure status,
 * extracted claims, step-by-step validation log, and timing.
 * Pure POJO — no Spring dependencies.
 */
public class TokenValidationResult {

    private boolean valid;
    private String email;
    private String subject;
    private Map<String, Object> claims = new LinkedHashMap<>();
    private List<String> validationSteps = new ArrayList<>();
    private String error;
    private long durationMs;

    public boolean isValid() { return valid; }
    public void setValid(boolean valid) { this.valid = valid; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }

    public Map<String, Object> getClaims() { return claims; }
    public void setClaims(Map<String, Object> claims) { this.claims = claims; }

    public List<String> getValidationSteps() { return validationSteps; }
    public void setValidationSteps(List<String> validationSteps) { this.validationSteps = validationSteps; }

    public String getError() { return error; }
    public void setError(String error) { this.error = error; }

    public long getDurationMs() { return durationMs; }
    public void setDurationMs(long durationMs) { this.durationMs = durationMs; }

    public void addStep(String step) {
        this.validationSteps.add(step);
    }
}
