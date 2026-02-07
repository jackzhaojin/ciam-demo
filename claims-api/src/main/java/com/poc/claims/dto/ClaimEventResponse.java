package com.poc.claims.dto;

import com.poc.claims.model.ClaimEvent;
import com.poc.claims.model.EventType;

import java.time.LocalDateTime;
import java.util.UUID;

public class ClaimEventResponse {

    private UUID id;
    private UUID claimId;
    private UUID actorUserId;
    private EventType eventType;
    private String note;
    private LocalDateTime timestamp;

    public ClaimEventResponse() {}

    public static ClaimEventResponse fromEntity(ClaimEvent event) {
        ClaimEventResponse response = new ClaimEventResponse();
        response.setId(event.getId());
        response.setClaimId(event.getClaimId());
        response.setActorUserId(event.getActorUserId());
        response.setEventType(event.getEventType());
        response.setNote(event.getNote());
        response.setTimestamp(event.getTimestamp());
        return response;
    }

    // Getters and setters

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getClaimId() { return claimId; }
    public void setClaimId(UUID claimId) { this.claimId = claimId; }

    public UUID getActorUserId() { return actorUserId; }
    public void setActorUserId(UUID actorUserId) { this.actorUserId = actorUserId; }

    public EventType getEventType() { return eventType; }
    public void setEventType(EventType eventType) { this.eventType = eventType; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
}
