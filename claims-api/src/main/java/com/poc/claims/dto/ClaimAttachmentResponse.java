package com.poc.claims.dto;

import com.poc.claims.model.ClaimAttachment;

import java.time.LocalDateTime;
import java.util.UUID;

public class ClaimAttachmentResponse {

    private UUID id;
    private UUID claimId;
    private String filename;
    private long fileSizeBytes;
    private String mimeType;
    private UUID uploadedByUserId;
    private String uploadedByDisplayName;
    private LocalDateTime createdAt;

    public ClaimAttachmentResponse() {}

    public static ClaimAttachmentResponse fromEntity(ClaimAttachment attachment) {
        ClaimAttachmentResponse response = new ClaimAttachmentResponse();
        response.setId(attachment.getId());
        response.setClaimId(attachment.getClaimId());
        response.setFilename(attachment.getFilename());
        response.setFileSizeBytes(attachment.getFileSizeBytes());
        response.setMimeType(attachment.getMimeType());
        response.setUploadedByUserId(attachment.getUploadedByUserId());
        response.setUploadedByDisplayName(attachment.getUploadedByDisplayName());
        response.setCreatedAt(attachment.getCreatedAt());
        return response;
    }

    // Getters and setters

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getClaimId() { return claimId; }
    public void setClaimId(UUID claimId) { this.claimId = claimId; }

    public String getFilename() { return filename; }
    public void setFilename(String filename) { this.filename = filename; }

    public long getFileSizeBytes() { return fileSizeBytes; }
    public void setFileSizeBytes(long fileSizeBytes) { this.fileSizeBytes = fileSizeBytes; }

    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }

    public UUID getUploadedByUserId() { return uploadedByUserId; }
    public void setUploadedByUserId(UUID uploadedByUserId) { this.uploadedByUserId = uploadedByUserId; }

    public String getUploadedByDisplayName() { return uploadedByDisplayName; }
    public void setUploadedByDisplayName(String uploadedByDisplayName) { this.uploadedByDisplayName = uploadedByDisplayName; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
