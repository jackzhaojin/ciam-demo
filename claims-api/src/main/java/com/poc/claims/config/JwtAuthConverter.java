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
 * CONCEPTUAL token structure (from CIAM spec 2.4.6):
 * {
 *   "sub": "user-uuid",
 *   "email": "jane@example.com",
 *   "loyalty_tier": "gold",
 *   "organizations": {
 *     "acme-corp": {
 *       "id": "org-uuid",
 *       "name": "Acme Corporation",
 *       "roles": ["admin", "billing"]
 *     }
 *   }
 * }
 *
 * This will need to be adapted once the actual token structure is verified.
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
        Map<String, Object> organizations = jwt.getClaimAsMap("organizations");
        if (organizations != null) {
            for (Map.Entry<String, Object> entry : organizations.entrySet()) {
                if (entry.getValue() instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> orgData = (Map<String, Object>) entry.getValue();
                    Object rolesObj = orgData.get("roles");
                    if (rolesObj instanceof Collection) {
                        @SuppressWarnings("unchecked")
                        Collection<String> roles = (Collection<String>) rolesObj;
                        String orgId = (String) orgData.get("id");
                        for (String role : roles) {
                            // Add org-scoped role: ORG_<orgId>_ROLE_<role>
                            if (orgId != null) {
                                authorities.add(new SimpleGrantedAuthority(
                                    "ORG_" + orgId + "_ROLE_" + role.toUpperCase()));
                            }
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
     * Returns the roles list or empty list if user is not a member.
     */
    @SuppressWarnings("unchecked")
    public static List<String> getOrgRoles(Jwt jwt, String organizationId) {
        Map<String, Object> organizations = jwt.getClaimAsMap("organizations");
        if (organizations == null) return Collections.emptyList();

        for (Map.Entry<String, Object> entry : organizations.entrySet()) {
            if (entry.getValue() instanceof Map) {
                Map<String, Object> orgData = (Map<String, Object>) entry.getValue();
                String orgId = (String) orgData.get("id");
                if (organizationId.equals(orgId)) {
                    Object rolesObj = orgData.get("roles");
                    if (rolesObj instanceof Collection) {
                        return new ArrayList<>((Collection<String>) rolesObj);
                    }
                }
            }
        }
        return Collections.emptyList();
    }

    /**
     * Checks if the user belongs to the given organization (by org UUID).
     */
    @SuppressWarnings("unchecked")
    public static boolean isMemberOfOrg(Jwt jwt, String organizationId) {
        Map<String, Object> organizations = jwt.getClaimAsMap("organizations");
        if (organizations == null) return false;

        for (Map.Entry<String, Object> entry : organizations.entrySet()) {
            if (entry.getValue() instanceof Map) {
                Map<String, Object> orgData = (Map<String, Object>) entry.getValue();
                if (organizationId.equals(orgData.get("id"))) {
                    return true;
                }
            }
        }
        return false;
    }
}
