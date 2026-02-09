package com.poc.claims.service;

import com.poc.claims.model.ClaimStatus;
import com.poc.claims.model.ClaimType;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class PriorityCalculatorTest {

    @Test
    void lowPriority_smallAutoClaimRecent() {
        var result = PriorityCalculator.calculate(
                ClaimType.AUTO, new BigDecimal("500"), LocalDateTime.now(), ClaimStatus.DRAFT);
        assertEquals("LOW", result.priority());
        assertTrue(result.score() < 30);
    }

    @Test
    void mediumPriority_moderatePropertyClaim() {
        var result = PriorityCalculator.calculate(
                ClaimType.PROPERTY, new BigDecimal("15000"), LocalDateTime.now().minusDays(10), ClaimStatus.DRAFT);
        assertEquals("MEDIUM", result.priority());
        assertTrue(result.score() >= 30 && result.score() < 50);
    }

    @Test
    void highPriority_largeLiabilityClaim() {
        var result = PriorityCalculator.calculate(
                ClaimType.LIABILITY, new BigDecimal("60000"), LocalDateTime.now().minusDays(10), ClaimStatus.UNDER_REVIEW);
        assertEquals("HIGH", result.priority());
        assertTrue(result.score() >= 50 && result.score() < 70);
    }

    @Test
    void criticalPriority_veryLargeOldClaim() {
        var result = PriorityCalculator.calculate(
                ClaimType.LIABILITY, new BigDecimal("150000"), LocalDateTime.now().minusDays(60), ClaimStatus.SUBMITTED);
        assertEquals("CRITICAL", result.priority());
        assertTrue(result.score() >= 70);
    }

    @Test
    void nullAmount_shouldNotThrow() {
        var result = PriorityCalculator.calculate(
                ClaimType.AUTO, null, LocalDateTime.now(), ClaimStatus.DRAFT);
        assertNotNull(result.priority());
    }

    @Test
    void nullType_shouldNotThrow() {
        var result = PriorityCalculator.calculate(
                null, new BigDecimal("1000"), LocalDateTime.now(), ClaimStatus.DRAFT);
        assertNotNull(result.priority());
    }

    @Test
    void nullFiledDate_shouldNotThrow() {
        var result = PriorityCalculator.calculate(
                ClaimType.HEALTH, new BigDecimal("5000"), null, ClaimStatus.DRAFT);
        assertNotNull(result.priority());
    }

    @Test
    void statusBoost_submittedGetsExtraPoints() {
        var draftResult = PriorityCalculator.calculate(
                ClaimType.AUTO, new BigDecimal("2000"), LocalDateTime.now(), ClaimStatus.DRAFT);
        var submittedResult = PriorityCalculator.calculate(
                ClaimType.AUTO, new BigDecimal("2000"), LocalDateTime.now(), ClaimStatus.SUBMITTED);
        assertTrue(submittedResult.score() > draftResult.score());
    }
}
