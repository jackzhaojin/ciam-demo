package com.poc.claims.dto;

import com.poc.claims.model.ClaimType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;

public class CreateClaimRequest {

    @NotNull(message = "Claim type is required")
    private ClaimType type;

    private String description;

    private LocalDate incidentDate;

    @Positive(message = "Amount must be positive")
    private BigDecimal amount;

    public CreateClaimRequest() {}

    public ClaimType getType() { return type; }
    public void setType(ClaimType type) { this.type = type; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDate getIncidentDate() { return incidentDate; }
    public void setIncidentDate(LocalDate incidentDate) { this.incidentDate = incidentDate; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
}
