package com.poc.claims.dto;

import com.poc.claims.model.Claim;
import com.poc.claims.model.ClaimStatus;
import com.poc.claims.model.ClaimType;
import com.poc.claims.service.PriorityCalculator;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public class ClaimResponse {

    private UUID id;
    private String claimNumber;
    private UUID userId;
    private UUID organizationId;
    private ClaimStatus status;
    private ClaimType type;
    private String description;
    private LocalDate incidentDate;
    private LocalDateTime filedDate;
    private BigDecimal amount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String priority;
    private int priorityScore;

    public ClaimResponse() {}

    public static ClaimResponse fromEntity(Claim claim) {
        ClaimResponse response = new ClaimResponse();
        response.setId(claim.getId());
        response.setClaimNumber(claim.getClaimNumber());
        response.setUserId(claim.getUserId());
        response.setOrganizationId(claim.getOrganizationId());
        response.setStatus(claim.getStatus());
        response.setType(claim.getType());
        response.setDescription(claim.getDescription());
        response.setIncidentDate(claim.getIncidentDate());
        response.setFiledDate(claim.getFiledDate());
        response.setAmount(claim.getAmount());
        response.setCreatedAt(claim.getCreatedAt());
        response.setUpdatedAt(claim.getUpdatedAt());

        PriorityCalculator.PriorityResult pr = PriorityCalculator.calculate(
                claim.getType(), claim.getAmount(), claim.getFiledDate(), claim.getStatus());
        response.setPriority(pr.priority());
        response.setPriorityScore(pr.score());

        return response;
    }

    // Getters and setters

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getClaimNumber() { return claimNumber; }
    public void setClaimNumber(String claimNumber) { this.claimNumber = claimNumber; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public UUID getOrganizationId() { return organizationId; }
    public void setOrganizationId(UUID organizationId) { this.organizationId = organizationId; }

    public ClaimStatus getStatus() { return status; }
    public void setStatus(ClaimStatus status) { this.status = status; }

    public ClaimType getType() { return type; }
    public void setType(ClaimType type) { this.type = type; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDate getIncidentDate() { return incidentDate; }
    public void setIncidentDate(LocalDate incidentDate) { this.incidentDate = incidentDate; }

    public LocalDateTime getFiledDate() { return filedDate; }
    public void setFiledDate(LocalDateTime filedDate) { this.filedDate = filedDate; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public int getPriorityScore() { return priorityScore; }
    public void setPriorityScore(int priorityScore) { this.priorityScore = priorityScore; }
}
