package com.poc.claims.config;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Custom JWT authentication converter that extracts organization membership and roles
 * from the Keycloak token's "organizations" claim (Phase Two extension).
 *
 * Actual Phase Two token structure:
 * {
 *   "sub": "user-uuid",
 *   "email": "jane@example.com",
 *   "loyalty_tier": "gold",
 *   "organizations": {
 *     "<org-uuid>": {
 *       "name": "acme-corp",
 *       "roles": ["admin", "billing"]
 *     }
 *   }
 * }
 *
 * The org UUID is the MAP KEY (not a nested "id" field).
 */
@Component
public class JwtAuthConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        Collection<GrantedAuthority> authorities = extractAuthorities(jwt);
        return new JwtAuthenticationToken(jwt, authorities, jwt.getClaimAsString("email"));
    }

    private Collection<GrantedAuthority> extractAuthorities(Jwt jwt) {
        Set<GrantedAuthority> authorities = new HashSet<>();

        // Extract organization roles from the organizations claim
        // The map key IS the org UUID in the Phase Two token structure
        Map<String, Object> organizations = jwt.getClaimAsMap("organizations");
        if (organizations != null) {
            for (Map.Entry<String, Object> entry : organizations.entrySet()) {
                String orgId = entry.getKey();
                if (entry.getValue() instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> orgData = (Map<String, Object>) entry.getValue();
                    Object rolesObj = orgData.get("roles");
                    if (rolesObj instanceof Collection) {
                        @SuppressWarnings("unchecked")
                        Collection<String> roles = (Collection<String>) rolesObj;
                        for (String role : roles) {
                            // Add org-scoped role: ORG_<orgId>_ROLE_<role>
                            authorities.add(new SimpleGrantedAuthority(
                                "ORG_" + orgId + "_ROLE_" + role.toUpperCase()));
                        }
                    }
                }
            }
        }

        return authorities;
    }

    /**
     * Extracts the full organizations map from a JWT for use by the OrgContext filter.
     */
    public static Map<String, Object> extractOrganizations(Jwt jwt) {
        Map<String, Object> orgs = jwt.getClaimAsMap("organizations");
        return orgs != null ? orgs : Collections.emptyMap();
    }

    /**
     * Gets the roles for a specific organization from the token.
     * The organizationId is the map key (org UUID) in the Phase Two token.
     * Returns the roles list or empty list if user is not a member.
     */
    @SuppressWarnings("unchecked")
    public static List<String> getOrgRoles(Jwt jwt, String organizationId) {
        Map<String, Object> organizations = jwt.getClaimAsMap("organizations");
        if (organizations == null) return Collections.emptyList();

        Object orgValue = organizations.get(organizationId);
        if (orgValue instanceof Map) {
            Map<String, Object> orgData = (Map<String, Object>) orgValue;
            Object rolesObj = orgData.get("roles");
            if (rolesObj instanceof Collection) {
                return new ArrayList<>((Collection<String>) rolesObj);
            }
        }
        return Collections.emptyList();
    }

    /**
     * Checks if the user belongs to the given organization (by org UUID).
     * The organizationId is the map key in the Phase Two token.
     */
    public static boolean isMemberOfOrg(Jwt jwt, String organizationId) {
        Map<String, Object> organizations = jwt.getClaimAsMap("organizations");
        if (organizations == null) return false;

        return organizations.containsKey(organizationId);
    }
}
