---
title: "v1.3 Incremental PRD — Multi-Strategy Token Validation with PKCE"
project: ciam-demo-private
sub_project: ciam-demo-private
type: spec
date: 2026-02-22
tags: []
why_private: "contains unpublished architecture decisions and internal specifications"
status: stable
source_repo: https://github.com/jackzhaojin/ciam-demo-private.git
source_tool: claude-code
harvested: 2026-03-28
---

# v1.3 Incremental PRD — Multi-Strategy Token Validation with PKCE

**Date:** 2026-02-22
**Baseline:** v1.2.1 (enterprise claims platform with analytics, priority scoring, SLA tracking, fraud signals, BFF auth)
**Goal:** Demonstrate four distinct backend token validation strategies behind a PKCE Authorization Code flow, teaching the team how authentication and token validation work at the protocol level
**Stack:** Next.js 16 (React 19 client component) + Spring Boot 3.x (Java 21) + Keycloak (Phase Two hosted)
**Java 8 portability:** All validation strategy code written as standalone utility classes with zero Spring dependencies, using only Java 8-compatible APIs and libraries

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Current State Summary](#2-current-state-summary)
3. [v1.3 Feature Map](#3-v13-feature-map)
4. [Architecture: The PKCE Flow](#4-architecture-the-pkce-flow)
5. [Feature 1: Custom Login Page](#5-feature-1-custom-login-page)
6. [Feature 2: PKCE Auth Code Acquisition (React → Keycloak)](#6-feature-2-pkce-auth-code-acquisition-react--keycloak)
7. [Headless OIDC Deep Dive](#6a-headless-oidc-deep-dive)
8. [Feature 3: Auth Code Exchange Endpoint (Spring → Keycloak)](#7-feature-3-auth-code-exchange-endpoint-spring--keycloak)
8. [Feature 4: Strategy A — JWKS Validation with Vanilla Java](#8-feature-4-strategy-a--jwks-validation-with-vanilla-java)
9. [Feature 5: Strategy B — JWKS Validation with Nimbus JOSE+JWT](#9-feature-5-strategy-b--jwks-validation-with-nimbus-josejwt)
10. [Feature 6: Strategy C — Token Introspection with Vanilla HTTP](#10-feature-6-strategy-c--token-introspection-with-vanilla-http)
11. [Feature 7: Strategy D — Token Introspection with Nimbus](#11-feature-7-strategy-d--token-introspection-with-nimbus)
12. [Keycloak Configuration](#12-keycloak-configuration)
13. [API Contract](#13-api-contract)
14. [Open Questions](#14-open-questions)
15. [What NOT to Build](#15-what-not-to-build)
16. [Success Criteria](#16-success-criteria)

---

## 1. Design Philosophy

### What v1.3 is about

v1.2 proved the **product** — an enterprise claims platform with CIAM-powered org-scoped access control. v1.3 proves the **engineering** — showing your team exactly how tokens move through the system and four different ways a backend can validate them.

This is a **teaching demo**. The audience is developers who need to understand:

1. **Why the Authorization Code + PKCE flow exists** — credentials stay between the user's browser and the IdP. The backend never touches passwords. The auth code is a one-time-use proxy that proves "this user authenticated successfully."

2. **The separation between auth code exchange and token validation** — exchanging a code for tokens (at the IdP's `/token` endpoint) is a different concern from validating whether a token is legitimate. v1.3 makes this visible by letting the user pick the validation strategy.

3. **Offline vs. online validation** — JWKS validation is "offline" (the backend can verify a JWT's signature using cached public keys without calling the IdP). Introspection is "online" (the backend asks the IdP in real time whether the token is valid). Both are legitimate; each has trade-offs.

4. **Library vs. from-scratch** — for each approach, we show it done with raw Java (educational) and with Nimbus libraries (production-ready). The raw implementations teach what the libraries abstract away.

### Portability constraint

The four validation strategies must be **portable to Java 8 + WebLogic**. This means:

- Zero Spring dependencies in the validation classes
- No `java.net.http.HttpClient` (Java 11+) — use `HttpURLConnection` or OkHttp 3.x
- Nimbus JOSE+JWT 9.x (supports Java 8)
- No `var`, no records, no sealed classes in the strategy code
- Each strategy class is a self-contained unit that can be dropped into a legacy project

The Spring Boot wrapper (controller, service layer) uses modern Java freely — only the strategy implementations are constrained.

---

## 2. Current State Summary

### Authentication as of v1.2.1

| Component | Role | Detail |
|-----------|------|--------|
| **Auth.js (Next.js)** | BFF OIDC client | Handles Authorization Code flow with Keycloak, stores tokens in encrypted HTTP-only cookie, manages token refresh |
| **Keycloak (Phase Two)** | Identity Provider | Issues JWTs with custom claims (organizations, loyalty_tier, org_attributes) |
| **Spring Boot** | Resource Server | Validates Bearer JWTs using Spring Security's built-in JWKS auto-fetch. `OrgContextFilter` validates X-Organization-Id against token claims |
| **`poc-bff`** | Keycloak client | Confidential client for Auth.js server-side flow |
| **`poc-frontend`** | Keycloak client | Public client (exists but unused — will be used by v1.3) |

### What's happening behind the scenes (invisible to the team)

Spring Security's `oauth2ResourceServer().jwt()` configuration does a LOT of work automatically:
- Fetches JWKS from `{issuer}/.well-known/openid-configuration`
- Caches the key set
- Validates JWT signature against the public key
- Checks `exp`, `iat`, `iss` claims
- Converts the JWT into a Spring `Authentication` object

v1.3 rips this open and shows each step explicitly in four different ways.

---

## 3. v1.3 Feature Map

### The five login options (user-facing)

```
┌─────────────────────────────────────────────────────────┐
│                    Claims Portal                         │
│                                                          │
│   ┌──────────────────────────────────────────────────┐   │
│   │          Login with CIAM Provider                │   │
│   │   (Current Keycloak OIDC redirect flow)          │   │
│   └──────────────────────────────────────────────────┘   │
│                                                          │
│   ── or sign in with PKCE ──────────────────────────     │
│                                                          │
│   Username: [________________________]                   │
│   Password: [________________________]                   │
│                                                          │
│   Validation Strategy:                                   │
│   ┌──────────────────────────────────────────────┐       │
│   │  JWKS — Vanilla Java (raw JDK crypto)      ▼│       │
│   ├──────────────────────────────────────────────┤       │
│   │  JWKS — Vanilla Java (raw JDK crypto)        │       │
│   │  JWKS — Nimbus JOSE+JWT library              │       │
│   │  Introspection — Vanilla HTTP                │       │
│   │  Introspection — Nimbus library              │       │
│   └──────────────────────────────────────────────┘       │
│                                                          │
│   [       Sign In with PKCE       ]                      │
│                                                          │
│   ℹ This demonstrates four ways a backend can            │
│     validate tokens after a PKCE auth code exchange.     │
└─────────────────────────────────────────────────────────┘
```

### What each option demonstrates

| # | Option | Who sees the password? | Validation method | Online/Offline |
|---|--------|----------------------|-------------------|----------------|
| 1 | CIAM Provider | Keycloak only (browser redirect) | Spring Security auto-JWKS (existing) | Offline |
| 2 | PKCE + JWKS Vanilla | React + Keycloak | Manual JWKS fetch, manual signature verify using `java.security` | Offline |
| 3 | PKCE + JWKS Nimbus | React + Keycloak | Nimbus `JWSVerifier` + `DefaultJWKSetCache` | Offline |
| 4 | PKCE + Introspection Vanilla | React + Keycloak | Raw HTTP POST to Keycloak's `/introspect` endpoint | Online |
| 5 | PKCE + Introspection Nimbus | React + Keycloak | Nimbus `TokenIntrospectionRequest` | Online |

### Credential visibility table (the teaching moment)

| Component | Sees Password? | Sees Auth Code? | Sees Tokens? |
|-----------|---------------|-----------------|-------------|
| React (login page) | Yes (briefly, in memory) | Yes | No |
| Spring Backend | **Never** | Yes | Yes |
| Keycloak | Yes | Yes (issues it) | Yes (issues them) |

---

## 4. Architecture: The PKCE Flow

### Sequence (options 2–5)

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  React   │         │ Keycloak │         │  Spring  │
│  Login   │         │  (IdP)   │         │ Backend  │
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │                     │                    │
     │ 1. Generate PKCE    │                    │
     │    code_verifier    │                    │
     │    code_challenge   │                    │
     │                     │                    │
     │ 2. POST credentials │                    │
     │    + code_challenge ─────────►           │
     │    + client_id      │                    │
     │                     │                    │
     │         ◄───────────│                    │
     │ 3. Receive auth CODE│                    │
     │    (one-time use)   │                    │
     │                     │                    │
     │ 4. POST auth CODE   │                    │
     │    + code_verifier  ─────────────────────►
     │    + strategy       │                    │
     │                     │                    │
     │                     │    5. Exchange CODE │
     │                     │◄────── + verifier  │
     │                     │                    │
     │                     │────────►           │
     │                     │    6. Return tokens│
     │                     │                    │
     │                     │    7. Validate     │
     │                     │       tokens using │
     │                     │       strategy     │
     │                     │                    │
     │         ◄───────────────────────────────│
     │ 8. Auth result      │                    │
     │    (success/failure) │                    │
     └─────────────────────┴────────────────────┘
```

### Why PKCE matters here

Without PKCE, anyone who intercepts the authorization code could exchange it for tokens. PKCE prevents this:

- The `code_challenge` is sent with the auth request (step 2) — Keycloak binds it to the issued code
- The `code_verifier` is sent with the token exchange (step 5) — Keycloak verifies it matches the challenge
- An attacker with only the auth code cannot exchange it because they don't have the `code_verifier`

The React app generates both values. It sends the `code_challenge` to Keycloak (step 2) and the `code_verifier` to Spring (step 4). The two values are mathematically linked: `code_challenge = BASE64URL(SHA256(code_verifier))`.

---

## 5. Feature 1: Custom Login Page

### Route: `/login`

A `"use client"` Next.js page. Fully client-rendered — no server components, no server actions. This is intentional: it demonstrates a "dumb" SPA frontend that handles only the PKCE handshake.

### Navigation

- Current landing page (`/`) retains the existing "Sign In" button (Auth.js/Keycloak OIDC redirect)
- New "Advanced Login" or "Developer Login" link on the landing page navigates to `/login`
- Authenticated users visiting `/login` are redirected to `/dashboard`

### Component structure

```
/login (page.tsx - "use client")
├── LoginMethodToggle
│   ├── "Login with CIAM Provider" button (redirects to existing Auth.js signIn)
│   └── PKCE Login Form
│       ├── UsernameInput
│       ├── PasswordInput
│       ├── StrategyDropdown (4 options)
│       ├── SignInButton
│       └── InfoPanel (explains selected strategy)
└── PkceFlowVisualizer (optional)
    └── Shows real-time step progress during auth
```

### Strategy dropdown options

| Value | Label | Description shown in InfoPanel |
|-------|-------|-------------------------------|
| `jwks-vanilla` | JWKS — Vanilla Java | Token signature verified using raw JDK crypto (`java.security.Signature`). No third-party libraries. The backend fetches the JWKS endpoint, parses the JSON, builds an RSA public key, and verifies the JWT signature byte-by-byte. |
| `jwks-nimbus` | JWKS — Nimbus JOSE+JWT | Token signature verified using the Nimbus JOSE+JWT library. Industry-standard library that handles key parsing, algorithm negotiation, and signature verification. |
| `introspect-vanilla` | Introspection — Vanilla HTTP | Token validated by calling Keycloak's `/introspect` endpoint using raw `HttpURLConnection`. The IdP confirms whether the token is active in real time. No local crypto needed. |
| `introspect-nimbus` | Introspection — Nimbus | Token validated via Keycloak's introspection endpoint using the Nimbus OAuth2 SDK. Handles the HTTP call, response parsing, and error handling. |

### InfoPanel behavior

When the user selects a strategy from the dropdown, the InfoPanel updates to show:
- A brief explanation of the approach (2-3 sentences)
- Whether it's offline (JWKS) or online (introspection)
- Whether it uses third-party libraries
- A badge: "Java 8 Compatible"

---

## 6. Feature 2: PKCE Auth Code Acquisition (React → Keycloak)

### What React does

1. **Generate PKCE pair:**
   ```
   code_verifier  = random 43-128 character string (A-Z, a-z, 0-9, -._~)
   code_challenge = BASE64URL(SHA256(code_verifier))
   ```
   Use the Web Crypto API (`crypto.subtle.digest('SHA-256', ...)`) for the SHA-256 hash.

2. **Send credentials + code_challenge to Keycloak** to obtain an authorization code.

3. **Receive the authorization code** from Keycloak's response.

4. **POST to Spring backend:**
   ```
   POST /api/auth/pkce-callback
   Content-Type: application/json

   {
     "authorizationCode": "the-one-time-use-code",
     "codeVerifier": "the-original-verifier",
     "strategy": "jwks-vanilla",
     "redirectUri": "http://localhost:3000/login"
   }
   ```

5. **Discard credentials from memory.** After Keycloak returns the auth code, the username and password are no longer needed. The React component clears them from state.

### Keycloak endpoint for programmatic auth code (see Open Questions)

The standard OIDC Authorization Code flow requires a browser redirect to the IdP's `/auth` endpoint, which presents a login page. For React to collect credentials on its own form and exchange them for an auth code programmatically, we need a Keycloak endpoint that accepts credentials via API and returns an authorization code.

**Approach: Headless OIDC**

React performs the OIDC Authorization Code flow programmatically using `fetch()` — no browser redirects, no popups. The user enters credentials on our React login form, and React talks to Keycloak's authentication endpoints directly via HTTP.

See [Section 6a: Headless OIDC Deep Dive](#6a-headless-oidc-deep-dive) for the full technical breakdown and CORS mitigation strategy.

### Keycloak client for PKCE

Use the existing **`poc-frontend`** public client (already configured in Keycloak but currently unused):
- Client ID: `poc-frontend`
- Client authentication: OFF (public client)
- Standard flow: enabled
- Direct access grants: enabled (for potential ROPC fallback research)
- Valid redirect URIs: `http://localhost:3000/*`
- PKCE challenge method: S256

---

## 6a. Headless OIDC Deep Dive

This is the most non-standard piece of v1.3 and the one area that requires investigation during the build. Everything else in this spec uses standard, well-documented protocols. This section documents exactly what "headless OIDC" means, how it works, and what could block it.

### What "headless OIDC" means

In normal OIDC Authorization Code flow, the browser navigates to Keycloak's `/auth` endpoint. Keycloak renders an HTML login page. The user types credentials into Keycloak's form. Keycloak validates them and redirects the browser back with an auth code.

In **headless OIDC**, React does this same dance programmatically using `fetch()`:

```
React                              Keycloak
  │                                    │
  │ 1. GET /auth?response_type=code    │
  │    &client_id=poc-frontend         │
  │    &code_challenge=...             │
  │    &redirect_uri=.../login         │
  │ ──────────────────────────────────►│
  │                                    │
  │◄────────────────────────────────── │
  │ 2. HTML login page                 │
  │    (contains <form action=         │
  │     "/login-actions/authenticate   │
  │      ?session_code=xxx             │
  │      &execution=xxx               │
  │      &client_id=poc-frontend       │
  │      &tab_id=xxx">)               │
  │                                    │
  │ 3. Parse form action URL           │
  │                                    │
  │ 4. POST /login-actions/authenticate│
  │    ?session_code=xxx&...           │
  │    Body: username=...&password=... │
  │ ──────────────────────────────────►│
  │                                    │
  │◄────────────────────────────────── │
  │ 5. 302 Redirect                    │
  │    Location: /login?code=AUTH_CODE │
  │                                    │
  │ 6. Extract auth code from          │
  │    Location header                 │
```

### Step-by-step implementation

**Step 1 — Initiate the auth request:**
```
GET {issuer}/protocol/openid-connect/auth
    ?response_type=code
    &client_id=poc-frontend
    &redirect_uri=http://localhost:3000/login
    &scope=openid email profile
    &code_challenge={code_challenge}
    &code_challenge_method=S256
    &state={random_state}
```

React calls this with `fetch()`. The response is HTML (Keycloak's login page). React also needs to capture any `Set-Cookie` headers — Keycloak uses session cookies to tie the auth request to the form submission.

**Step 2 — Parse the HTML response:**

Extract the `<form action="...">` URL from the HTML. This URL contains Keycloak-generated session parameters (`session_code`, `execution`, `tab_id`) that are required for the credential submission.

Example form action:
```
/realms/{realm}/login-actions/authenticate
    ?session_code=abc123
    &execution=def456
    &client_id=poc-frontend
    &tab_id=ghi789
```

**Step 3 — Submit credentials:**
```
POST {keycloak_base}/realms/{realm}/login-actions/authenticate
     ?session_code=abc123&execution=def456&client_id=poc-frontend&tab_id=ghi789
Content-Type: application/x-www-form-urlencoded
Cookie: {session cookies from step 1}

username={username}&password={password}
```

React calls this with `fetch()` using `redirect: 'manual'` to prevent the browser from auto-following the redirect. The response is a `302` with a `Location` header.

**Step 4 — Extract the auth code:**

Parse the `Location` header from the 302 response:
```
http://localhost:3000/login?code=AUTH_CODE&session_state=xxx&state={state}
```

Extract the `code` query parameter. This is the authorization code.

**Step 5 — Verify state:**

Confirm the `state` parameter matches the `state` sent in step 1 (CSRF protection).

### The CORS challenge

This is the **one known blocker** to investigate.

**The problem:** Browser `fetch()` enforces same-origin policy. React runs on `localhost:3000`. Keycloak runs on `your-deployment.phasetwo.io`. The browser will block the `fetch()` calls unless Keycloak's response includes `Access-Control-Allow-Origin: http://localhost:3000`.

**Which endpoints need CORS:**

| Endpoint | Request | Keycloak typically allows CORS? |
|----------|---------|-------------------------------|
| `/protocol/openid-connect/auth` | GET (step 1) | **No** — designed for browser navigation, not fetch |
| `/login-actions/authenticate` | POST (step 3) | **No** — designed for browser form submission |
| `/protocol/openid-connect/token` | POST (token exchange) | **Yes** — configured via client "Web Origins" |

**The gap:** Keycloak's "Web Origins" client setting adds CORS headers to the `/token`, `/userinfo`, and `/logout` endpoints, but NOT to the `/auth` or `/login-actions` endpoints. These are meant for browser navigation, not API calls.

### CORS mitigation strategies

**Strategy 1: Keycloak realm-level CORS (preferred if available)**

Phase Two or Keycloak may support realm-level CORS configuration that covers all endpoints. Check Phase Two's admin console for a CORS settings panel.

**Strategy 2: Next.js API route proxy**

Add a thin proxy route in the Next.js app that forwards requests to Keycloak server-to-server (no CORS in play):

```
React ──fetch()──► Next.js /api/keycloak-proxy ──HTTP──► Keycloak
         (same origin,                (server-to-server,
          no CORS issue)               no CORS issue)
```

Route: `POST /api/keycloak-proxy`
- Accepts: target URL + method + body
- Forwards the request to Keycloak
- Returns the response (including headers, cookies, and the redirect Location)
- **Credentials pass through the proxy** but are never stored or logged

Trade-off: The Next.js server technically sees the credentials in transit. For a teaching POC this is acceptable with a clear note: "In production, credentials go directly to the IdP. This proxy exists only to work around CORS during local development."

**Strategy 3: Keycloak reverse proxy / custom headers**

Deploy a reverse proxy (nginx, Caddy) in front of Keycloak that adds CORS headers to all endpoints. More infrastructure overhead, but doesn't touch the application code.

**Recommended investigation order:**
1. First: check if Phase Two's hosted Keycloak supports CORS on auth endpoints (zero-effort if it works)
2. Second: try the Next.js API route proxy (minimal code, works immediately)
3. Last resort: reverse proxy approach

### Cookie handling

Keycloak sets session cookies during step 1 that must be sent with step 3. With `fetch()`:

- Use `credentials: 'include'` to send/receive cookies cross-origin
- This requires Keycloak to respond with `Access-Control-Allow-Credentials: true` (another CORS consideration)
- If using the Next.js proxy approach, the proxy handles cookies server-side (no browser cookie issues)

### Fallback if headless OIDC proves infeasible

If CORS cannot be resolved, a minimal-redirect approach preserves most of the teaching value:

1. React generates PKCE + selects strategy (stored in `sessionStorage`)
2. React navigates to Keycloak's `/auth` endpoint (full page redirect)
3. User authenticates on Keycloak's hosted page
4. Keycloak redirects back to `/login?code=AUTH_CODE`
5. The `/login` page (React client component) reads the auth code from the URL
6. React sends auth code + code_verifier + strategy to Spring backend
7. Spring exchanges + validates as normal

This loses the "credentials on our form" aspect but preserves the PKCE demonstration and all 4 validation strategies. The login page still shows the strategy dropdown before initiating the flow.

---

## 7. Feature 3: Auth Code Exchange Endpoint (Spring → Keycloak)

### New endpoint

**`POST /api/auth/pkce-callback`** — Receives the auth code from React, exchanges it for tokens at Keycloak, validates the tokens using the selected strategy, and returns the result.

### Request

```json
{
  "authorizationCode": "xxxxxx",
  "codeVerifier": "yyyyyyy",
  "strategy": "jwks-vanilla | jwks-nimbus | introspect-vanilla | introspect-nimbus",
  "redirectUri": "http://localhost:3000/login"
}
```

### Processing steps

1. **Exchange auth code for tokens** — POST to Keycloak's token endpoint:
   ```
   POST /realms/{realm}/protocol/openid-connect/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code
   &code={authorizationCode}
   &redirect_uri={redirectUri}
   &client_id=poc-frontend
   &code_verifier={codeVerifier}
   ```

   Keycloak responds with:
   ```json
   {
     "access_token": "eyJhbG...",
     "refresh_token": "eyJhbG...",
     "id_token": "eyJhbG...",
     "expires_in": 300,
     "token_type": "Bearer"
   }
   ```

2. **Validate the access token** using the selected strategy (see Features 4–7).

3. **Return validation result** to React (see Response below).

### Response

```json
{
  "success": true,
  "strategy": "jwks-vanilla",
  "strategyLabel": "JWKS — Vanilla Java",
  "validationDetails": {
    "algorithm": "RS256",
    "keyId": "abc123",
    "issuer": "https://your-realm.phasetwo.io/realms/your-realm",
    "subject": "user-uuid",
    "email": "admin@test.com",
    "expiresAt": "2026-02-22T15:30:00Z",
    "organizations": { "acme-uuid": { "name": "Acme Corporation", "roles": ["admin"] } },
    "validationMethod": "RSA signature verification using java.security.Signature (SHA256withRSA)",
    "steps": [
      "Fetched JWKS from https://.../.well-known/jwks.json",
      "Found key matching kid 'abc123'",
      "Built RSA public key from modulus (n) and exponent (e)",
      "Decoded JWT: header.payload.signature",
      "Verified SHA256withRSA signature against public key",
      "Checked token not expired (expires in 298 seconds)",
      "Checked issuer matches expected value",
      "Token is VALID"
    ]
  }
}
```

The `steps` array is the key teaching tool — it shows exactly what the backend did to validate the token, step by step. Each strategy produces its own steps.

### Error response

```json
{
  "success": false,
  "strategy": "jwks-vanilla",
  "error": "Token signature verification failed",
  "validationDetails": {
    "steps": [
      "Fetched JWKS from https://.../.well-known/jwks.json",
      "Found key matching kid 'abc123'",
      "Built RSA public key from modulus (n) and exponent (e)",
      "Decoded JWT: header.payload.signature",
      "FAILED: SHA256withRSA signature does not match"
    ]
  }
}
```

### Auth requirements for this endpoint

`POST /api/auth/pkce-callback` must be **unauthenticated** (permit all). The whole point is that this endpoint authenticates the user — it can't require prior authentication.

No `X-Organization-Id` header required (not yet in an org context).

---

## 8. Feature 4: Strategy A — JWKS Validation with Vanilla Java

### Purpose

Demonstrate JWT validation using **only JDK classes** — no Nimbus, no Spring Security, no third-party libraries. This shows exactly what happens inside those libraries.

### Class

```
VanillaJwksTokenValidator
  - Package: com.example.claims.auth.strategy
  - Dependencies: NONE (only java.security, java.net, javax.crypto, org.json or manual JSON parsing)
  - Java compatibility: 8+
```

### What it does (step by step)

1. **Fetch the JWKS endpoint:**
   - Derive JWKS URL from issuer: `{issuer}/protocol/openid-connect/certs`
   - HTTP GET using `HttpURLConnection` (Java 8 compatible)
   - Parse the JSON response to extract the `keys` array

2. **Decode the JWT:**
   - Split the token on `.` → header, payload, signature (all Base64URL-encoded)
   - Decode the header JSON → extract `kid` (key ID) and `alg` (algorithm, expect RS256)
   - Decode the payload JSON → extract claims (`sub`, `email`, `exp`, `iss`, `organizations`, etc.)

3. **Find the matching key:**
   - Search the JWKS `keys` array for an entry where `kid` matches the JWT header's `kid`
   - Extract `n` (modulus) and `e` (exponent) from the JWK — both Base64URL-encoded big integers

4. **Build the RSA public key:**
   ```
   BigInteger modulus = new BigInteger(1, Base64URL.decode(n))
   BigInteger exponent = new BigInteger(1, Base64URL.decode(e))
   RSAPublicKeySpec spec = new RSAPublicKeySpec(modulus, exponent)
   PublicKey publicKey = KeyFactory.getInstance("RSA").generatePublic(spec)
   ```

5. **Verify the signature:**
   ```
   Signature sig = Signature.getInstance("SHA256withRSA")
   sig.initVerify(publicKey)
   sig.update((headerB64 + "." + payloadB64).getBytes("UTF-8"))
   boolean valid = sig.verify(Base64URL.decode(signatureB64))
   ```

6. **Validate claims:**
   - Check `exp` > current time (not expired)
   - Check `iss` matches expected issuer
   - Optionally check `aud` contains expected client ID

7. **Return result** with all steps logged.

### Teaching value

This is the "pull back the curtain" strategy. Developers see that JWT validation is fundamentally:
- Download a public key from the IdP
- Check a digital signature
- Verify the token hasn't expired

Everything else is convenience wrappers.

---

## 9. Feature 5: Strategy B — JWKS Validation with Nimbus JOSE+JWT

### Purpose

Demonstrate the same JWKS validation using the **Nimbus JOSE+JWT** library — the production-ready approach. Shows how the library abstracts away the crypto details from Strategy A.

### Class

```
NimbusJwksTokenValidator
  - Package: com.example.claims.auth.strategy
  - Dependencies: nimbus-jose-jwt 9.x (Java 8 compatible)
  - Java compatibility: 8+
```

### Library version constraint

**Nimbus JOSE+JWT 9.47** (or latest 9.x) — the 9.x line supports Java 8. Do NOT use 10.x+ which requires Java 11+.

Maven/Gradle:
```
com.nimbusds:nimbus-jose-jwt:9.47
```

### What it does (step by step)

1. **Create a JWKS source:**
   ```
   JWKSource<SecurityContext> jwkSource = new RemoteJWKSet<>(new URL(jwksUrl));
   ```
   Nimbus handles fetching, parsing, and caching the JWKS automatically.

2. **Create a JWT processor:**
   ```
   ConfigurableJWTProcessor<SecurityContext> processor = new DefaultJWTProcessor<>();
   JWSKeySelector<SecurityContext> keySelector =
       new JWSVerificationKeySelector<>(JWSAlgorithm.RS256, jwkSource);
   processor.setJWSKeySelector(keySelector);
   ```

3. **Process the JWT:**
   ```
   JWTClaimsSet claims = processor.process(accessToken, null);
   ```
   Nimbus automatically:
   - Parses the JWT
   - Finds the matching key by `kid`
   - Verifies the signature
   - Returns the claims

4. **Validate claims:**
   - Check `claims.getExpirationTime()` > now
   - Check `claims.getIssuer()` matches expected
   - Extract custom claims (`organizations`, etc.)

5. **Return result** with steps logged.

### Teaching value

Compare this to Strategy A — the same result in ~10 lines vs. ~50. Shows what the library buys you (key caching, algorithm negotiation, error handling) while Strategy A shows what's actually happening underneath.

---

## 10. Feature 6: Strategy C — Token Introspection with Vanilla HTTP

### Purpose

Demonstrate **online token validation** — instead of verifying the JWT's signature locally, ask the IdP directly "is this token valid?" using the OAuth 2.0 Token Introspection endpoint (RFC 7662).

### Class

```
VanillaIntrospectionTokenValidator
  - Package: com.example.claims.auth.strategy
  - Dependencies: NONE (only java.net, org.json or manual JSON parsing)
  - Java compatibility: 8+
```

### Introspection endpoint

```
POST /realms/{realm}/protocol/openid-connect/token/introspect
Content-Type: application/x-www-form-urlencoded
Authorization: Basic {base64(client_id:client_secret)}

token={access_token}
```

Keycloak responds:
```json
{
  "active": true,
  "sub": "user-uuid",
  "email": "admin@test.com",
  "exp": 1740240600,
  "iss": "https://...",
  "client_id": "poc-frontend",
  "organizations": { ... },
  "token_type": "Bearer"
}
```

Or if the token is invalid/expired:
```json
{
  "active": false
}
```

### What it does (step by step)

1. **Build the introspection request:**
   - URL: `{issuer}/protocol/openid-connect/token/introspect`
   - Method: POST
   - Body: `token={access_token}` (URL-encoded)
   - Auth: Basic auth with a **confidential client** (introspection requires client authentication)

2. **Send the HTTP request:**
   - Use `HttpURLConnection` (Java 8 compatible)
   - Set `Content-Type: application/x-www-form-urlencoded`
   - Set `Authorization: Basic {base64(client_id:client_secret)}`

3. **Parse the response:**
   - Check `active` field — if `false`, token is invalid
   - If `true`, extract claims from the response

4. **Return result** with steps logged.

### Confidential client requirement

Introspection requires client authentication (RFC 7662 Section 2.1). This means we need a **confidential client** (with a client secret) to call the introspect endpoint. The existing `poc-bff` client (confidential) can be used, or a new dedicated client can be created.

### Teaching value

Shows the fundamental difference between offline and online validation:
- **JWKS (offline):** "I have the public key, I can verify the signature myself"
- **Introspection (online):** "I'll ask the IdP directly if this token is good"

Trade-offs to discuss:
- Introspection adds network latency on every validation
- Introspection catches revoked tokens immediately (JWKS can't until the key rotates or token expires)
- Introspection requires a secret (confidential client); JWKS doesn't

---

## 11. Feature 7: Strategy D — Token Introspection with Nimbus

### Purpose

Demonstrate introspection using the **Nimbus OAuth 2.0 SDK** — the production-ready approach for online validation.

### Class

```
NimbusIntrospectionTokenValidator
  - Package: com.example.claims.auth.strategy
  - Dependencies: nimbus-jose-jwt 9.x, oauth2-oidc-sdk 11.x (Java 8 compatible)
  - Java compatibility: 8+
```

### Library version constraint

**Nimbus OAuth 2.0 SDK 11.x** — supports Java 8. This is a higher-level library that builds on nimbus-jose-jwt and adds OAuth2/OIDC protocol support.

Maven/Gradle:
```
com.nimbusds:oauth2-oidc-sdk:11.20
```

### What it does (step by step)

1. **Build the introspection request:**
   ```
   TokenIntrospectionRequest request = new TokenIntrospectionRequest(
       new URI(introspectionEndpoint),
       new ClientSecretBasic(new ClientID(clientId), new Secret(clientSecret)),
       new BearerAccessToken(accessToken)
   );
   ```

2. **Send and parse response:**
   ```
   TokenIntrospectionResponse response = TokenIntrospectionResponse.parse(
       request.toHTTPRequest().send()
   );
   TokenIntrospectionSuccessResponse successResponse = response.toSuccessResponse();
   boolean active = successResponse.isActive();
   ```

3. **Extract claims if active:**
   ```
   String subject = successResponse.getSubject().getValue();
   String email = successResponse.getStringParameter("email");
   // etc.
   ```

4. **Return result** with steps logged.

### Teaching value

Same comparison as JWKS vanilla vs. Nimbus — the library handles HTTP formatting, Basic auth encoding, response parsing, and error handling. Strategy C shows the raw protocol; Strategy D shows the production shortcut.

---

## 12. Keycloak Configuration

### Client setup for PKCE flow

The existing `poc-frontend` client needs these settings confirmed:

| Setting | Value | Why |
|---------|-------|-----|
| Client authentication | OFF | Public client — no secret needed for auth code request |
| Standard flow enabled | ON | Authorization Code flow |
| Direct access grants | ON | For fallback/research during development |
| Valid redirect URIs | `http://localhost:3000/*` | Where Keycloak can redirect after auth |
| Web origins | `http://localhost:3000` | CORS for headless OIDC (if using that approach) |
| PKCE code challenge method | S256 | Required for our PKCE flow |
| Proof Key for Code Exchange | enabled/enforced | Ensures PKCE is required |

### Confidential client for introspection

Strategies C and D need a confidential client to call the introspection endpoint. Options:
- Reuse existing `poc-bff` client (already confidential)
- Create a new `poc-introspection` client dedicated to this purpose

The client ID and secret must be available to the Spring backend as environment variables.

### CORS configuration for headless OIDC

Keycloak must allow CORS from `http://localhost:3000` on the auth and login-actions endpoints. The client's "Web Origins" setting may or may not cover these endpoints — see [OQ-1](#oq-1-cors-on-keycloak-auth-endpoints-only-big-question) for the investigation plan and fallback strategies.

---

## 13. API Contract

### New endpoints

| Method | Path | Auth required? | Description |
|--------|------|---------------|-------------|
| `POST` | `/api/auth/pkce-callback` | No (permitAll) | Receives auth code + verifier + strategy, exchanges for tokens, validates, returns result |

### Request: POST /api/auth/pkce-callback

```json
{
  "authorizationCode": "string (required)",
  "codeVerifier": "string (required)",
  "strategy": "string (required) — one of: jwks-vanilla, jwks-nimbus, introspect-vanilla, introspect-nimbus",
  "redirectUri": "string (required) — must match the redirect_uri used in the auth request"
}
```

### Response: 200 OK

```json
{
  "success": true,
  "strategy": "jwks-vanilla",
  "strategyLabel": "JWKS — Vanilla Java (raw JDK crypto)",
  "tokenSummary": {
    "subject": "user-uuid",
    "email": "admin@test.com",
    "name": "Admin User",
    "expiresAt": "2026-02-22T15:30:00Z",
    "expiresInSeconds": 298,
    "issuer": "https://your-realm.phasetwo.io/realms/your-realm",
    "organizations": {
      "acme-uuid": {
        "name": "Acme Corporation",
        "roles": ["admin", "billing"]
      }
    },
    "loyaltyTier": "gold"
  },
  "validationDetails": {
    "method": "RSA signature verification using java.security.Signature (SHA256withRSA)",
    "offlineValidation": true,
    "librariesUsed": ["none — vanilla JDK only"],
    "steps": [
      "Fetched JWKS from https://.../.well-known/jwks.json (234ms)",
      "Parsed 2 keys from JWKS response",
      "Matched JWT kid 'abc123' to JWKS key",
      "Extracted RSA modulus (2048-bit) and exponent from JWK",
      "Built java.security.interfaces.RSAPublicKey",
      "Decoded JWT: 3 parts (header.payload.signature)",
      "Verified SHA256withRSA signature — VALID",
      "Checked expiration: expires in 298 seconds — OK",
      "Checked issuer: matches expected — OK",
      "Token validation PASSED"
    ],
    "durationMs": 312
  }
}
```

### Response: 401 Unauthorized (invalid credentials / bad auth code)

```json
{
  "success": false,
  "strategy": "jwks-vanilla",
  "error": "Authorization code exchange failed: invalid_grant",
  "validationDetails": {
    "steps": [
      "Sent authorization code to Keycloak token endpoint",
      "FAILED: Keycloak returned 'invalid_grant' — code may be expired or already used"
    ]
  }
}
```

### Response: 400 Bad Request (invalid strategy)

```json
{
  "success": false,
  "error": "Invalid strategy: 'unknown'. Must be one of: jwks-vanilla, jwks-nimbus, introspect-vanilla, introspect-nimbus"
}
```

---

## 14. Open Questions

### OQ-1: CORS on Keycloak auth endpoints (ONLY BIG QUESTION)

**Decision made:** We are using **headless OIDC** — React calls Keycloak's auth/login-actions endpoints via `fetch()`. The full technical approach is documented in [Section 6a](#6a-headless-oidc-deep-dive).

**The remaining question is purely about CORS:**

Keycloak's "Web Origins" client setting adds CORS headers to `/token`, `/userinfo`, and `/logout` endpoints. It does NOT typically cover the `/auth` or `/login-actions/authenticate` endpoints because those are designed for browser navigation, not API calls.

**What we need to confirm during build:**
1. Does Phase Two's hosted Keycloak respect "Web Origins" on the auth/login-actions endpoints?
2. If not, does Phase Two expose realm-level CORS configuration?
3. If neither works, implement the **Next.js API route proxy** (documented in Section 6a) — a few lines of code that forward requests server-to-server, bypassing CORS entirely.
4. If the proxy feels too hacky, fall back to the **minimal-redirect approach** (also documented in Section 6a) — user still picks strategy on our page, but authenticates on Keycloak's page via redirect.

**Expected resolution:** Try CORS first (5 minutes). If blocked, implement the proxy (30 minutes). The rest of the spec is unaffected regardless of which approach we use — the auth code arrives at React either way.

### Minor items (resolve during build)

**JSON parsing in vanilla strategies:** Use `org.json:json:20240303` — tiny library, zero transitive dependencies, Java 8 compatible. The one utility dependency for the portable classes.

**Result display in React UI:** Detailed view with expandable steps (default collapsed). Show the validation steps array and extracted token claims. A side-by-side comparison mode is a nice v1.3.1 enhancement.

---

## 15. What NOT to Build

| Feature | Why not |
|---------|---------|
| Full session management after PKCE auth | v1.3 focuses on auth + validation demo. Session integration (injecting tokens into Auth.js or custom cookies) is a separate increment. |
| Dashboard/claims integration for PKCE sessions | After PKCE auth, the user sees the validation result page, not the full claims dashboard. Dashboard integration comes later. |
| Token refresh for PKCE sessions | The demo validates a single token. Refresh token handling is out of scope. |
| Custom Keycloak themes | The login UI is on our side; we don't need to customize Keycloak's hosted page. |
| Rate limiting on the auth endpoint | Not needed for a POC. |
| Brute force protection on our login form | Keycloak handles this at the IdP level (lockout after 5 failed attempts). |
| Additional validation strategies (SAML, mTLS, etc.) | Four strategies is enough to demonstrate the concepts. |
| Java 8 separate build target | The code is written to be Java 8 compatible, but we don't set up a separate Java 8 compilation pipeline. That's a future concern. |

---

## 16. Success Criteria

### Demo script

After v1.3, this flow should be possible:

1. **Navigate to `/login`** → See custom login page with two sections: "Login with CIAM Provider" and "Sign in with PKCE"
2. **Select "JWKS — Vanilla Java"** from the dropdown → InfoPanel shows explanation: "raw JDK crypto, no libraries, Java 8 compatible"
3. **Enter test credentials** (admin@test.com / password) → Click "Sign In with PKCE"
4. **Auth code obtained** → React shows "Authorization code received" (brief flash)
5. **Backend validates** → See detailed response:
   - Strategy: "JWKS — Vanilla Java"
   - Token claims: email, organizations, loyalty tier
   - Validation steps: "Fetched JWKS... Parsed keys... Verified signature... Token VALID"
   - Duration: 312ms
6. **Change dropdown to "Introspection — Vanilla HTTP"** → Repeat login
7. **Compare results:** Same token claims, different validation steps ("Called introspection endpoint... Token active... Claims extracted from introspection response")
8. **Try "JWKS — Nimbus"** → See dramatically fewer steps (library handles the details)
9. **Try invalid credentials** → See clear error: "Authorization code exchange failed"
10. **Click "Login with CIAM Provider"** → Taken through the existing Auth.js/Keycloak redirect flow → Land on dashboard as usual

### Measurable outcomes

| Metric | v1.2.1 | v1.3 target |
|--------|--------|-------------|
| Authentication methods | 1 (BFF OIDC redirect) | 5 (1 existing + 4 PKCE strategies) |
| Token validation strategies visible | 0 (hidden in Spring Security) | 4 (each with step-by-step breakdown) |
| Lines of portable Java 8 auth code | 0 | ~400-600 across 4 strategy classes |
| New Spring endpoints | 0 | 1 (`/api/auth/pkce-callback`) |
| New frontend pages | 0 | 1 (`/login`) |

### Teaching verification

A developer reviewing the code should be able to:
- Read `VanillaJwksTokenValidator` and understand exactly how JWT signature verification works
- Read `VanillaIntrospectionTokenValidator` and understand how introspection works
- Compare vanilla vs. Nimbus implementations and see what the library abstracts
- Take any of the 4 strategy classes, drop them into a Java 8 project, and have them compile and run
