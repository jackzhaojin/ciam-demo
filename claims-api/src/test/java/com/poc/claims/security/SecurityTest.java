package com.poc.claims.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.poc.claims.TestSecurityConfig;
import com.poc.claims.dto.CreateClaimRequest;
import com.poc.claims.model.ClaimType;
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
import java.util.*;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class SecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private static final String ORG_ID_1 = "00000000-0000-0000-0000-000000000001";
    private static final String ORG_ID_2 = "00000000-0000-0000-0000-000000000002";
    private static final String USER_ID = "00000000-0000-0000-0000-000000000099";

    @Test
    void requestWithoutToken_shouldReturn401() throws Exception {
        mockMvc.perform(get("/api/claims")
                .header("X-Organization-Id", ORG_ID_1))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void requestWithValidTokenToWrongOrg_shouldReturn403() throws Exception {
        // User only belongs to ORG_ID_1, trying to access ORG_ID_2
        mockMvc.perform(get("/api/claims")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID_1, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID_2))
            .andExpect(status().isForbidden());
    }

    @Test
    void requestWithoutOrgHeader_shouldReturn400() throws Exception {
        mockMvc.perform(get("/api/claims")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID_1, List.of("admin")))))
            .andExpect(status().isBadRequest());
    }

    @Test
    void viewerCannotApprove_shouldReturn403() throws Exception {
        // First create a claim as admin
        CreateClaimRequest createReq = new CreateClaimRequest();
        createReq.setType(ClaimType.AUTO);
        createReq.setAmount(new BigDecimal("1000.00"));

        MvcResult createResult = mockMvc.perform(post("/api/claims")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID_1, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID_1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createReq)))
            .andExpect(status().isCreated())
            .andReturn();

        String claimId = objectMapper.readTree(createResult.getResponse().getContentAsString())
            .get("id").asText();

        // Submit
        mockMvc.perform(post("/api/claims/" + claimId + "/submit")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID_1, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID_1))
            .andExpect(status().isOk());

        // Review
        mockMvc.perform(post("/api/claims/" + claimId + "/review")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID_1, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID_1))
            .andExpect(status().isOk());

        // Viewer tries to approve -> 403
        mockMvc.perform(post("/api/claims/" + claimId + "/approve")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID_1, List.of("viewer"))))
                .header("X-Organization-Id", ORG_ID_1))
            .andExpect(status().isForbidden());
    }

    @Test
    void viewerCannotReview_shouldReturn403() throws Exception {
        CreateClaimRequest createReq = new CreateClaimRequest();
        createReq.setType(ClaimType.HEALTH);

        MvcResult createResult = mockMvc.perform(post("/api/claims")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID_1, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID_1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createReq)))
            .andExpect(status().isCreated())
            .andReturn();

        String claimId = objectMapper.readTree(createResult.getResponse().getContentAsString())
            .get("id").asText();

        // Submit as admin
        mockMvc.perform(post("/api/claims/" + claimId + "/submit")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID_1, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID_1))
            .andExpect(status().isOk());

        // Viewer tries to review -> 403
        mockMvc.perform(post("/api/claims/" + claimId + "/review")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID_1, List.of("viewer"))))
                .header("X-Organization-Id", ORG_ID_1))
            .andExpect(status().isForbidden());
    }

    @Test
    void viewerCannotDeny_shouldReturn403() throws Exception {
        CreateClaimRequest createReq = new CreateClaimRequest();
        createReq.setType(ClaimType.AUTO);

        MvcResult createResult = mockMvc.perform(post("/api/claims")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID_1, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID_1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createReq)))
            .andExpect(status().isCreated())
            .andReturn();

        String claimId = objectMapper.readTree(createResult.getResponse().getContentAsString())
            .get("id").asText();

        // Submit + Review as admin
        mockMvc.perform(post("/api/claims/" + claimId + "/submit")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID_1, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID_1))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/claims/" + claimId + "/review")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID_1, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID_1))
            .andExpect(status().isOk());

        // Viewer tries to deny -> 403
        mockMvc.perform(post("/api/claims/" + claimId + "/deny")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID_1, List.of("viewer"))))
                .header("X-Organization-Id", ORG_ID_1))
            .andExpect(status().isForbidden());
    }

    @Test
    void billingCanApproveButNotDeny() throws Exception {
        CreateClaimRequest createReq = new CreateClaimRequest();
        createReq.setType(ClaimType.PROPERTY);

        MvcResult createResult = mockMvc.perform(post("/api/claims")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID_1, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID_1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createReq)))
            .andExpect(status().isCreated())
            .andReturn();

        String claimId = objectMapper.readTree(createResult.getResponse().getContentAsString())
            .get("id").asText();

        // Submit + Review as admin
        mockMvc.perform(post("/api/claims/" + claimId + "/submit")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID_1, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID_1))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/claims/" + claimId + "/review")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID_1, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID_1))
            .andExpect(status().isOk());

        // Billing tries to deny -> 403 (only admin can deny)
        mockMvc.perform(post("/api/claims/" + claimId + "/deny")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID_1, List.of("billing"))))
                .header("X-Organization-Id", ORG_ID_1))
            .andExpect(status().isForbidden());

        // Billing can approve -> 200
        mockMvc.perform(post("/api/claims/" + claimId + "/approve")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID_1, List.of("billing"))))
                .header("X-Organization-Id", ORG_ID_1))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("APPROVED"));
    }

    @Test
    void healthEndpoint_shouldBeAccessibleWithoutAuth() throws Exception {
        mockMvc.perform(get("/api/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void claimNumberAutoGeneration_shouldFollowFormat() throws Exception {
        CreateClaimRequest req = new CreateClaimRequest();
        req.setType(ClaimType.LIABILITY);

        MvcResult result = mockMvc.perform(post("/api/claims")
                .with(jwt().jwt(buildJwt(USER_ID, ORG_ID_1, List.of("admin"))))
                .header("X-Organization-Id", ORG_ID_1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isCreated())
            .andReturn();

        String claimNumber = objectMapper.readTree(result.getResponse().getContentAsString())
            .get("claimNumber").asText();

        // Should match CLM-YYYY-NNNNN format
        org.assertj.core.api.Assertions.assertThat(claimNumber).matches("CLM-\\d{4}-\\d{5}");
    }

    @Test
    void userInMultipleOrgs_canOnlySeeOwnOrgClaims() throws Exception {
        // Create a claim in ORG_1
        CreateClaimRequest req = new CreateClaimRequest();
        req.setType(ClaimType.AUTO);

        mockMvc.perform(post("/api/claims")
                .with(jwt().jwt(buildMultiOrgJwt(USER_ID, ORG_ID_1, ORG_ID_2)))
                .header("X-Organization-Id", ORG_ID_1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isCreated());

        // List claims in ORG_2 should not show ORG_1 claims
        mockMvc.perform(get("/api/claims")
                .with(jwt().jwt(buildMultiOrgJwt(USER_ID, ORG_ID_1, ORG_ID_2)))
                .header("X-Organization-Id", ORG_ID_2))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content").isArray());
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

    private org.springframework.security.oauth2.jwt.Jwt buildMultiOrgJwt(String sub, String orgId1, String orgId2) {
        Map<String, Object> org1Data = new HashMap<>();
        org1Data.put("id", orgId1);
        org1Data.put("name", "Org One");
        org1Data.put("roles", List.of("admin"));

        Map<String, Object> org2Data = new HashMap<>();
        org2Data.put("id", orgId2);
        org2Data.put("name", "Org Two");
        org2Data.put("roles", List.of("viewer"));

        Map<String, Object> organizations = new HashMap<>();
        organizations.put("org-one", org1Data);
        organizations.put("org-two", org2Data);

        return org.springframework.security.oauth2.jwt.Jwt.withTokenValue("mock-token")
            .header("alg", "RS256")
            .subject(sub)
            .claim("email", "test@example.com")
            .claim("organizations", organizations)
            .build();
    }
}
