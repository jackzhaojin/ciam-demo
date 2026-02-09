package com.poc.claims.controller;

import com.poc.claims.config.OrgContext;
import com.poc.claims.config.OrgContextFilter;
import com.poc.claims.dto.*;
import com.poc.claims.model.Claim;
import com.poc.claims.model.ClaimAttachment;
import com.poc.claims.model.ClaimEvent;
import com.poc.claims.model.ClaimNote;
import com.poc.claims.model.ClaimStatus;
import com.poc.claims.service.ClaimAttachmentService;
import com.poc.claims.service.ClaimNoteService;
import com.poc.claims.service.ClaimService;
import com.poc.claims.service.RiskSignalService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/claims")
public class ClaimController {

    private final ClaimService claimService;
    private final ClaimNoteService claimNoteService;
    private final ClaimAttachmentService claimAttachmentService;
    private final RiskSignalService riskSignalService;

    public ClaimController(ClaimService claimService,
                           ClaimNoteService claimNoteService,
                           ClaimAttachmentService claimAttachmentService,
                           RiskSignalService riskSignalService) {
        this.claimService = claimService;
        this.claimNoteService = claimNoteService;
        this.claimAttachmentService = claimAttachmentService;
        this.riskSignalService = riskSignalService;
    }

    @PostMapping
    public ResponseEntity<ClaimResponse> createClaim(
            @Valid @RequestBody CreateClaimRequest request,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest httpRequest) {
        OrgContext orgContext = getOrgContext(httpRequest);
        UUID userId = extractUserId(jwt);

        Claim claim = claimService.createClaim(request, userId, orgContext);
        return ResponseEntity.status(HttpStatus.CREATED).body(ClaimResponse.fromEntity(claim));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ClaimResponse> updateClaim(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateClaimRequest request,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest httpRequest) {
        OrgContext orgContext = getOrgContext(httpRequest);
        UUID userId = extractUserId(jwt);

        Claim claim = claimService.updateClaim(id, request, userId, orgContext);
        return ResponseEntity.ok(ClaimResponse.fromEntity(claim));
    }

    @GetMapping
    public ResponseEntity<Page<ClaimResponse>> listClaims(
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20) Pageable pageable,
            HttpServletRequest httpRequest) {
        OrgContext orgContext = getOrgContext(httpRequest);

        ClaimStatus claimStatus = null;
        if (status != null && !status.isEmpty()) {
            claimStatus = ClaimStatus.valueOf(status);
        }

        Page<ClaimResponse> claims = claimService.listClaims(orgContext, claimStatus, pageable)
            .map(ClaimResponse::fromEntity);
        return ResponseEntity.ok(claims);
    }

    @GetMapping("/stats")
    public ResponseEntity<ClaimStatsResponse> getClaimStats(HttpServletRequest httpRequest) {
        OrgContext orgContext = getOrgContext(httpRequest);
        return ResponseEntity.ok(claimService.getClaimStats(orgContext));
    }

    @GetMapping("/export")
    public void exportClaims(HttpServletRequest httpRequest, HttpServletResponse response) throws IOException {
        OrgContext orgContext = getOrgContext(httpRequest);
        List<Claim> claims = claimService.listAllClaims(orgContext);

        response.setContentType("text/csv");
        response.setHeader("Content-Disposition", "attachment; filename=\"claims-export.csv\"");

        PrintWriter writer = response.getWriter();
        writer.println("Claim Number,Type,Status,Amount,Incident Date,Filed Date,Priority");
        for (Claim claim : claims) {
            var pr = com.poc.claims.service.PriorityCalculator.calculate(
                    claim.getType(), claim.getAmount(), claim.getFiledDate(), claim.getStatus());
            writer.printf("%s,%s,%s,%s,%s,%s,%s%n",
                    claim.getClaimNumber(),
                    claim.getType(),
                    claim.getStatus(),
                    claim.getAmount() != null ? claim.getAmount().toPlainString() : "",
                    claim.getIncidentDate() != null ? claim.getIncidentDate().toString() : "",
                    claim.getFiledDate() != null ? claim.getFiledDate().toString() : "",
                    pr.priority());
        }
        writer.flush();
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClaimResponse> getClaim(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {
        OrgContext orgContext = getOrgContext(httpRequest);

        Claim claim = claimService.getClaim(id, orgContext);
        return ResponseEntity.ok(ClaimResponse.fromEntity(claim));
    }

    @PostMapping("/{id}/submit")
    public ResponseEntity<ClaimResponse> submitClaim(
            @PathVariable UUID id,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest httpRequest) {
        OrgContext orgContext = getOrgContext(httpRequest);
        UUID userId = extractUserId(jwt);

        Claim claim = claimService.submitClaim(id, userId, orgContext);
        return ResponseEntity.ok(ClaimResponse.fromEntity(claim));
    }

    @PostMapping("/{id}/review")
    public ResponseEntity<ClaimResponse> reviewClaim(
            @PathVariable UUID id,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest httpRequest) {
        OrgContext orgContext = getOrgContext(httpRequest);
        UUID userId = extractUserId(jwt);

        Claim claim = claimService.reviewClaim(id, userId, orgContext);
        return ResponseEntity.ok(ClaimResponse.fromEntity(claim));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<ClaimResponse> approveClaim(
            @PathVariable UUID id,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest httpRequest) {
        OrgContext orgContext = getOrgContext(httpRequest);
        UUID userId = extractUserId(jwt);

        Claim claim = claimService.approveClaim(id, userId, orgContext);
        return ResponseEntity.ok(ClaimResponse.fromEntity(claim));
    }

    @PostMapping("/{id}/deny")
    public ResponseEntity<ClaimResponse> denyClaim(
            @PathVariable UUID id,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest httpRequest) {
        OrgContext orgContext = getOrgContext(httpRequest);
        UUID userId = extractUserId(jwt);

        Claim claim = claimService.denyClaim(id, userId, orgContext);
        return ResponseEntity.ok(ClaimResponse.fromEntity(claim));
    }

    @PostMapping("/{id}/close")
    public ResponseEntity<ClaimResponse> closeClaim(
            @PathVariable UUID id,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest httpRequest) {
        OrgContext orgContext = getOrgContext(httpRequest);
        UUID userId = extractUserId(jwt);

        Claim claim = claimService.closeClaim(id, userId, orgContext);
        return ResponseEntity.ok(ClaimResponse.fromEntity(claim));
    }

    @GetMapping("/{id}/events")
    public ResponseEntity<List<ClaimEventResponse>> getClaimEvents(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {
        OrgContext orgContext = getOrgContext(httpRequest);

        List<ClaimEventResponse> events = claimService.getClaimEvents(id, orgContext)
            .stream()
            .map(ClaimEventResponse::fromEntity)
            .collect(Collectors.toList());
        return ResponseEntity.ok(events);
    }

    // --- v1.2 endpoints ---

    @GetMapping("/{id}/risk-signals")
    public ResponseEntity<RiskSignalResponse> getRiskSignals(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {
        OrgContext orgContext = getOrgContext(httpRequest);
        Claim claim = claimService.getClaim(id, orgContext);
        return ResponseEntity.ok(riskSignalService.assessRisk(claim, orgContext.getOrganizationId()));
    }

    @GetMapping("/{id}/notes")
    public ResponseEntity<List<ClaimNoteResponse>> getClaimNotes(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {
        OrgContext orgContext = getOrgContext(httpRequest);
        List<ClaimNoteResponse> notes = claimNoteService.getNotes(id, orgContext)
                .stream()
                .map(ClaimNoteResponse::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(notes);
    }

    @PostMapping("/{id}/notes")
    public ResponseEntity<ClaimNoteResponse> addClaimNote(
            @PathVariable UUID id,
            @Valid @RequestBody CreateNoteRequest request,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest httpRequest) {
        OrgContext orgContext = getOrgContext(httpRequest);
        UUID userId = extractUserId(jwt);
        String displayName = extractDisplayName(jwt);

        ClaimNote note = claimNoteService.addNote(id, userId, displayName, request.getContent(), orgContext);
        return ResponseEntity.status(HttpStatus.CREATED).body(ClaimNoteResponse.fromEntity(note));
    }

    @GetMapping("/{id}/attachments")
    public ResponseEntity<List<ClaimAttachmentResponse>> getClaimAttachments(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {
        OrgContext orgContext = getOrgContext(httpRequest);
        List<ClaimAttachmentResponse> attachments = claimAttachmentService.getAttachments(id, orgContext)
                .stream()
                .map(ClaimAttachmentResponse::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(attachments);
    }

    @PostMapping("/{id}/attachments")
    public ResponseEntity<ClaimAttachmentResponse> addClaimAttachment(
            @PathVariable UUID id,
            @Valid @RequestBody CreateAttachmentRequest request,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest httpRequest) {
        OrgContext orgContext = getOrgContext(httpRequest);
        UUID userId = extractUserId(jwt);
        String displayName = extractDisplayName(jwt);

        ClaimAttachment attachment = claimAttachmentService.addAttachment(
                id, userId, displayName,
                request.getFilename(), request.getFileSizeBytes(), request.getMimeType(),
                orgContext);
        return ResponseEntity.status(HttpStatus.CREATED).body(ClaimAttachmentResponse.fromEntity(attachment));
    }

    @DeleteMapping("/{id}/attachments/{attachmentId}")
    public ResponseEntity<Void> deleteClaimAttachment(
            @PathVariable UUID id,
            @PathVariable UUID attachmentId,
            HttpServletRequest httpRequest) {
        OrgContext orgContext = getOrgContext(httpRequest);
        claimAttachmentService.deleteAttachment(id, attachmentId, orgContext);
        return ResponseEntity.noContent().build();
    }

    private OrgContext getOrgContext(HttpServletRequest request) {
        OrgContext orgContext = (OrgContext) request.getAttribute(OrgContextFilter.ORG_CONTEXT_ATTRIBUTE);
        if (orgContext == null) {
            throw new IllegalStateException("Organization context not available");
        }
        return orgContext;
    }

    /**
     * Extract a stable user UUID from the JWT.
     * Phase Two hosted Keycloak does not include the standard "sub" claim,
     * so we derive a deterministic UUID from the user's email address.
     */
    private UUID extractUserId(Jwt jwt) {
        String sub = jwt.getSubject();
        if (sub != null) {
            return UUID.fromString(sub);
        }
        // Fallback: deterministic UUID from email (Phase Two tokens lack "sub")
        String email = jwt.getClaimAsString("email");
        if (email == null) {
            throw new IllegalStateException("JWT has neither 'sub' nor 'email' claim");
        }
        return UUID.nameUUIDFromBytes(email.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private String extractDisplayName(Jwt jwt) {
        String name = jwt.getClaimAsString("name");
        if (name != null) return name;
        String email = jwt.getClaimAsString("email");
        if (email != null) return email;
        return "Unknown";
    }
}
