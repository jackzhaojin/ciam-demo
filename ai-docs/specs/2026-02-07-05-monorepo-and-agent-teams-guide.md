---
title: "Monorepo Structure & Claude Code Agent Teams Playbook"
project: ciam-demo-private
sub_project: ciam-demo-private
type: spec
date: 2026-02-07
tags: []
why_private: "contains unpublished architecture decisions and internal specifications"
status: stable
source_repo: https://github.com/jackzhaojin/ciam-demo-private.git
source_tool: claude-code
harvested: 2026-03-28
---

# Monorepo Structure & Claude Code Agent Teams Playbook

## PoC Build Plan — How We Ship This

**Document Purpose:** This document defines the monorepo layout for the CIAM PoC and provides a step-by-step guide for using Claude Code's **Agent Teams** feature to build the three workstreams (CIAM setup, Spring Boot backend, Next.js application) in parallel.

**Audience:** The human operator running Claude Code. Also useful for AI agents reading the CLAUDE.md.

**Companion Specifications:** This playbook assumes the following three specification documents already exist and are placed in the `ai-docs/` directory of the monorepo. These are the source of truth for what gets built:

| Spec File | Covers | Located At |
|-----------|--------|------------|
| `ciam-specification.md` | Keycloak IdP setup, identity brokering, B2B org modeling, auth patterns (OIDC/OAuth contracts) | `ai-docs/ciam-specification.md` |
| `spring-boot-claims-spec.md` | Spring Boot backend service — domain model, API endpoints, database, JWT validation, service-to-service auth | `ai-docs/spring-boot-claims-spec.md` |
| `nextjs-claims-app-spec.md` | Next.js application — Auth.js/Keycloak integration, pages/features, org context, UI | `ai-docs/nextjs-claims-app-spec.md` |

**AI agents must read the relevant spec(s) before writing any code.** The specs define the contracts between the three workstreams.

---

## 1. Monorepo Structure

```
ciam-claims-poc/
├── CLAUDE.md                         # Root-level instructions for Claude Code
├── README.md                         # Project overview and getting started
├── .gitignore
├── .env.example                      # All env vars across all projects
├── .env                              # gitignored — actual secrets
│
├── ai-docs/                             # Specification & guide documents
│   ├── kickoff-guide.md              # ← start here
│   ├── ciam-specification.md
│   ├── spring-boot-claims-spec.md
│   ├── nextjs-claims-app-spec.md
│   ├── monorepo-and-agent-teams-guide.md
│   ├── deployment-guide.md
│   └── claude-code-kickoff-prompt.md
│
├── ciam/                             # CIAM setup scripts & config
│   ├── CLAUDE.md                     # Agent instructions for CIAM workstream
│   ├── README.md
│   ├── scripts/
│   │   ├── 01-configure-realm.sh
│   │   ├── 02-configure-user-profile.sh
│   │   ├── 03-configure-social-idps.sh
│   │   ├── 04-register-clients.sh
│   │   ├── 05-configure-token-mappers.sh
│   │   ├── 06-create-organizations.sh
│   │   ├── 07-create-org-roles.sh
│   │   ├── 08-create-test-users.sh
│   │   └── setup-all.sh              # Runs all scripts in order
│   └── test/
│       └── verify-setup.sh           # Smoke tests against Keycloak
│
├── claims-api/                       # Spring Boot backend
│   ├── CLAUDE.md                     # Agent instructions for backend workstream
│   ├── build.gradle.kts
│   ├── settings.gradle.kts
│   ├── gradlew / gradlew.bat
│   ├── Dockerfile
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/poc/claims/
│   │   │   └── resources/
│   │   │       ├── application.yml
│   │   │       └── db/migration/     # Flyway
│   │   └── test/
│   └── README.md
│
├── claims-web/                       # Next.js application
│   ├── CLAUDE.md                     # Agent instructions for web app workstream
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── auth.ts
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   └── types/
│   ├── tests/
│   └── README.md
│
├── .github/
│   └── workflows/                    # GitHub Actions CI/CD
│       ├── claims-api.yml
│       └── claims-web.yml
└── docker-compose.yml                # Optional: local Keycloak + Postgres for offline dev
```

### 1.1 Key Design Decisions

**No dev containers.** Development runs directly on the host with JDK 21 (eclipse-temurin) and Node.js 22 LTS installed locally. Docker images are for production CI/CD only (see `deployment-guide.md`).

**Separate CLAUDE.md per workstream.** Each subdirectory (`ciam/`, `claims-api/`, `claims-web/`) has its own `CLAUDE.md` with context specific to that part. The root `CLAUDE.md` provides the big picture and cross-cutting concerns.

**Specs in `ai-docs/`.** All specification and guide documents live in `ai-docs/`. The kickoff guide (`kickoff-guide.md`) is the entry point — read it first.

**Single `.env` at the root.** All three workstreams share the same Keycloak instance and environment. One `.env` file with all variables. Each project's config references `${VARIABLE}` from this shared source.

### 1.2 Root CLAUDE.md (Draft)

```markdown
# CIAM Claims PoC

## Project Overview
This is a monorepo containing three workstreams for a CIAM proof of concept:
- `ciam/` — Keycloak IdP setup scripts (bash, runs against Phase Two cloud)
- `claims-api/` — Spring Boot backend (Java 21, Gradle, Supabase Postgres)
- `claims-web/` — Next.js application (TypeScript, Auth.js, Tailwind, shadcn/ui)

## Specifications (READ FIRST)
Before making changes to any workstream, read the relevant spec(s) in `ai-docs/`:
- `ai-docs/ciam-specification.md` — Identity provider setup, auth patterns, token contracts
- `ai-docs/spring-boot-claims-spec.md` — Backend service: domain model, API, security
- `ai-docs/nextjs-claims-app-spec.md` — Next.js application: auth, pages, UI, org context

These specs are the source of truth. They define the contracts between workstreams.

## Environment
All secrets are in `.env` at the repo root. Never hardcode secrets.
See `.env.example` for the full list of required variables.

## Security
All requests between claims-web and claims-api MUST be authenticated.
See Section 2 of the monorepo playbook for the full security model.
Token validation is NOT optional — it's the core of what this PoC proves.

## Cross-Cutting Concerns
- The Keycloak issuer URI, client IDs, and client secrets are shared across all three workstreams
- The Spring Boot backend runs on port 8080
- The Next.js application runs on port 3000
- Both apps must be running for E2E flows to work
- The CIAM scripts must be run first to configure Keycloak before either app works

## Testing
- `ciam/`: Run `./ciam/test/verify-setup.sh` to verify Keycloak is configured
- `claims-api/`: Run `cd claims-api && ./gradlew test`
- `claims-web/`: Run `cd claims-web && pnpm test`
```

---

## 2. Security & Token Validation

This is the core of what the PoC proves. Every layer must validate identity and enforce authorization. This section pulls together the security contracts defined across all three specs into one view.

### 2.1 End-to-End Auth Flow

```
Browser                    Next.js (claims-web)              Spring Boot (claims-api)         Keycloak
  │                              │                                  │                            │
  │  1. Click "Sign In"          │                                  │                            │
  │─────────────────────────────>│                                  │                            │
  │                              │  2. Redirect to Keycloak         │                            │
  │<─────────────────────────────│──────────────────────────────────────────────────────────────>│
  │                              │                                  │                            │
  │  3. User authenticates (email/password, Google, etc.)           │                            │
  │────────────────────────────────────────────────────────────────────────────────────────────>│
  │                              │                                  │                            │
  │  4. Keycloak redirects with auth code                           │                            │
  │<───────────────────────────────────────────────────────────────────────────────────────────│
  │─────────────────────────────>│                                  │                            │
  │                              │  5. Exchange code for tokens (server-side, with client secret)│
  │                              │─────────────────────────────────────────────────────────────>│
  │                              │  6. Receives: access_token, id_token, refresh_token          │
  │                              │<─────────────────────────────────────────────────────────────│
  │                              │                                  │                            │
  │  7. Session cookie set       │  8. Tokens stored server-side    │                            │
  │<─────────────────────────────│  (never sent to browser)         │                            │
  │                              │                                  │                            │
  │  9. User requests data       │                                  │                            │
  │─────────────────────────────>│                                  │                            │
  │                              │  10. API call with:              │                            │
  │                              │      Authorization: Bearer {AT}  │                            │
  │                              │      X-Organization-Id: {orgId}  │                            │
  │                              │─────────────────────────────────>│                            │
  │                              │                                  │  11. Validate JWT:         │
  │                              │                                  │      - Fetch JWKS from KC  │
  │                              │                                  │      - Verify signature    │
  │                              │                                  │      - Check expiry        │
  │                              │                                  │      - Check issuer        │
  │                              │                                  │      - Check audience      │
  │                              │                                  │      - Extract claims      │
  │                              │                                  │                            │
  │                              │                                  │  12. Authorize:            │
  │                              │                                  │      - Check org membership│
  │                              │                                  │      - Check org roles     │
  │                              │                                  │      - Enforce permissions  │
  │                              │                                  │                            │
  │                              │  13. Return data                 │                            │
  │  14. Render page             │<─────────────────────────────────│                            │
  │<─────────────────────────────│                                  │                            │
```

### 2.2 Token Validation — What Each Layer Does

**This is NOT optional.** The PoC must implement all of these to be credible.

#### Keycloak (CIAM) — Token Issuance

| Responsibility | How | Spec Reference |
|---------------|-----|----------------|
| Issue signed JWTs | RSA/EC key pair, auto-rotated | CIAM spec §1.3.7 |
| Include identity claims | `sub`, `email`, `name`, `email_verified` | CIAM spec §2.4.6 |
| Include custom claims | `loyalty_tier` (via protocol mapper) | CIAM spec §1.3.6 |
| Include org claims | `organizations` with roles and attributes | CIAM spec §2.4.6 |
| Enforce token lifespans | 5-min access token, 30-min idle, 10-hr max | CIAM spec §1.3.1 |
| Publish JWKS | `{issuer}/protocol/openid-connect/certs` | CIAM spec §1.3.7 |

#### Spring Boot (claims-api) — Token Validation & Authorization

| Responsibility | How | Spec Reference |
|---------------|-----|----------------|
| **Validate JWT signature** | Fetch JWKS from Keycloak, verify RSA/EC signature | Spring Boot spec §3.1, CIAM spec Pattern 4A |
| **Check token expiry** | Reject expired tokens (standard JWT `exp` claim) | Spring Security auto-handles |
| **Check issuer** | Token `iss` must match configured `KEYCLOAK_ISSUER_URI` | Spring Boot spec §3.1 |
| **Check audience** | Token `aud` must include the expected client ID | Spring Security config |
| **Extract user identity** | Read `sub`, `email` from token for audit logging | Spring Boot spec §3.3 |
| **Extract org context** | Read `X-Organization-Id` header, validate against `organizations` claim in token | Spring Boot spec §3.3 |
| **Enforce org membership** | Reject requests where user is not a member of the requested org | Spring Boot spec §3.3 |
| **Enforce org roles** | Check `organizations.{org}.roles` for required permissions per endpoint | Spring Boot spec §4.2 |
| **Cache JWKS** | Cache the public keys, refresh periodically (not on every request) | CIAM spec §3.5 |
| **Handle 401/403** | Return 401 for invalid/missing token, 403 for insufficient permissions | Standard REST |

**Implementation checklist for the Spring Boot agent:**
```
[ ] Spring Security OAuth2 Resource Server configured with issuer-uri
[ ] JWKS auto-fetched and cached (Spring Security does this by default)
[ ] Custom JwtAuthenticationConverter to extract org claims from token
[ ] OrgContext filter/interceptor that reads X-Organization-Id header
[ ] OrgContext validated against token's organizations claim
[ ] Role-based method security (@PreAuthorize or programmatic checks)
[ ] 401 returned for missing/invalid/expired tokens
[ ] 403 returned for valid token but insufficient org role
[ ] Audit: actorUserId in ClaimEvent populated from token sub claim
```

#### Next.js (claims-web) — Session Security & Token Proxying

| Responsibility | How | Spec Reference |
|---------------|-----|----------------|
| **Handle OIDC flow** | Auth.js manages code exchange, PKCE, token storage | Next.js spec §2.1 |
| **Store tokens server-side** | Encrypted HTTP-only session cookie (Auth.js default) | Next.js spec §2.3 |
| **Never expose tokens to browser** | Access token stays in server-side session | Next.js spec §2.3 |
| **Proxy API calls** | Server Components and Server Actions attach Bearer token to Spring Boot calls | Next.js spec §4.1 |
| **Attach org context** | Send `X-Organization-Id` header on every proxied API call | Next.js spec §2.4 |
| **Handle token refresh** | Auth.js refreshes expired access tokens using refresh token | CIAM spec Pattern 5 |
| **Protect routes** | Next.js middleware redirects unauthenticated users to login | Next.js spec §8 (`middleware.ts`) |
| **Role-based UI** | Hide/show UI elements based on org roles from session | Next.js spec §3.3 |
| **Handle session expiry** | Redirect to login on 401 from Spring Boot or expired session | Next.js spec §4.3 |

**Implementation checklist for the Next.js agent:**
```
[ ] Auth.js configured with Keycloak provider
[ ] jwt callback extracts access_token, organizations, loyalty_tier from Keycloak token
[ ] session callback surfaces org data and roles to client-safe session
[ ] middleware.ts protects /dashboard, /claims/*, /admin/* routes
[ ] Server Components read session and attach Bearer token to fetch calls
[ ] X-Organization-Id header sent on every backend call
[ ] Token refresh implemented (Auth.js handles this if configured)
[ ] 401 from backend triggers redirect to /api/auth/signin
[ ] Admin routes check for admin role before rendering
```

### 2.3 What NOT To Do

- **Do not disable token validation for "convenience."** Every API call must be authenticated.
- **Do not send access tokens to the browser.** Use the BFF pattern — tokens stay server-side.
- **Do not skip org context validation.** A user with a valid token should NOT see another org's claims.
- **Do not hardcode test tokens.** Use proper OIDC flows even in development.
- **Do not trust the `X-Organization-Id` header without validating it against the token.** The header is a hint; the token is the authority.

---

## 3. Claude Code Agent Teams — What It Is

Agent Teams is a **research preview** feature released with Claude Opus 4.6 (February 2026). It enables multiple Claude Code instances to work **in parallel** on the same codebase, each with their own independent context window.

**How it differs from subagents:**
- **Subagents** run within a single session and return results to the caller. Good for "go research X and report back."
- **Agent Teams** are fully independent Claude Code instances that message each other directly. They work in separate git worktrees so they don't step on each other's files. Good for "build these three things in parallel."

**Architecture:**
```
You (Human / Team Lead)
  └── Claude Code (Leader)
        ├── Teammate: "ciam-setup"      → works in its own worktree
        ├── Teammate: "backend-dev"     → works in its own worktree
        └── Teammate: "web-dev"         → works in its own worktree
```

Each teammate:
- Has its own context window (doesn't share context with others)
- Works on its own git worktree (file changes don't conflict)
- Can message other teammates and the leader
- Claims tasks from a shared task list

---

## 4. Step-by-Step: Using Agent Teams for This PoC

### Prerequisites

1. **Claude Code installed and updated:**
   ```bash
   npm update -g @anthropic-ai/claude-code
   claude --version
   # Should be 2.1.29 or later
   ```

2. **Enable the feature flag:**
   ```bash
   # Option A: Set environment variable (recommended)
   export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

   # Option B: Add to your Claude Code settings
   # In Claude Code, run: /settings
   # Enable "agent teams" under experimental features
   ```

3. **tmux installed** (agent teams uses tmux for split panes):
   ```bash
   # macOS
   brew install tmux

   # Ubuntu/Debian
   sudo apt install tmux
   ```

4. **Your repo initialized with the specs already in place:**
   ```bash
   mkdir ciam-claims-poc && cd ciam-claims-poc
   git init
   
   # Create the directory structure
   mkdir -p docs ciam/scripts ciam/test claims-api claims-web
   
   # The three spec files should already exist. Copy them into ai-docs/:
   cp /path/to/ciam-specification.md ai-docs/
   cp /path/to/spring-boot-claims-spec.md ai-docs/
   cp /path/to/nextjs-claims-app-spec.md ai-docs/
   
   # Create the CLAUDE.md files (see Section 5)
   # Create .env.example (see Section 1)
   ```

### Step 1: Start Claude Code in the Monorepo Root

```bash
cd ciam-claims-poc
claude
```

### Step 2: Ask Claude to Use a Team

You don't need special commands — just describe the work and ask for a team. Claude will use the TeammateTool to orchestrate.

**Example prompt:**

```
I need to build this CIAM claims PoC. Read all three spec documents in ai-docs/ first:
- ai-docs/ciam-specification.md
- ai-docs/spring-boot-claims-spec.md
- ai-docs/nextjs-claims-app-spec.md

Then create a team of specialists:

1. A "ciam-setup" teammate that builds the Keycloak setup scripts in ciam/ 
   (reads ai-docs/ciam-specification.md)
2. A "backend-dev" teammate that builds the Spring Boot claims API in claims-api/ 
   (reads ai-docs/spring-boot-claims-spec.md and ai-docs/ciam-specification.md for auth contracts)
3. A "web-dev" teammate that builds the Next.js application in claims-web/ 
   (reads ai-docs/nextjs-claims-app-spec.md and ai-docs/ciam-specification.md for auth contracts)

Start with ciam-setup first (the other two depend on Keycloak config).
Then work on backend-dev and web-dev in parallel once CIAM scripts are ready.

Security is critical — every API call must be authenticated with a valid JWT. 
The backend must validate tokens via JWKS. The Next.js app must never expose 
tokens to the browser. See the security section in the monorepo playbook.

Use the CLAUDE.md files in each directory for workstream-specific context.
Please use a team of specialists for this.
```

### Step 3: Approve the Plan

Claude (as team leader) will:
1. Read the specs
2. Create a plan with tasks for each teammate
3. Present the plan to you for approval

Review the plan. You can modify it before approving. Once approved, Claude spawns the teammates.

### Step 4: Monitor Progress

When teammates are running, you'll see them in tmux split panes (if using terminal) or can check status:

```bash
# If running in tmux, you'll see split panes
# Switch between panes: Ctrl+B then arrow keys

# Claude (as leader) will periodically report status
# You can also ask: "How are the teammates doing?"
```

**Permission modes during team work:**
- **Normal mode:** You approve each action (slow but safe)
- **Auto-accept mode:** Teammates run without asking permission (fast but risky)
- **Delegate mode:** Leader only coordinates, doesn't write code directly (recommended for teams)

Toggle with `Shift+Tab` in the Claude Code session.

### Step 5: Handle Dependencies

The teammates will need to coordinate. The key dependency chain:

```
ciam-setup (FIRST)
  │
  ├── creates Keycloak clients → backend-dev needs client IDs/secrets
  ├── creates test users → both apps need them for testing
  └── configures token mappers → both apps need to know the claim structure
  │
  ├── backend-dev (PARALLEL after CIAM)
  │     └── creates API endpoints → web-dev needs these contracts
  │
  └── web-dev (PARALLEL after CIAM)
        └── can start with mock data, then integrate with real backend
```

Tell Claude about this in your initial prompt (as shown in Step 2). The leader will create task dependencies so teammates wait appropriately.

### Step 6: Review and Merge

Each teammate works in its own git worktree. When work is complete:
1. Leader reports completion
2. Review the changes in each worktree
3. Claude can merge the worktrees back to main
4. Run tests across all workstreams:
   ```bash
   ./ciam/test/verify-setup.sh
   cd claims-api && ./gradlew test
   cd claims-web && pnpm test
   ```

---

## 5. CLAUDE.md Strategy for Agent Teams

Each teammate reads the `CLAUDE.md` in its working directory. Make these specific and actionable.

### `ciam/CLAUDE.md`
```markdown
# CIAM Setup Workstream

## What You're Building
Bash scripts that configure Keycloak via the Admin REST API.

## Specification
Read `ai-docs/ciam-specification.md` — it is the source of truth for this workstream.

## Key Context
- Keycloak is hosted on Phase Two (cloud)
- Base URL and credentials are in `.env` at the repo root
- Admin tokens expire in 60 seconds — implement a refresh wrapper
- All scripts should be idempotent (safe to re-run)

## Scripts to Create
See the `scripts/` directory structure. Each script handles one concern.
`setup-all.sh` runs them in order.

## Token Mappers (CRITICAL for Security)
The token mapper configuration in 05-configure-token-mappers.sh determines what
claims appear in the JWT. The backend and web app both depend on these claims:
- `loyalty_tier` — from user attribute
- `organizations` — from Phase Two Organizations extension
Both must appear in the access_token and id_token.
Without correct mappers, the entire security model breaks.

## Testing
Create `test/verify-setup.sh` that validates:
- Realm is configured correctly
- Social IdPs are registered
- Clients exist with correct settings (poc-backend, poc-bff)
- Token mappers produce expected claims (loyalty_tier, organizations)
- Organizations exist with roles (admin, billing, viewer)
- Test users exist and can authenticate
- Test user's token actually contains org claims (decode and verify)

## Done Criteria
- All scripts run without errors against Phase Two
- verify-setup.sh passes
- Test user can obtain a token via curl and the token contains org claims
```

### `claims-api/CLAUDE.md`
```markdown
# Claims API Workstream

## What You're Building
A Spring Boot REST API for insurance claims.

## Specifications
Read BOTH of these before writing code:
- `ai-docs/spring-boot-claims-spec.md` — primary spec for this workstream
- `ai-docs/ciam-specification.md` — auth contracts (token structure, JWKS, endpoints)

## Key Context
- Java 21, Spring Boot 3.x (latest stable), Gradle Kotlin DSL
- Supabase PostgreSQL — connection string in `.env`
- Flyway for migrations
- Spring Security OAuth2 Resource Server for JWT validation
- Keycloak issuer URI in `.env`

## Security (CRITICAL — READ THIS FIRST)
This service MUST validate every incoming JWT. This is the core of the PoC.

1. Configure Spring Security OAuth2 Resource Server with Keycloak issuer URI
2. JWKS is auto-fetched and cached by Spring Security — do not manage keys manually
3. Create a custom JwtAuthenticationConverter to extract:
   - `sub` (user ID) — used for audit logging (actorUserId in ClaimEvent)
   - `email` — used for display
   - `organizations` — the full org membership map from the token
4. Create an OrgContext filter/interceptor that:
   - Reads the `X-Organization-Id` header from the request
   - Looks up that org ID in the token's `organizations` claim
   - REJECTS the request with 403 if the user is NOT a member of that org
   - Makes the org context (org ID + user's roles in that org) available to controllers/services
5. Enforce role-based access per endpoint:
   - `viewer` → GET only
   - `admin` → full CRUD + approve/deny
   - `billing` → GET + approve
   - Any org member → create and submit their own claims
6. Return 401 for missing/invalid/expired tokens
7. Return 403 for valid token but insufficient org role or wrong org

Implementation checklist:
[ ] spring-boot-starter-oauth2-resource-server in build.gradle.kts
[ ] issuer-uri configured in application.yml from KEYCLOAK_ISSUER_URI env var
[ ] Custom JwtAuthenticationConverter extracts org claims
[ ] OrgContext filter reads X-Organization-Id, validates against token
[ ] @PreAuthorize or programmatic role checks on each controller method
[ ] ClaimEvent.actorUserId populated from token sub
[ ] Tests with mocked JWTs (SecurityMockMvcRequestPostProcessors.jwt())
[ ] Test: request without token → 401
[ ] Test: request with valid token but wrong org → 403
[ ] Test: admin can approve, viewer cannot → 403

## Build Order
1. Project scaffold (build.gradle.kts, application.yml, main class)
2. Flyway migrations (V1__create_claims.sql, V2__create_claim_events.sql)
3. JPA entities and repositories
4. Security config (JWT validation, org context extraction)
5. Service layer (claim lifecycle, status transitions)
6. REST controllers
7. Tests (including security tests with mocked JWTs)

## Done Criteria
- `./gradlew test` passes
- All endpoints from the spec are implemented
- JWT validation works with Keycloak tokens
- Org context filtering and role enforcement works
- Requests without valid tokens return 401
- Requests to wrong org return 403
```

### `claims-web/CLAUDE.md`
```markdown
# Claims Web Workstream

## What You're Building
A Next.js application for the claims system.

## Specifications
Read BOTH of these before writing code:
- `ai-docs/nextjs-claims-app-spec.md` — primary spec for this workstream
- `ai-docs/ciam-specification.md` — auth contracts (OIDC flow, token structure)

## Key Context
- Next.js App Router, TypeScript, pnpm
- Auth.js (next-auth v5) with Keycloak provider
- Tailwind CSS + shadcn/ui for styling
- Server Components where possible
- Spring Boot API at BACKEND_URL (in .env)

## Security (CRITICAL — READ THIS FIRST)
The BFF (Backend-for-Frontend) pattern is mandatory. Tokens NEVER reach the browser.

1. Auth.js handles the OIDC flow with Keycloak:
   - Authorization Code + PKCE
   - Code exchange happens server-side (Auth.js route handler)
   - Tokens stored in encrypted HTTP-only session cookie
2. Custom Auth.js callbacks:
   - `jwt` callback: extract access_token, refresh_token, expires_at, 
     organizations, loyalty_tier from the Keycloak token
   - `session` callback: surface org membership and roles to the client-safe session
     (but NOT the raw access_token — only the derived data)
3. Token refresh:
   - In the `jwt` callback, check if access_token has expired
   - If expired, POST to Keycloak token endpoint with grant_type=refresh_token
   - If refresh fails, set token.error = "RefreshAccessTokenError"
4. Route protection:
   - middleware.ts checks for valid session on /dashboard, /claims/*, /admin/*
   - Unauthenticated → redirect to sign-in
   - Expired session (refresh failed) → redirect to sign-in with message
5. API calls to Spring Boot:
   - Server Components read the session to get the access token
   - Attach `Authorization: Bearer {access_token}` header
   - Attach `X-Organization-Id: {selectedOrgId}` header
   - Handle 401 response → redirect to sign-in
   - Handle 403 response → show "not authorized" (don't redirect)
6. Role-based UI:
   - Read organizations.{currentOrg}.roles from session
   - Hide admin actions (review queue, approve/deny) from non-admin users
   - Hide create/edit from viewers

Implementation checklist:
[ ] Auth.js configured with Keycloak provider (clientId, clientSecret, issuer)
[ ] AUTH_SECRET env var set for session encryption
[ ] jwt callback extracts custom claims from Keycloak token
[ ] jwt callback implements token refresh
[ ] session callback surfaces org data (but not raw tokens) to client
[ ] middleware.ts protects authenticated routes
[ ] API client attaches Bearer token and X-Organization-Id to all backend calls
[ ] 401 from backend triggers redirect to login
[ ] Admin-only UI hidden from non-admin users
[ ] Verify in browser DevTools Network tab: no raw JWTs in any response

## Build Order
1. Project scaffold (create-next-app, tailwind, shadcn/ui init)
2. Auth.js setup with Keycloak (jwt + session callbacks for custom claims)
3. middleware.ts for route protection
4. Root layout with auth provider, org context provider
5. Landing page with sign-in
6. Dashboard (claims list)
7. File a claim form
8. Claim detail + timeline
9. Admin review queue
10. Org switcher in header
11. Tests

## Done Criteria
- `pnpm test` passes
- `pnpm build` succeeds with no errors
- Auth flow works end-to-end with Keycloak
- Claims CRUD works against Spring Boot API
- Org switching changes the visible claims
- Admin-only UI is hidden from viewer/billing roles
- No tokens exposed to browser (verify in DevTools Network tab)
```

---

## 6. Alternative: Sequential Build Without Agent Teams

If you prefer not to use agent teams (or hit issues with the research preview), you can build sequentially with standard Claude Code:

```bash
# Terminal 1: Build CIAM setup
cd ciam-claims-poc
claude
> Read ai-docs/ciam-specification.md and build the scripts in ciam/

# Terminal 2: Build Spring Boot (after CIAM is done)
cd ciam-claims-poc/claims-api
claude
> Read ai-docs/spring-boot-claims-spec.md and ai-docs/ciam-specification.md, then build this service

# Terminal 3: Build Next.js (can start in parallel with Spring Boot)
cd ciam-claims-poc/claims-web
claude
> Read ai-docs/nextjs-claims-app-spec.md and ai-docs/ciam-specification.md, then build this app
```

You can also use **git worktrees** manually:
```bash
# Create worktrees for parallel Claude Code sessions
git worktree add ../poc-backend-worktree -b feature/backend
git worktree add ../poc-web-worktree -b feature/web

# Run separate Claude Code sessions in each worktree
# Merge back when done
```

---

## 7. Known Limitations (Agent Teams Research Preview)

As of February 2026, agent teams has these known limitations:
- **No session resumption** — if the leader session ends, teammates stop
- **One team per session** — can't run multiple teams simultaneously
- **No nested teams** — teammates can't spawn their own teams
- **Split panes don't work in VS Code terminal** — use iTerm2 or standard terminal with tmux
- **Token-intensive** — multiple agents burn through tokens fast. Budget accordingly.
- **Experimental** — behavior may change. If things break, fall back to the sequential approach in Section 6.

---

## 8. Execution Checklist

```
[ ] 1. Create the monorepo directory structure (Section 1)
[ ] 2. Copy the three spec files into ai-docs/ (they already exist — just place them)
[ ] 3. Create CLAUDE.md files — root + each workstream (Section 5)
[ ] 4. Create .env.example with all required variables
[ ] 5. Set up Phase Two account and fill in .env (manual — see CIAM spec §1.2)
[ ] 6. Register OAuth apps with Google/Microsoft/Facebook (manual — see CIAM spec §1.2)
[ ] 7. Set up Supabase project and add JDBC URL to .env (manual)
[ ] 8. Update Claude Code: npm update -g @anthropic-ai/claude-code
[ ] 9. Verify version ≥ 2.1.29: claude --version
[ ] 10. Enable agent teams: export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
[ ] 11. Install tmux if not installed
[ ] 12. Start Claude Code in the monorepo root: claude
[ ] 13. Prompt for team creation (use the prompt from Section 4, Step 2)
[ ] 14. Approve the plan and let it run
[ ] 15. Review, merge, and run tests across all workstreams
[ ] 16. Test end-to-end: login → create claim → approve claim → verify in DB
```

---

*This playbook defines the monorepo structure and the build process. The three specification documents in `ai-docs/` (`ciam-specification.md`, `spring-boot-claims-spec.md`, `nextjs-claims-app-spec.md`) define what gets built. This document defines how it gets built and how security is enforced across all layers.*
