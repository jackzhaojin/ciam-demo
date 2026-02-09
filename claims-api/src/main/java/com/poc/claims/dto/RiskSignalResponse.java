package com.poc.claims.dto;

import java.util.List;

public class RiskSignalResponse {

    private String overallRisk;
    private int riskScore;
    private List<Signal> signals;

    public RiskSignalResponse() {}

    // Getters and setters

    public String getOverallRisk() { return overallRisk; }
    public void setOverallRisk(String overallRisk) { this.overallRisk = overallRisk; }

    public int getRiskScore() { return riskScore; }
    public void setRiskScore(int riskScore) { this.riskScore = riskScore; }

    public List<Signal> getSignals() { return signals; }
    public void setSignals(List<Signal> signals) { this.signals = signals; }

    public static class Signal {
        private String severity;
        private String label;
        private String description;

        public Signal() {}

        public Signal(String severity, String label, String description) {
            this.severity = severity;
            this.label = label;
            this.description = description;
        }

        public String getSeverity() { return severity; }
        public void setSeverity(String severity) { this.severity = severity; }

        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }

        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
    }
}
