package com.poc.claims.config;

import java.util.List;
import java.util.UUID;

/**
 * Holds the resolved organization context for the current request.
 * Set by OrgContextFilter after validating the X-Organization-Id header against the JWT.
 */
public class OrgContext {

    private final UUID organizationId;
    private final List<String> roles;

    public OrgContext(UUID organizationId, List<String> roles) {
        this.organizationId = organizationId;
        this.roles = roles;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public List<String> getRoles() {
        return roles;
    }

    public boolean hasRole(String role) {
        return roles.contains(role);
    }

    public boolean isAdmin() {
        return hasRole("admin");
    }

    public boolean isBilling() {
        return hasRole("billing");
    }

    public boolean isViewer() {
        return hasRole("viewer");
    }
}
