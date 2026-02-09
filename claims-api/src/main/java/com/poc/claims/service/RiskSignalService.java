package com.poc.claims.service;

import com.poc.claims.dto.RiskSignalResponse;
import com.poc.claims.dto.RiskSignalResponse.Signal;
import com.poc.claims.model.Claim;
import com.poc.claims.repository.ClaimRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class RiskSignalService {

    private final ClaimRepository claimRepository;

    public RiskSignalService(ClaimRepository claimRepository) {
        this.claimRepository = claimRepository;
    }

    @Transactional(readOnly = true)
    public RiskSignalResponse assessRisk(Claim claim, UUID orgId) {
        List<Signal> signals = new ArrayList<>();
        int riskScore = 0;

        // Signal 1: High claim amount compared to org average
        BigDecimal avgAmount = claimRepository.findAverageAmountByOrganizationIdAndType(orgId, claim.getType().name());
        if (avgAmount != null && claim.getAmount() != null && claim.getAmount().compareTo(avgAmount.multiply(new BigDecimal("2"))) > 0) {
            signals.add(new Signal("HIGH", "Above Average Amount",
                    "Claim amount is more than 2x the average for this type"));
            riskScore += 30;
        }

        // Signal 2: Frequent claims by same user in last 90 days
        long recentUserClaims = claimRepository.countByUserIdAndOrganizationIdAndCreatedAtAfter(
                claim.getUserId(), orgId, LocalDateTime.now().minusDays(90));
        if (recentUserClaims > 3) {
            signals.add(new Signal("HIGH", "Frequent Claimant",
                    recentUserClaims + " claims filed by this user in the last 90 days"));
            riskScore += 25;
        } else if (recentUserClaims > 1) {
            signals.add(new Signal("MEDIUM", "Multiple Recent Claims",
                    recentUserClaims + " claims filed by this user in the last 90 days"));
            riskScore += 10;
        }

        // Signal 3: Very high amount (over $100k)
        if (claim.getAmount() != null && claim.getAmount().compareTo(new BigDecimal("100000")) > 0) {
            signals.add(new Signal("HIGH", "High Value Claim",
                    "Claim exceeds $100,000 threshold"));
            riskScore += 20;
        }

        // Signal 4: Claims filed very recently after incident
        if (claim.getIncidentDate() != null && claim.getFiledDate() != null) {
            long daysBetween = java.time.temporal.ChronoUnit.DAYS.between(
                    claim.getIncidentDate().atStartOfDay(), claim.getFiledDate());
            if (daysBetween == 0) {
                signals.add(new Signal("LOW", "Same-Day Filing",
                        "Claim filed on the same day as the incident"));
                riskScore += 5;
            }
        }

        // Signal 5: Total lifetime claims by user
        long totalUserClaims = claimRepository.countByUserIdAndOrganizationId(claim.getUserId(), orgId);
        if (totalUserClaims > 10) {
            signals.add(new Signal("MEDIUM", "High Claim History",
                    totalUserClaims + " total claims from this user"));
            riskScore += 15;
        }

        if (signals.isEmpty()) {
            signals.add(new Signal("LOW", "No Risk Signals",
                    "No elevated risk factors detected"));
        }

        String overallRisk;
        if (riskScore >= 50) {
            overallRisk = "HIGH";
        } else if (riskScore >= 25) {
            overallRisk = "MEDIUM";
        } else {
            overallRisk = "LOW";
        }

        RiskSignalResponse response = new RiskSignalResponse();
        response.setOverallRisk(overallRisk);
        response.setRiskScore(riskScore);
        response.setSignals(signals);
        return response;
    }
}
