package com.poc.claims.dto;

import java.math.BigDecimal;
import java.util.Map;

public class ClaimStatsResponse {

    private long totalClaims;
    private long openClaims;
    private Map<String, Long> claimsByStatus;
    private Map<String, Long> claimsByType;
    private BigDecimal totalExposure;
    private double approvalRate;
    private long claimsThisWeek;
    private Map<String, Long> claimsByPriority;

    public ClaimStatsResponse() {}

    // Getters and setters

    public long getTotalClaims() { return totalClaims; }
    public void setTotalClaims(long totalClaims) { this.totalClaims = totalClaims; }

    public long getOpenClaims() { return openClaims; }
    public void setOpenClaims(long openClaims) { this.openClaims = openClaims; }

    public Map<String, Long> getClaimsByStatus() { return claimsByStatus; }
    public void setClaimsByStatus(Map<String, Long> claimsByStatus) { this.claimsByStatus = claimsByStatus; }

    public Map<String, Long> getClaimsByType() { return claimsByType; }
    public void setClaimsByType(Map<String, Long> claimsByType) { this.claimsByType = claimsByType; }

    public BigDecimal getTotalExposure() { return totalExposure; }
    public void setTotalExposure(BigDecimal totalExposure) { this.totalExposure = totalExposure; }

    public double getApprovalRate() { return approvalRate; }
    public void setApprovalRate(double approvalRate) { this.approvalRate = approvalRate; }

    public long getClaimsThisWeek() { return claimsThisWeek; }
    public void setClaimsThisWeek(long claimsThisWeek) { this.claimsThisWeek = claimsThisWeek; }

    public Map<String, Long> getClaimsByPriority() { return claimsByPriority; }
    public void setClaimsByPriority(Map<String, Long> claimsByPriority) { this.claimsByPriority = claimsByPriority; }
}
