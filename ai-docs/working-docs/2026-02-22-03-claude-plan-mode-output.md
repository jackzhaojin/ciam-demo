---
title: "v1.3 Build Plan: PKCE Login + 4 Token Validation Strategies"
project: ciam-demo-private
sub_project: ciam-demo-private
type: working-doc
date: 2026-02-22
tags: []
why_private: "contains internal development guidance and architecture decisions"
status: stable
source_repo: https://github.com/jackzhaojin/ciam-demo-private.git
source_tool: claude-code
harvested: 2026-03-28
---

# v1.3 Build Plan: PKCE Login + 4 Token Validation Strategies

## Context

v1.2.1 has a working BFF auth flow (Auth.js + Keycloak OIDC) that is invisible to developers—Spring Security auto-validates JWTs behind the scenes. v1.3 adds a custom `/login` page that demonstrates how token validation works by letting users choose from 4 backend strategies.

This is a teaching tool for the team, showing PKCE, JWKS, and introspection at the protocol level.

**Spec reference:** `ai-docs/2026-02-22-v1.3/v1.3-incremental-prd.md`

---

## Phase 0: Keycloak — Create `poc-frontend` Client

The `poc-frontend` client was intentionally removed in the initial build. We need it back as a public PKCE client.

### Create

- `ciam/scripts/10-register-frontend-client.sh`
  - Creates `poc-frontend` (public client, `standardFlowEnabled=true`, `publicClient=true`, PKCE S256 enforced, redirect URIs `http://localhost:3000/*`, web origins `http://localhost:3000`).
  - Follow the exact `kc_post` + idempotency pattern from `ciam/scripts/04-register-clients.sh`.
- `ciam/scripts/11-configure-frontend-mappers.sh`
  - Adds loyalty-tier, org-role, org-attribute mappers to `poc-frontend`.
  - Copy mapper JSON from `ciam/scripts/05-configure-token-mappers.sh`.

### Modify

- `ciam/scripts/setup-all.sh`
  - Add scripts `10`, `11` to `SCRIPTS` array.
- `ciam/test/verify-setup.sh` (lines 141–147)
  - Flip the `poc-frontend` check from "should NOT exist" to "should exist as public client with PKCE".
- `.env.example`
  - Add `KEYCLOAK_FRONTEND_CLIENT_ID=poc-frontend`.

### Test

```bash
bash ciam/scripts/10-register-frontend-client.sh && \
bash ciam/scripts/11-configure-frontend-mappers.sh && \
bash ciam/test/verify-setup.sh
```

---

## Phase 1: Backend — Portable Strategy Classes (Java 8 Compatible)

4 standalone validation classes in `com.poc.claims.auth.strategy`. Zero Spring imports. Only JDK 8 APIs + `org.json` + Nimbus 9.x.

### Modify

- `claims-api/build.gradle.kts` — Add:

```kotlin
implementation("com.nimbusds:nimbus-jose-jwt:9.47")
implementation("com.nimbusds:oauth2-oidc-sdk:11.20.1")
implementation("org.json:json:20240303")
```

### Create (all in `claims-api/src/main/java/com/poc/claims/auth/strategy/`)

#### `TokenValidationStrategy.java`
- Interface: `validate(accessToken, issuerUri, config) -> TokenValidationResult`

#### `TokenValidationResult.java`
- POJO fields: `valid`, `email`, `subject`, `claims`, `validationSteps (List<String>)`, `error`, `durationMs`

#### `JwksVanillaStrategy.java`
- Fetch JWKS via `HttpURLConnection`
- Parse with `org.json`
- Build `RSAPublicKey` from `n/e`
- Verify signature with `java.security.Signature (SHA256withRSA)`
- Validate `exp/iss`
- Log every step

#### `JwksNimbusStrategy.java`
- `RemoteJWKSet` + `DefaultJWTProcessor` + `JWSVerificationKeySelector(RS256)`
- ~15 lines of real logic vs ~60 in vanilla

#### `IntrospectionVanillaStrategy.java`
- POST to `{issuer}/protocol/openid-connect/token/introspect` via `HttpURLConnection` with Basic auth
- Parse JSON, check `active`
- Config keys: `introspection.client_id`, `introspection.client_secret`

#### `IntrospectionNimbusStrategy.java`
- `TokenIntrospectionRequest` + `ClientSecretBasic` + `BearerAccessToken`
- Same introspection flow, library handles HTTP/parsing

### Create tests

- `claims-api/src/test/java/com/poc/claims/auth/strategy/JwksVanillaStrategyTest.java`
  - Self-signed RSA keypair, manually construct JWT, validate
  - Pure JUnit 5, no Spring context
- `claims-api/src/test/java/com/poc/claims/auth/strategy/JwksNimbusStrategyTest.java`
  - Same test with Nimbus signing

### Test

```bash
cd claims-api && ./gradlew test --tests "*.auth.strategy.*"
```

---

## Phase 2: Backend — `AuthController` + `AuthService` (Spring Glue)

The Spring adapter layer that delegates to the portable strategy classes.

### Modify

- `claims-api/src/main/java/com/poc/claims/config/SecurityConfig.java` (line 41)
  - Add `.requestMatchers("/api/auth/**").permitAll()` before `.anyRequest().authenticated()`
- `claims-api/src/main/java/com/poc/claims/config/OrgContextFilter.java` (line 30)
  - Add `|| path.startsWith("/api/auth/")` to skip condition
- `claims-api/src/main/resources/application.yml`
  - Add:
    - `app.auth.frontend-client-id`
    - `app.auth.introspection-client-id`
    - `app.auth.introspection-client-secret`

### Create

#### `claims-api/.../auth/dto/PkceCallbackRequest.java`
- Request DTO: `authorizationCode`, `codeVerifier`, `strategy`, `redirectUri` — all `@NotBlank`

#### `claims-api/.../auth/dto/PkceCallbackResponse.java`
- Response DTO: `success`, `strategy`, `strategyLabel`, `tokenSummary (map)`, `validationDetails (method, steps, durationMs)`, `error`

#### `claims-api/.../auth/AuthService.java`
- `@Service`
- Injects `issuerUri` + client configs
- Holds `Map<String, TokenValidationStrategy>`
- Method `exchangeAndValidate(code, verifier, redirectUri, strategy)`:
  1. POST to Keycloak `/token` endpoint to exchange code for tokens
  2. Delegate to selected strategy for validation
  3. Return combined result with steps

#### `claims-api/.../auth/AuthController.java`
- `@RestController @RequestMapping("/api/auth")`
- Endpoints:
  - `POST /pkce-callback` (single endpoint that exchanges + validates)
  - `GET /strategies` (returns available strategies)
  - `GET /config` (returns `issuerUri` + `clientId` for frontend)

### Create test

- `claims-api/src/test/java/com/poc/claims/auth/AuthControllerTest.java`
  - MockMvc tests:
    - `GET /strategies` returns 200 with 4 items
    - `GET /config` returns `issuerUri`
    - `POST /pkce-callback` with missing fields returns 400
  - Follow existing `ClaimControllerTest.java` pattern

### Test

```bash
cd claims-api && ./gradlew test
```

---

## Phase 3: Frontend — CORS Probe + Next.js API Proxy

### Create

- `claims-web/src/app/api/auth/pkce-proxy/route.ts` — Next.js route handler with two actions:
  - `action: "get-login-form"`
    - Server-side `fetch()` to Keycloak `/auth` endpoint with PKCE params
    - Returns parsed form action URL + session cookies
  - `action: "submit-credentials"`
    - Server-side POST to Keycloak form action URL with credentials + cookies
    - Captures `Location` header redirect
    - Returns extracted auth code
  - Security: validates target URLs start with known `KEYCLOAK_ISSUER_URI`

This proxy exists because Keycloak auth/login-actions endpoints do not support CORS for browser `fetch()` calls. Server-to-server proxying bypasses browser CORS.

### Test

```bash
curl -X POST http://localhost:3000/api/auth/pkce-proxy \
  -H "Content-Type: application/json" \
  -d '{"action":"get-login-form","authUrl":"..."}'
```

---

## Phase 4: Frontend — `/login` Page

### Create

#### `claims-web/src/app/login/page.tsx`
- Thin server wrapper, renders `<LoginPage />` client component

#### `claims-web/src/components/auth/LoginPage.tsx`
- `"use client"` main login form
- Two sections:
  - **A)** "Login with CIAM Provider" button → `signIn("keycloak")`
  - **B)** username/password + strategy dropdown + "Sign In with PKCE"
- Submit flow:
  1. Generate PKCE pair (Web Crypto API)
  2. Call proxy to get auth code from Keycloak
  3. POST auth code to Spring `/api/auth/pkce-callback`
  4. Display result

#### `claims-web/src/components/auth/ValidationResult.tsx`
- `"use client"`
- Displays strategy name, pass/fail badge, token claims (pretty JSON), step-by-step validation log, duration
- Rendered inline on login page after successful auth

#### `claims-web/src/lib/pkce.ts`
- Utility: `generateCodeVerifier()`, `generateCodeChallenge(verifier)` using `crypto.subtle.digest("SHA-256")`

### Modify

- `claims-web/src/app/page.tsx`
  - Add link to `/login` below existing "Sign In" button:
  - **Advanced Login (Strategy Demo)**

No middleware change needed — `/login` is already unprotected (not in matcher at `middleware.ts:32`).

### Test

- Run `pnpm dev`
- Navigate to `/login`
- Verify form renders
- Verify strategy dropdown has 4 options

---

## Phase 5: Integration Test + Polish

### Create

- `claims-web/tests/unit/pkce.test.ts`
  - Unit test for PKCE utility (verifier format, challenge is SHA-256 of verifier)
- `claims-web/tests/e2e/login.spec.ts`
  - Playwright: `/login` loads, both sections visible, dropdown interactive, form validation works

### Test

```bash
cd claims-api && ./gradlew test
cd claims-web && pnpm test
cd claims-web && pnpm exec playwright test
```

Manual smoke:
- Full PKCE flow from login form → Keycloak auth code → Spring validation → step-by-step result display

---

## File Summary

### New files: 17 (+ 4 test files)

#### Area: Keycloak scripts
- `10-register-frontend-client.sh`
- `11-configure-frontend-mappers.sh`

#### Area: Backend strategy (portable)
- `TokenValidationStrategy.java`
- `TokenValidationResult.java`
- `JwksVanillaStrategy.java`
- `JwksNimbusStrategy.java`
- `IntrospectionVanillaStrategy.java`
- `IntrospectionNimbusStrategy.java`

#### Area: Backend Spring glue
- `AuthController.java`
- `AuthService.java`
- `PkceCallbackRequest.java`
- `PkceCallbackResponse.java`

#### Area: Frontend
- `login/page.tsx`
- `auth/LoginPage.tsx`
- `auth/ValidationResult.tsx`
- `lib/pkce.ts`
- `api/auth/pkce-proxy/route.ts`

### Modified files: 7

| File | Change |
|---|---|
| `claims-api/build.gradle.kts` | Add nimbus, org.json deps |
| `claims-api/.../SecurityConfig.java` (line 41) | `.requestMatchers("/api/auth/**").permitAll()` |
| `claims-api/.../OrgContextFilter.java` (line 30) | `path.startsWith("/api/auth/")` skip |
| `claims-api/.../application.yml` | Add `app.auth.*` properties |
| `claims-web/src/app/page.tsx` | Add link to `/login` |
| `ciam/scripts/setup-all.sh` | Add scripts 10, 11 |
| `ciam/test/verify-setup.sh` | Flip `poc-frontend` check |
