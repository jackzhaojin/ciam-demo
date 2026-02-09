package com.poc.claims.dto;

import com.poc.claims.model.ClaimNote;

import java.time.LocalDateTime;
import java.util.UUID;

public class ClaimNoteResponse {

    private UUID id;
    private UUID claimId;
    private UUID authorUserId;
    private String authorDisplayName;
    private String content;
    private LocalDateTime createdAt;

    public ClaimNoteResponse() {}

    public static ClaimNoteResponse fromEntity(ClaimNote note) {
        ClaimNoteResponse response = new ClaimNoteResponse();
        response.setId(note.getId());
        response.setClaimId(note.getClaimId());
        response.setAuthorUserId(note.getAuthorUserId());
        response.setAuthorDisplayName(note.getAuthorDisplayName());
        response.setContent(note.getContent());
        response.setCreatedAt(note.getCreatedAt());
        return response;
    }

    // Getters and setters

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getClaimId() { return claimId; }
    public void setClaimId(UUID claimId) { this.claimId = claimId; }

    public UUID getAuthorUserId() { return authorUserId; }
    public void setAuthorUserId(UUID authorUserId) { this.authorUserId = authorUserId; }

    public String getAuthorDisplayName() { return authorDisplayName; }
    public void setAuthorDisplayName(String authorDisplayName) { this.authorDisplayName = authorDisplayName; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
