package com.poc.claims.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class OrgContextFilter extends OncePerRequestFilter {

    public static final String ORG_CONTEXT_ATTRIBUTE = "orgContext";
    public static final String ORG_HEADER = "X-Organization-Id";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {

        // Skip for public endpoints
        String path = request.getRequestURI();
        if (path.equals("/api/health") || request.getMethod().equals("OPTIONS")) {
            filterChain.doFilter(request, response);
            return;
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        // Only process if we have a JWT authentication
        if (authentication instanceof JwtAuthenticationToken jwtAuth) {
            String orgIdHeader = request.getHeader(ORG_HEADER);

            if (orgIdHeader == null || orgIdHeader.isBlank()) {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                response.setContentType("application/json");
                response.getWriter().write("{\"error\":\"X-Organization-Id header is required\"}");
                return;
            }

            Jwt jwt = jwtAuth.getToken();
            List<String> roles = JwtAuthConverter.getOrgRoles(jwt, orgIdHeader);

            if (roles.isEmpty() && !JwtAuthConverter.isMemberOfOrg(jwt, orgIdHeader)) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setContentType("application/json");
                response.getWriter().write("{\"error\":\"User is not a member of the requested organization\"}");
                return;
            }

            OrgContext orgContext = new OrgContext(
                java.util.UUID.fromString(orgIdHeader),
                roles
            );
            request.setAttribute(ORG_CONTEXT_ATTRIBUTE, orgContext);
        }

        filterChain.doFilter(request, response);
    }
}
