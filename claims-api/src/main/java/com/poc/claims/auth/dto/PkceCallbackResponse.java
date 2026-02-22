package com.poc.claims.auth.dto;

import java.util.List;
import java.util.Map;

public class PkceCallbackResponse {

    private boolean success;
    private String strategy;
    private String strategyLabel;
    private Map<String, Object> tokenSummary;
    private ValidationDetails validationDetails;
    private String error;

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public String getStrategy() { return strategy; }
    public void setStrategy(String strategy) { this.strategy = strategy; }

    public String getStrategyLabel() { return strategyLabel; }
    public void setStrategyLabel(String strategyLabel) { this.strategyLabel = strategyLabel; }

    public Map<String, Object> getTokenSummary() { return tokenSummary; }
    public void setTokenSummary(Map<String, Object> tokenSummary) { this.tokenSummary = tokenSummary; }

    public ValidationDetails getValidationDetails() { return validationDetails; }
    public void setValidationDetails(ValidationDetails validationDetails) { this.validationDetails = validationDetails; }

    public String getError() { return error; }
    public void setError(String error) { this.error = error; }

    public static class ValidationDetails {
        private String method;
        private boolean offlineValidation;
        private List<String> steps;
        private long durationMs;

        public String getMethod() { return method; }
        public void setMethod(String method) { this.method = method; }

        public boolean isOfflineValidation() { return offlineValidation; }
        public void setOfflineValidation(boolean offlineValidation) { this.offlineValidation = offlineValidation; }

        public List<String> getSteps() { return steps; }
        public void setSteps(List<String> steps) { this.steps = steps; }

        public long getDurationMs() { return durationMs; }
        public void setDurationMs(long durationMs) { this.durationMs = durationMs; }
    }
}
