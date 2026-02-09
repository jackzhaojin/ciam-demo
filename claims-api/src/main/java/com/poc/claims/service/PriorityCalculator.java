package com.poc.claims.service;

import com.poc.claims.model.ClaimStatus;
import com.poc.claims.model.ClaimType;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

public final class PriorityCalculator {

    private PriorityCalculator() {}

    public static PriorityResult calculate(ClaimType type, BigDecimal amount, LocalDateTime filedDate, ClaimStatus status) {
        int score = 0;

        // Amount-based scoring
        if (amount != null) {
            if (amount.compareTo(new BigDecimal("100000")) >= 0) {
                score += 40;
            } else if (amount.compareTo(new BigDecimal("50000")) >= 0) {
                score += 30;
            } else if (amount.compareTo(new BigDecimal("10000")) >= 0) {
                score += 20;
            } else if (amount.compareTo(new BigDecimal("1000")) >= 0) {
                score += 10;
            }
        }

        // Type-based scoring
        if (type != null) {
            switch (type) {
                case LIABILITY -> score += 20;
                case PROPERTY -> score += 15;
                case HEALTH -> score += 10;
                case AUTO -> score += 5;
            }
        }

        // Age-based scoring (older = higher priority)
        if (filedDate != null) {
            long daysOld = ChronoUnit.DAYS.between(filedDate, LocalDateTime.now());
            if (daysOld > 30) {
                score += 20;
            } else if (daysOld > 14) {
                score += 10;
            } else if (daysOld > 7) {
                score += 5;
            }
        }

        // Status-based boost for claims needing attention
        if (status == ClaimStatus.SUBMITTED || status == ClaimStatus.UNDER_REVIEW) {
            score += 10;
        }

        String priority;
        if (score >= 70) {
            priority = "CRITICAL";
        } else if (score >= 50) {
            priority = "HIGH";
        } else if (score >= 30) {
            priority = "MEDIUM";
        } else {
            priority = "LOW";
        }

        return new PriorityResult(priority, score);
    }

    public record PriorityResult(String priority, int score) {}
}
