package com.poc.claims.service;

import com.poc.claims.config.OrgContext;
import com.poc.claims.model.ClaimAttachment;
import com.poc.claims.repository.ClaimAttachmentRepository;
import com.poc.claims.repository.ClaimRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class ClaimAttachmentService {

    private final ClaimAttachmentRepository claimAttachmentRepository;
    private final ClaimRepository claimRepository;

    public ClaimAttachmentService(ClaimAttachmentRepository claimAttachmentRepository, ClaimRepository claimRepository) {
        this.claimAttachmentRepository = claimAttachmentRepository;
        this.claimRepository = claimRepository;
    }

    @Transactional(readOnly = true)
    public List<ClaimAttachment> getAttachments(UUID claimId, OrgContext orgContext) {
        claimRepository.findByIdAndOrganizationId(claimId, orgContext.getOrganizationId())
                .orElseThrow(() -> new IllegalArgumentException("Claim not found"));
        return claimAttachmentRepository.findByClaimIdOrderByCreatedAtDesc(claimId);
    }

    @Transactional
    public ClaimAttachment addAttachment(UUID claimId, UUID userId, String displayName,
                                          String filename, long fileSizeBytes, String mimeType,
                                          OrgContext orgContext) {
        claimRepository.findByIdAndOrganizationId(claimId, orgContext.getOrganizationId())
                .orElseThrow(() -> new IllegalArgumentException("Claim not found"));

        ClaimAttachment attachment = new ClaimAttachment();
        attachment.setClaimId(claimId);
        attachment.setFilename(filename);
        attachment.setFileSizeBytes(fileSizeBytes);
        attachment.setMimeType(mimeType);
        attachment.setUploadedByUserId(userId);
        attachment.setUploadedByDisplayName(displayName);
        return claimAttachmentRepository.save(attachment);
    }

    @Transactional
    public void deleteAttachment(UUID claimId, UUID attachmentId, OrgContext orgContext) {
        claimRepository.findByIdAndOrganizationId(claimId, orgContext.getOrganizationId())
                .orElseThrow(() -> new IllegalArgumentException("Claim not found"));
        ClaimAttachment attachment = claimAttachmentRepository.findByIdAndClaimId(attachmentId, claimId)
                .orElseThrow(() -> new IllegalArgumentException("Attachment not found"));
        claimAttachmentRepository.delete(attachment);
    }
}
