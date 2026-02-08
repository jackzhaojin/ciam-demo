package com.poc.claims.service;

import com.poc.claims.config.OrgContext;
import com.poc.claims.dto.CreateClaimRequest;
import com.poc.claims.dto.UpdateClaimRequest;
import com.poc.claims.model.*;
import com.poc.claims.repository.ClaimEventRepository;
import com.poc.claims.repository.ClaimRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ClaimServiceTest {

    @Mock
    private ClaimRepository claimRepository;

    @Mock
    private ClaimEventRepository claimEventRepository;

    @InjectMocks
    private ClaimService claimService;

    private UUID userId;
    private UUID orgId;
    private OrgContext adminContext;
    private OrgContext viewerContext;
    private OrgContext billingContext;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        orgId = UUID.randomUUID();
        adminContext = new OrgContext(orgId, List.of("admin", "billing"));
        viewerContext = new OrgContext(orgId, List.of("viewer"));
        billingContext = new OrgContext(orgId, List.of("billing"));
    }

    @Test
    void createClaim_shouldSetDraftStatusAndGenerateClaimNumber() {
        CreateClaimRequest request = new CreateClaimRequest();
        request.setType(ClaimType.AUTO);
        request.setDescription("Car accident");
        request.setAmount(new BigDecimal("5000.00"));
        request.setIncidentDate(LocalDate.of(2026, 1, 15));

        when(claimRepository.countByClaimNumberPrefix(anyString())).thenReturn(0L);
        when(claimRepository.save(any(Claim.class))).thenAnswer(inv -> inv.getArgument(0));
        when(claimEventRepository.save(any(ClaimEvent.class))).thenAnswer(inv -> inv.getArgument(0));

        Claim result = claimService.createClaim(request, userId, adminContext);

        assertThat(result.getStatus()).isEqualTo(ClaimStatus.DRAFT);
        assertThat(result.getClaimNumber()).startsWith("CLM-");
        assertThat(result.getClaimNumber()).endsWith("-00001");
        assertThat(result.getUserId()).isEqualTo(userId);
        assertThat(result.getOrganizationId()).isEqualTo(orgId);
        assertThat(result.getType()).isEqualTo(ClaimType.AUTO);

        verify(claimEventRepository).save(any(ClaimEvent.class));
    }

    @Test
    void createClaim_shouldIncrementClaimNumber() {
        CreateClaimRequest request = new CreateClaimRequest();
        request.setType(ClaimType.PROPERTY);

        when(claimRepository.countByClaimNumberPrefix(anyString())).thenReturn(42L);
        when(claimRepository.save(any(Claim.class))).thenAnswer(inv -> inv.getArgument(0));
        when(claimEventRepository.save(any(ClaimEvent.class))).thenAnswer(inv -> inv.getArgument(0));

        Claim result = claimService.createClaim(request, userId, adminContext);

        assertThat(result.getClaimNumber()).endsWith("-00043");
    }

    @Test
    void createClaim_shouldRejectViewerRole() {
        CreateClaimRequest request = new CreateClaimRequest();
        request.setType(ClaimType.AUTO);

        assertThatThrownBy(() -> claimService.createClaim(request, userId, viewerContext))
            .isInstanceOf(SecurityException.class)
            .hasMessageContaining("Only admins can create claims");
    }

    @Test
    void createClaim_shouldRejectBillingRole() {
        CreateClaimRequest request = new CreateClaimRequest();
        request.setType(ClaimType.AUTO);

        assertThatThrownBy(() -> claimService.createClaim(request, userId, billingContext))
            .isInstanceOf(SecurityException.class)
            .hasMessageContaining("Only admins can create claims");
    }

    @Test
    void updateClaim_shouldOnlyAllowDraftStatus() {
        Claim existing = createTestClaim(ClaimStatus.SUBMITTED);

        when(claimRepository.findByIdAndOrganizationId(existing.getId(), orgId))
            .thenReturn(Optional.of(existing));

        UpdateClaimRequest request = new UpdateClaimRequest();
        request.setDescription("Updated");

        assertThatThrownBy(() -> claimService.updateClaim(existing.getId(), request, userId, adminContext))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("DRAFT");
    }

    @Test
    void updateClaim_shouldRejectNonOwnerNonAdmin() {
        UUID otherUserId = UUID.randomUUID();
        Claim existing = createTestClaim(ClaimStatus.DRAFT);

        when(claimRepository.findByIdAndOrganizationId(existing.getId(), orgId))
            .thenReturn(Optional.of(existing));

        UpdateClaimRequest request = new UpdateClaimRequest();
        request.setDescription("Updated");

        assertThatThrownBy(() -> claimService.updateClaim(existing.getId(), request, otherUserId, viewerContext))
            .isInstanceOf(SecurityException.class)
            .hasMessageContaining("owner or an admin");
    }

    @Test
    void updateClaim_shouldAllowAdminToUpdateAnyDraftClaim() {
        UUID otherUserId = UUID.randomUUID();
        Claim existing = createTestClaim(ClaimStatus.DRAFT);

        when(claimRepository.findByIdAndOrganizationId(existing.getId(), orgId))
            .thenReturn(Optional.of(existing));
        when(claimRepository.save(any(Claim.class))).thenAnswer(inv -> inv.getArgument(0));
        when(claimEventRepository.save(any(ClaimEvent.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateClaimRequest request = new UpdateClaimRequest();
        request.setDescription("Admin updated");

        Claim result = claimService.updateClaim(existing.getId(), request, otherUserId, adminContext);
        assertThat(result.getDescription()).isEqualTo("Admin updated");
    }

    @Test
    void submitClaim_shouldTransitionFromDraftToSubmitted() {
        Claim existing = createTestClaim(ClaimStatus.DRAFT);

        when(claimRepository.findByIdAndOrganizationId(existing.getId(), orgId))
            .thenReturn(Optional.of(existing));
        when(claimRepository.save(any(Claim.class))).thenAnswer(inv -> inv.getArgument(0));
        when(claimEventRepository.save(any(ClaimEvent.class))).thenAnswer(inv -> inv.getArgument(0));

        Claim result = claimService.submitClaim(existing.getId(), userId, adminContext);
        assertThat(result.getStatus()).isEqualTo(ClaimStatus.SUBMITTED);
    }

    @Test
    void submitClaim_shouldRejectNonDraftClaim() {
        Claim existing = createTestClaim(ClaimStatus.UNDER_REVIEW);

        when(claimRepository.findByIdAndOrganizationId(existing.getId(), orgId))
            .thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> claimService.submitClaim(existing.getId(), userId, adminContext))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("DRAFT");
    }

    @Test
    void reviewClaim_shouldRequireAdminRole() {
        Claim existing = createTestClaim(ClaimStatus.SUBMITTED);

        assertThatThrownBy(() -> claimService.reviewClaim(existing.getId(), userId, viewerContext))
            .isInstanceOf(SecurityException.class)
            .hasMessageContaining("admin");
    }

    @Test
    void reviewClaim_shouldTransitionFromSubmittedToUnderReview() {
        Claim existing = createTestClaim(ClaimStatus.SUBMITTED);

        when(claimRepository.findByIdAndOrganizationId(existing.getId(), orgId))
            .thenReturn(Optional.of(existing));
        when(claimRepository.save(any(Claim.class))).thenAnswer(inv -> inv.getArgument(0));
        when(claimEventRepository.save(any(ClaimEvent.class))).thenAnswer(inv -> inv.getArgument(0));

        Claim result = claimService.reviewClaim(existing.getId(), userId, adminContext);
        assertThat(result.getStatus()).isEqualTo(ClaimStatus.UNDER_REVIEW);
    }

    @Test
    void approveClaim_shouldAllowAdminOrBilling() {
        Claim existing = createTestClaim(ClaimStatus.UNDER_REVIEW);

        when(claimRepository.findByIdAndOrganizationId(existing.getId(), orgId))
            .thenReturn(Optional.of(existing));
        when(claimRepository.save(any(Claim.class))).thenAnswer(inv -> inv.getArgument(0));
        when(claimEventRepository.save(any(ClaimEvent.class))).thenAnswer(inv -> inv.getArgument(0));

        Claim result = claimService.approveClaim(existing.getId(), userId, billingContext);
        assertThat(result.getStatus()).isEqualTo(ClaimStatus.APPROVED);
    }

    @Test
    void approveClaim_shouldRejectViewerRole() {
        Claim existing = createTestClaim(ClaimStatus.UNDER_REVIEW);

        assertThatThrownBy(() -> claimService.approveClaim(existing.getId(), userId, viewerContext))
            .isInstanceOf(SecurityException.class)
            .hasMessageContaining("admin");
    }

    @Test
    void approveClaim_shouldRejectNonUnderReviewStatus() {
        Claim existing = createTestClaim(ClaimStatus.SUBMITTED);

        when(claimRepository.findByIdAndOrganizationId(existing.getId(), orgId))
            .thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> claimService.approveClaim(existing.getId(), userId, adminContext))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("UNDER_REVIEW");
    }

    @Test
    void denyClaim_shouldRequireAdminRole() {
        Claim existing = createTestClaim(ClaimStatus.UNDER_REVIEW);

        assertThatThrownBy(() -> claimService.denyClaim(existing.getId(), userId, viewerContext))
            .isInstanceOf(SecurityException.class);
    }

    @Test
    void denyClaim_shouldTransitionFromUnderReviewToDenied() {
        Claim existing = createTestClaim(ClaimStatus.UNDER_REVIEW);

        when(claimRepository.findByIdAndOrganizationId(existing.getId(), orgId))
            .thenReturn(Optional.of(existing));
        when(claimRepository.save(any(Claim.class))).thenAnswer(inv -> inv.getArgument(0));
        when(claimEventRepository.save(any(ClaimEvent.class))).thenAnswer(inv -> inv.getArgument(0));

        Claim result = claimService.denyClaim(existing.getId(), userId, adminContext);
        assertThat(result.getStatus()).isEqualTo(ClaimStatus.DENIED);
    }

    @Test
    void closeClaim_shouldAllowFromApprovedOrDenied() {
        Claim approved = createTestClaim(ClaimStatus.APPROVED);
        when(claimRepository.findByIdAndOrganizationId(approved.getId(), orgId))
            .thenReturn(Optional.of(approved));
        when(claimRepository.save(any(Claim.class))).thenAnswer(inv -> inv.getArgument(0));
        when(claimEventRepository.save(any(ClaimEvent.class))).thenAnswer(inv -> inv.getArgument(0));

        Claim result = claimService.closeClaim(approved.getId(), userId, adminContext);
        assertThat(result.getStatus()).isEqualTo(ClaimStatus.CLOSED);
    }

    @Test
    void closeClaim_shouldRejectFromDraftStatus() {
        Claim draft = createTestClaim(ClaimStatus.DRAFT);

        when(claimRepository.findByIdAndOrganizationId(draft.getId(), orgId))
            .thenReturn(Optional.of(draft));

        assertThatThrownBy(() -> claimService.closeClaim(draft.getId(), userId, adminContext))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("APPROVED or DENIED");
    }

    @Test
    void getClaim_shouldThrowWhenNotFound() {
        UUID claimId = UUID.randomUUID();
        when(claimRepository.findByIdAndOrganizationId(claimId, orgId))
            .thenReturn(Optional.empty());

        assertThatThrownBy(() -> claimService.getClaim(claimId, adminContext))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("not found");
    }

    @Test
    void generateClaimNumber_shouldFormatCorrectly() {
        when(claimRepository.countByClaimNumberPrefix(anyString())).thenReturn(0L);
        String number = claimService.generateClaimNumber();
        assertThat(number).matches("CLM-\\d{4}-\\d{5}");
    }

    @Test
    void createEvent_shouldBeSavedOnStateTransition() {
        Claim existing = createTestClaim(ClaimStatus.DRAFT);
        when(claimRepository.findByIdAndOrganizationId(existing.getId(), orgId))
            .thenReturn(Optional.of(existing));
        when(claimRepository.save(any(Claim.class))).thenAnswer(inv -> inv.getArgument(0));
        when(claimEventRepository.save(any(ClaimEvent.class))).thenAnswer(inv -> inv.getArgument(0));

        claimService.submitClaim(existing.getId(), userId, adminContext);

        ArgumentCaptor<ClaimEvent> captor = ArgumentCaptor.forClass(ClaimEvent.class);
        verify(claimEventRepository).save(captor.capture());
        ClaimEvent event = captor.getValue();
        assertThat(event.getEventType()).isEqualTo(EventType.SUBMITTED);
        assertThat(event.getActorUserId()).isEqualTo(userId);
        assertThat(event.getClaimId()).isEqualTo(existing.getId());
    }

    private Claim createTestClaim(ClaimStatus status) {
        Claim claim = new Claim();
        claim.setId(UUID.randomUUID());
        claim.setClaimNumber("CLM-2026-00001");
        claim.setUserId(userId);
        claim.setOrganizationId(orgId);
        claim.setStatus(status);
        claim.setType(ClaimType.AUTO);
        claim.setDescription("Test claim");
        claim.setAmount(new BigDecimal("1000.00"));
        return claim;
    }
}
