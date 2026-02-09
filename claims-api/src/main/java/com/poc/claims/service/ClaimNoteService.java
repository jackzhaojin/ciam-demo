package com.poc.claims.service;

import com.poc.claims.config.OrgContext;
import com.poc.claims.model.ClaimNote;
import com.poc.claims.repository.ClaimNoteRepository;
import com.poc.claims.repository.ClaimRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class ClaimNoteService {

    private final ClaimNoteRepository claimNoteRepository;
    private final ClaimRepository claimRepository;

    public ClaimNoteService(ClaimNoteRepository claimNoteRepository, ClaimRepository claimRepository) {
        this.claimNoteRepository = claimNoteRepository;
        this.claimRepository = claimRepository;
    }

    @Transactional(readOnly = true)
    public List<ClaimNote> getNotes(UUID claimId, OrgContext orgContext) {
        // Verify claim belongs to org
        claimRepository.findByIdAndOrganizationId(claimId, orgContext.getOrganizationId())
                .orElseThrow(() -> new IllegalArgumentException("Claim not found"));
        return claimNoteRepository.findByClaimIdOrderByCreatedAtAsc(claimId);
    }

    @Transactional
    public ClaimNote addNote(UUID claimId, UUID userId, String displayName, String content, OrgContext orgContext) {
        // Verify claim belongs to org
        claimRepository.findByIdAndOrganizationId(claimId, orgContext.getOrganizationId())
                .orElseThrow(() -> new IllegalArgumentException("Claim not found"));

        ClaimNote note = new ClaimNote();
        note.setClaimId(claimId);
        note.setAuthorUserId(userId);
        note.setAuthorDisplayName(displayName);
        note.setContent(content);
        return claimNoteRepository.save(note);
    }
}
