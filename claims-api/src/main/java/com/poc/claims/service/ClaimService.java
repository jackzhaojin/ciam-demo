package com.poc.claims.service;

import com.poc.claims.config.OrgContext;
import com.poc.claims.dto.ClaimStatsResponse;
import com.poc.claims.dto.CreateClaimRequest;
import com.poc.claims.dto.UpdateClaimRequest;
import com.poc.claims.model.*;
import com.poc.claims.repository.ClaimEventRepository;
import com.poc.claims.repository.ClaimRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.Year;
import java.util.*;

@Service
public class ClaimService {

    private final ClaimRepository claimRepository;
    private final ClaimEventRepository claimEventRepository;

    public ClaimService(ClaimRepository claimRepository, ClaimEventRepository claimEventRepository) {
        this.claimRepository = claimRepository;
        this.claimEventRepository = claimEventRepository;
    }

    @Transactional
    public Claim createClaim(CreateClaimRequest request, UUID userId, OrgContext orgContext) {
        if (!orgContext.isAdmin()) {
            throw new SecurityException("Only admins can create claims");
        }

        Claim claim = new Claim();
        claim.setId(UUID.randomUUID());
        claim.setClaimNumber(generateClaimNumber());
        claim.setUserId(userId);
        claim.setOrganizationId(orgContext.getOrganizationId());
        claim.setStatus(ClaimStatus.DRAFT);
        claim.setType(request.getType());
        claim.setDescription(request.getDescription());
        claim.setIncidentDate(request.getIncidentDate());
        claim.setAmount(request.getAmount());
        claim.setFiledDate(LocalDateTime.now());

        claim = claimRepository.save(claim);

        createEvent(claim.getId(), userId, EventType.CREATED, "Claim created");

        return claim;
    }

    @Transactional
    public Claim updateClaim(UUID claimId, UpdateClaimRequest request, UUID userId, OrgContext orgContext) {
        Claim claim = getClaimForOrg(claimId, orgContext);

        if (claim.getStatus() != ClaimStatus.DRAFT) {
            throw new IllegalStateException("Can only update claims in DRAFT status");
        }

        if (!claim.getUserId().equals(userId) && !orgContext.isAdmin()) {
            throw new SecurityException("Only the claim owner or an admin can update this claim");
        }

        if (request.getType() != null) claim.setType(request.getType());
        if (request.getDescription() != null) claim.setDescription(request.getDescription());
        if (request.getIncidentDate() != null) claim.setIncidentDate(request.getIncidentDate());
        if (request.getAmount() != null) claim.setAmount(request.getAmount());

        claim = claimRepository.save(claim);
        createEvent(claim.getId(), userId, EventType.UPDATED, "Claim updated");

        return claim;
    }

    @Transactional
    public Claim submitClaim(UUID claimId, UUID userId, OrgContext orgContext) {
        Claim claim = getClaimForOrg(claimId, orgContext);

        if (claim.getStatus() != ClaimStatus.DRAFT) {
            throw new IllegalStateException("Can only submit claims in DRAFT status");
        }

        if (!claim.getUserId().equals(userId) && !orgContext.isAdmin()) {
            throw new SecurityException("Only the claim owner or an admin can submit this claim");
        }

        claim.setStatus(ClaimStatus.SUBMITTED);
        claim = claimRepository.save(claim);
        createEvent(claim.getId(), userId, EventType.SUBMITTED, "Claim submitted for review");

        return claim;
    }

    @Transactional
    public Claim reviewClaim(UUID claimId, UUID userId, OrgContext orgContext) {
        if (!orgContext.isAdmin()) {
            throw new SecurityException("Only admins can move claims to review");
        }

        Claim claim = getClaimForOrg(claimId, orgContext);

        if (claim.getStatus() != ClaimStatus.SUBMITTED) {
            throw new IllegalStateException("Can only review claims in SUBMITTED status");
        }

        claim.setStatus(ClaimStatus.UNDER_REVIEW);
        claim = claimRepository.save(claim);
        createEvent(claim.getId(), userId, EventType.REVIEWED, "Claim moved to review");

        return claim;
    }

    @Transactional
    public Claim approveClaim(UUID claimId, UUID userId, OrgContext orgContext) {
        if (!orgContext.isAdmin() && !orgContext.isBilling()) {
            throw new SecurityException("Only admins or billing users can approve claims");
        }

        Claim claim = getClaimForOrg(claimId, orgContext);

        if (claim.getStatus() != ClaimStatus.UNDER_REVIEW) {
            throw new IllegalStateException("Can only approve claims in UNDER_REVIEW status");
        }

        claim.setStatus(ClaimStatus.APPROVED);
        claim = claimRepository.save(claim);
        createEvent(claim.getId(), userId, EventType.APPROVED, "Claim approved");

        return claim;
    }

    @Transactional
    public Claim denyClaim(UUID claimId, UUID userId, OrgContext orgContext) {
        if (!orgContext.isAdmin()) {
            throw new SecurityException("Only admins can deny claims");
        }

        Claim claim = getClaimForOrg(claimId, orgContext);

        if (claim.getStatus() != ClaimStatus.UNDER_REVIEW) {
            throw new IllegalStateException("Can only deny claims in UNDER_REVIEW status");
        }

        claim.setStatus(ClaimStatus.DENIED);
        claim = claimRepository.save(claim);
        createEvent(claim.getId(), userId, EventType.DENIED, "Claim denied");

        return claim;
    }

    @Transactional
    public Claim closeClaim(UUID claimId, UUID userId, OrgContext orgContext) {
        Claim claim = getClaimForOrg(claimId, orgContext);

        if (claim.getStatus() != ClaimStatus.APPROVED && claim.getStatus() != ClaimStatus.DENIED) {
            throw new IllegalStateException("Can only close claims in APPROVED or DENIED status");
        }

        claim.setStatus(ClaimStatus.CLOSED);
        claim = claimRepository.save(claim);
        createEvent(claim.getId(), userId, EventType.CLOSED, "Claim closed");

        return claim;
    }

    @Transactional(readOnly = true)
    public Claim getClaim(UUID claimId, OrgContext orgContext) {
        return getClaimForOrg(claimId, orgContext);
    }

    @Transactional(readOnly = true)
    public Page<Claim> listClaims(OrgContext orgContext, Pageable pageable) {
        return claimRepository.findByOrganizationId(orgContext.getOrganizationId(), pageable);
    }

    @Transactional(readOnly = true)
    public List<Claim> listAllClaims(OrgContext orgContext) {
        return claimRepository.findByOrganizationId(orgContext.getOrganizationId());
    }

    @Transactional(readOnly = true)
    public List<ClaimEvent> getClaimEvents(UUID claimId, OrgContext orgContext) {
        // Verify the claim belongs to the org
        getClaimForOrg(claimId, orgContext);
        return claimEventRepository.findByClaimIdOrderByTimestampAsc(claimId);
    }

    @Transactional(readOnly = true)
    public ClaimStatsResponse getClaimStats(OrgContext orgContext) {
        UUID orgId = orgContext.getOrganizationId();
        ClaimStatsResponse stats = new ClaimStatsResponse();

        long total = claimRepository.countByOrganizationId(orgId);
        stats.setTotalClaims(total);

        // Open claims = not CLOSED and not DENIED
        long closedCount = claimRepository.countByOrganizationIdAndStatus(orgId, ClaimStatus.CLOSED);
        long deniedCount = claimRepository.countByOrganizationIdAndStatus(orgId, ClaimStatus.DENIED);
        stats.setOpenClaims(total - closedCount - deniedCount);

        // Claims by status
        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (ClaimStatus s : ClaimStatus.values()) {
            byStatus.put(s.name(), claimRepository.countByOrganizationIdAndStatus(orgId, s));
        }
        stats.setClaimsByStatus(byStatus);

        // Claims by type - compute from all claims
        List<Claim> allClaims = claimRepository.findByOrganizationId(orgId);
        Map<String, Long> byType = new LinkedHashMap<>();
        for (ClaimType t : ClaimType.values()) {
            byType.put(t.name(), allClaims.stream().filter(c -> c.getType() == t).count());
        }
        stats.setClaimsByType(byType);

        // Total exposure (sum of open claim amounts)
        BigDecimal exposure = claimRepository.sumAmountByOrganizationIdAndStatusNotIn(orgId,
                List.of(ClaimStatus.CLOSED, ClaimStatus.DENIED));
        stats.setTotalExposure(exposure);

        // Approval rate
        long approvedCount = claimRepository.countByOrganizationIdAndStatus(orgId, ClaimStatus.APPROVED);
        long decidedCount = approvedCount + deniedCount + closedCount;
        stats.setApprovalRate(decidedCount > 0 ? (double) approvedCount / decidedCount * 100.0 : 0.0);

        // Claims this week
        LocalDateTime weekAgo = LocalDateTime.now().minusDays(7);
        stats.setClaimsThisWeek(claimRepository.countByOrganizationIdAndCreatedAtAfter(orgId, weekAgo));

        // Claims by priority
        Map<String, Long> byPriority = new LinkedHashMap<>();
        byPriority.put("CRITICAL", 0L);
        byPriority.put("HIGH", 0L);
        byPriority.put("MEDIUM", 0L);
        byPriority.put("LOW", 0L);
        for (Claim c : allClaims) {
            String priority = PriorityCalculator.calculate(c.getType(), c.getAmount(), c.getFiledDate(), c.getStatus()).priority();
            byPriority.merge(priority, 1L, Long::sum);
        }
        stats.setClaimsByPriority(byPriority);

        return stats;
    }

    private Claim getClaimForOrg(UUID claimId, OrgContext orgContext) {
        return claimRepository.findByIdAndOrganizationId(claimId, orgContext.getOrganizationId())
            .orElseThrow(() -> new IllegalArgumentException("Claim not found"));
    }

    private void createEvent(UUID claimId, UUID actorUserId, EventType eventType, String note) {
        createEvent(claimId, actorUserId, null, eventType, note);
    }

    private void createEvent(UUID claimId, UUID actorUserId, String actorDisplayName, EventType eventType, String note) {
        ClaimEvent event = new ClaimEvent();
        event.setClaimId(claimId);
        event.setActorUserId(actorUserId);
        event.setActorDisplayName(actorDisplayName);
        event.setEventType(eventType);
        event.setNote(note);
        claimEventRepository.save(event);
    }

    String generateClaimNumber() {
        String prefix = "CLM-" + Year.now().getValue() + "-";
        long count = claimRepository.countByClaimNumberPrefix(prefix);
        return prefix + String.format("%05d", count + 1);
    }
}
