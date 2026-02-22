package com.poc.claims.auth;

import com.poc.claims.TestSecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void getStrategies_shouldReturn4Strategies() throws Exception {
        mockMvc.perform(get("/api/auth/strategies"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(4)))
            .andExpect(jsonPath("$[0].key").value("jwks-vanilla"))
            .andExpect(jsonPath("$[0].label").isNotEmpty())
            .andExpect(jsonPath("$[0].offline").value(true))
            .andExpect(jsonPath("$[1].key").value("jwks-nimbus"))
            .andExpect(jsonPath("$[2].key").value("introspection-vanilla"))
            .andExpect(jsonPath("$[2].offline").value(false))
            .andExpect(jsonPath("$[3].key").value("introspection-nimbus"));
    }

    @Test
    void getConfig_shouldReturnIssuerAndClientId() throws Exception {
        mockMvc.perform(get("/api/auth/config"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.issuerUri").isNotEmpty())
            .andExpect(jsonPath("$.clientId").value("poc-frontend"));
    }

    @Test
    void pkceCallback_withMissingFields_shouldReturn400() throws Exception {
        mockMvc.perform(post("/api/auth/pkce-callback")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void pkceCallback_withInvalidStrategy_shouldReturnError() throws Exception {
        String body = """
            {
                "authorizationCode": "fake-code",
                "codeVerifier": "fake-verifier",
                "strategy": "nonexistent",
                "redirectUri": "http://localhost:3000/login"
            }
            """;

        mockMvc.perform(post("/api/auth/pkce-callback")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error", containsString("Unknown strategy")));
    }

    @Test
    void authEndpoints_shouldNotRequireAuthentication() throws Exception {
        // All /api/auth/** endpoints should be accessible without a JWT
        mockMvc.perform(get("/api/auth/strategies"))
            .andExpect(status().isOk());

        mockMvc.perform(get("/api/auth/config"))
            .andExpect(status().isOk());
    }
}
