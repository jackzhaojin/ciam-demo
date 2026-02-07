package com.poc.claims.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.poc.claims.dto.CreateClaimRequest;
import com.poc.claims.dto.UpdateClaimRequest;
import com.poc.claims.model.ClaimType;
import com.poc.claims.TestSecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class ClaimControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private static final String ORG_ID = "00000000-0000-0000-0000-000000000001";
    private static final String USER_ID = "00000000-0000-0000-0000-000000000099";

    @Test
    void healthEndpoint_shouldBePublic() throws Exception {
        mockMvc.perform(get("/api/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void createClaim_shouldReturn201() throws Exception {
        CreateClaimRequest request = new CreateClaimRequest();
        request.setType(ClaimType.AUTO);
        request.setDescription("Fender bender");
        request.setAmount(new BigDecimal("2500.00"));
        request.setIncidentDate(LocalDate.of(2026, 1, 10));

        mockMvc.perform(post("/api/claims")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.claimNumber").isNotEmpty())
            .andExpect(jsonPath("$.status").value("DRAFT"))
            .andExpect(jsonPath("$.type").value("AUTO"))
            .andExpect(jsonPath("$.description").value("Fender bender"))
            .andExpect(jsonPath("$.organizationId").value(ORG_ID));
    }

    @Test
    void fullClaimLifecycle_draftToApprovedToClosed() throws Exception {
        // Create
        CreateClaimRequest createReq = new CreateClaimRequest();
        createReq.setType(ClaimType.PROPERTY);
        createReq.setDescription("Water damage");
        createReq.setAmount(new BigDecimal("10000.00"));

        MvcResult createResult = mockMvc.perform(post("/api/claims")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID, List.of("admin", "billing"))))
                .header("X-Organization-Id", ORG_ID)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createReq)))
            .andExpect(status().isCreated())
            .andReturn();

        String claimId = objectMapper.readTree(createResult.getResponse().getContentAsString())
            .get("id").asText();

        // Submit
        mockMvc.perform(post("/api/claims/" + claimId + "/submit")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID, List.of("admin", "billing"))))
                .header("X-Organization-Id", ORG_ID))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("SUBMITTED"));

        // Review
        mockMvc.perform(post("/api/claims/" + claimId + "/review")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID, List.of("admin", "billing"))))
                .header("X-Organization-Id", ORG_ID))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("UNDER_REVIEW"));

        // Approve
        mockMvc.perform(post("/api/claims/" + claimId + "/approve")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID, List.of("admin", "billing"))))
                .header("X-Organization-Id", ORG_ID))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("APPROVED"));

        // Get events
        mockMvc.perform(get("/api/claims/" + claimId + "/events")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID, List.of("admin", "billing"))))
                .header("X-Organization-Id", ORG_ID))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(4))); // CREATED, SUBMITTED, REVIEWED, APPROVED
    }

    @Test
    void listClaims_shouldReturnPaginated() throws Exception {
        // Create a claim first
        CreateClaimRequest req = new CreateClaimRequest();
        req.setType(ClaimType.HEALTH);

        mockMvc.perform(post("/api/claims")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isCreated());

        mockMvc.perform(get("/api/claims")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content").isArray())
            .andExpect(jsonPath("$.totalElements").isNumber());
    }

    @Test
    void updateClaim_shouldOnlyWorkForDraft() throws Exception {
        // Create a claim
        CreateClaimRequest createReq = new CreateClaimRequest();
        createReq.setType(ClaimType.LIABILITY);
        createReq.setDescription("Original");

        MvcResult result = mockMvc.perform(post("/api/claims")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createReq)))
            .andExpect(status().isCreated())
            .andReturn();

        String claimId = objectMapper.readTree(result.getResponse().getContentAsString())
            .get("id").asText();

        // Update should work for draft
        UpdateClaimRequest updateReq = new UpdateClaimRequest();
        updateReq.setDescription("Updated description");

        mockMvc.perform(put("/api/claims/" + claimId)
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateReq)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.description").value("Updated description"));

        // Submit the claim
        mockMvc.perform(post("/api/claims/" + claimId + "/submit")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID))
            .andExpect(status().isOk());

        // Update should fail for submitted claim
        mockMvc.perform(put("/api/claims/" + claimId)
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateReq)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void denyClaim_shouldAllowClosingAfterDenial() throws Exception {
        // Create -> Submit -> Review -> Deny -> Close
        CreateClaimRequest createReq = new CreateClaimRequest();
        createReq.setType(ClaimType.AUTO);

        MvcResult result = mockMvc.perform(post("/api/claims")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createReq)))
            .andExpect(status().isCreated())
            .andReturn();

        String claimId = objectMapper.readTree(result.getResponse().getContentAsString())
            .get("id").asText();

        // Submit
        mockMvc.perform(post("/api/claims/" + claimId + "/submit")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID))
            .andExpect(status().isOk());

        // Review
        mockMvc.perform(post("/api/claims/" + claimId + "/review")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID))
            .andExpect(status().isOk());

        // Deny
        mockMvc.perform(post("/api/claims/" + claimId + "/deny")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("DENIED"));
    }

    private org.springframework.security.oauth2.jwt.Jwt buildJwt(String sub, String orgId, List<String> roles) {
        Map<String, Object> orgData = new HashMap<>();
        orgData.put("id", orgId);
        orgData.put("name", "Test Org");
        orgData.put("roles", roles);

        Map<String, Object> organizations = new HashMap<>();
        organizations.put("test-org", orgData);

        return org.springframework.security.oauth2.jwt.Jwt.withTokenValue("mock-token")
            .header("alg", "RS256")
            .subject(sub)
            .claim("email", "test@example.com")
            .claim("loyalty_tier", "gold")
            .claim("organizations", organizations)
            .build();
    }
}
