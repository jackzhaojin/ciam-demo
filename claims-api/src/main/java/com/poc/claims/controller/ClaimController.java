package com.poc.claims.controller;

import com.poc.claims.config.OrgContext;
import com.poc.claims.config.OrgContextFilter;
import com.poc.claims.dto.*;
import com.poc.claims.model.Claim;
import com.poc.claims.model.ClaimEvent;
import com.poc.claims.service.ClaimService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/claims")
public class ClaimController {

    private final ClaimService claimService;

    public ClaimController(ClaimService claimService) {
        this.claimService = claimService;
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
            @PageableDefault(size = 20) Pageable pageable,
            HttpServletRequest httpRequest) {
        OrgContext orgContext = getOrgContext(httpRequest);

        Page<ClaimResponse> claims = claimService.listClaims(orgContext, pageable)
            .map(ClaimResponse::fromEntity);
        return ResponseEntity.ok(claims);
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
}
