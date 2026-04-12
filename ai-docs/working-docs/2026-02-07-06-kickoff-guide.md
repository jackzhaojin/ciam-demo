---
title: "CIAM Claims PoC — Kickoff Guide"
project: ciam-demo-private
sub_project: ciam-demo-private
type: working-doc
date: 2026-02-07
tags: []
why_private: "contains internal development guidance and architecture decisions"
status: stable
source_repo: https://github.com/jackzhaojin/ciam-demo-private.git
source_tool: claude-code
harvested: 2026-03-28
---

# CIAM Claims PoC — Kickoff Guide

## The "Start Here" Document for AI Agents and Humans

**What this is:** This is the entry point for building the CIAM Claims proof of concept. It tells you what to read, what to do first, what gaps exist in the companion specs, and how to get from zero to a working system.

**Who reads this:** You (the human operator) and whatever AI agent (Claude Code, Claude Chat, etc.) is helping you build. If you're an AI agent, read this entire document before writing a single line of code.

---

## 1. The Documentation Set

All project documentation lives in the `ai-docs/` directory of the monorepo. Here's the reading order:

| Order | File | What It Covers | Read When |
|-------|------|---------------|-----------|
| **1 (this)** | `kickoff-guide.md` | Project overview, prerequisites, gaps, build order | Always read first |
| 2 | `ciam-specification.md` | Keycloak on Phase Two: setup, identity brokering, B2B orgs, OIDC/OAuth contracts, token structure | Before any auth work |
| 3 | `spring-boot-claims-spec.md` | Spring Boot backend: domain model, API endpoints, JWT validation, Supabase integration | Before backend work |
| 4 | `nextjs-claims-app-spec.md` | Next.js app: Auth.js/Keycloak, pages, org context, UI components | Before frontend work |
| 5 | `monorepo-and-agent-teams-guide.md` | Monorepo layout, CLAUDE.md strategy, agent teams usage, security enforcement | Before structuring the repo or using agent teams |
| 6 | `deployment-guide.md` | Dockerfiles, GitHub Actions CI/CD, ghcr.io, Oracle VM deployment | When ready to deploy |

**AI agents:** You must read documents 1–5 before generating code. Document 6 is for deployment phase.

---

## 2. Project Overview (The 30-Second Version)

We're building an insurance claims application to prove out enterprise CIAM patterns:

- **Keycloak** (hosted on Phase Two) handles identity: login, social login (Google/Microsoft/Facebook), B2B organization membership, token issuance
- **Spring Boot** is the API backend: validates JWTs, enforces org-scoped authorization, manages claims data in Supabase Postgres
- **Next.js** is the web frontend: uses Auth.js for BFF-pattern auth, proxies API calls with tokens, renders org-aware UI

The security model is the point. Every API call is authenticated. Tokens carry org membership. The backend validates everything. The frontend never exposes raw tokens to the browser.

---

## 3. Architecture at a Glance

```
┌──────────────┐     OIDC/OAuth      ┌────────────────┐
│   Keycloak   │◄────────────────────►│   Next.js      │
│  (Phase Two) │     Auth Code +      │  (claims-web)  │
│              │     PKCE via BFF     │   Port 3000    │
│  - Users     │                      │                │
│  - Orgs      │                      │  Auth.js       │
│  - Social    │                      │  manages       │
│    IdPs      │                      │  session       │
│  - Tokens    │                      │  cookie        │
└──────────────┘                      └───────┬────────┘
                                              │
                                              │ Bearer token +
                                              │ X-Organization-Id
                                              │ (server-side only)
                                              ▼
                                      ┌────────────────┐     JDBC      ┌──────────────┐
                                      │  Spring Boot   │◄─────────────►│   Supabase   │
                                      │  (claims-api)  │               │  PostgreSQL  │
                                      │   Port 8080    │               │              │
                                      │                │               │  - Claims    │
                                      │  JWT Validate  │               │  - Events    │
                                      │  via JWKS      │               │              │
                                      └────────────────┘               └──────────────┘
```

---

## 4. Technology Stack — Pinned Decisions

| Component | Choice | Version Strategy |
|-----------|--------|-----------------|
| Java | OpenJDK | Latest LTS (currently 21). Use the **same JDK version** for local development and in the production Docker image. No dev containers — just install the JDK directly. |
| Spring Boot | 3.x | Latest stable at build time. AI agent must verify before generating `build.gradle.kts`. |
| Gradle | Kotlin DSL | Use Gradle wrapper (`gradlew`). No global Gradle install needed. |
| Node.js | LTS | Latest LTS at build time. Used for Next.js. |
| Next.js | App Router | Latest stable. No Pages Router. |
| Auth.js | v5 (next-auth) | If v5 is unstable at build time, fall back to v4. AI agent decides. |
| Package Manager | pnpm | For the Next.js project only. |
| Database | Supabase PostgreSQL | Standard Postgres over JDBC. No Supabase SDK — it's just Postgres. |
| Migrations | Flyway | Runs on Spring Boot startup. |
| Container Registry | ghcr.io | GitHub Container Registry. Free with GitHub. |
| Production Host | Oracle VM | Docker already running. No reverse proxy yet — services exposed on their ports directly. |

**Important: No Dev Containers.** The original specs reference dev containers. We are **not** using them. Local development uses a directly-installed JDK and Node.js. The Docker images are for production/CI only. AI agents should ignore dev container references in the other specs (see Section 7 for the full list of fixes).

---

## 5. Human Prerequisites (Do These Before AI Touches Anything)

These steps require human action — accounts, credentials, clicking through UIs. Complete all of them and fill in the `.env` file before running any scripts or starting any AI agents.

### 5.1 Phase Two Account (Keycloak Hosting)

1. Go to [https://phasetwo.io](https://phasetwo.io)
2. Sign up for the free tier
3. Create a deployment — this provisions your Keycloak instance
4. Record these values for your `.env`:
   - `KEYCLOAK_BASE_URL` — the URL of your Keycloak instance (e.g., `https://xyz.phasetwo.io`)
   - `KEYCLOAK_REALM` — the realm name (Phase Two creates a default one)
   - `KEYCLOAK_ADMIN_USER` — admin username
   - `KEYCLOAK_ADMIN_PASSWORD` — admin password

> **Tip:** Phase Two's free tier gives you 1 realm with the Organizations extension. This is exactly what we need.

### 5.2 Social Provider OAuth Apps

Register an OAuth application with each provider. You need a Client ID and Client Secret from each. See `ciam-specification.md` §1.2 Step 2 for detailed instructions per provider.

| Provider | Developer Console | Redirect URI Pattern |
|----------|------------------|---------------------|
| Google | [console.cloud.google.com](https://console.cloud.google.com/) | `{KEYCLOAK_BASE_URL}/realms/{REALM}/broker/google/endpoint` |
| Microsoft | [portal.azure.com](https://portal.azure.com/) | `{KEYCLOAK_BASE_URL}/realms/{REALM}/broker/microsoft/endpoint` |
| Facebook | [developers.facebook.com](https://developers.facebook.com/) | `{KEYCLOAK_BASE_URL}/realms/{REALM}/broker/facebook/endpoint` |

Record in your `.env`:
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`
- `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`

> **Skip if needed:** Social providers are nice-to-have for the PoC. If you want to get moving fast, skip Facebook and Microsoft — just do Google. The CIAM scripts should handle missing providers gracefully (skip the IdP setup if the env var is empty).

### 5.3 Supabase Project (PostgreSQL Database)

1. Go to [https://supabase.com](https://supabase.com) and create an account (free tier is fine)
2. Create a new project — pick a region close to your Oracle VM
3. Set a strong database password when prompted — save it
4. Once the project is provisioned, go to **Project Settings → Database**
5. Find the **Connection string** section. You need the **JDBC** connection string:
   - It looks like: `jdbc:postgresql://db.xxxxxxxxxxxx.supabase.co:5432/postgres`
   - The port may be `5432` (direct) or `6543` (connection pooler / PgBouncer)
6. **Important — use port 5432 (direct connection), NOT 6543 (pooler).**
   Supabase's PgBouncer runs in transaction mode by default, which breaks Hibernate's prepared statement caching. Direct connection avoids this entirely. For a PoC with low concurrency, direct is fine.
7. Record in your `.env`:
   - `SUPABASE_JDBC_URL` — the JDBC connection string (port 5432)
   - `SUPABASE_DB_USER` — usually `postgres`
   - `SUPABASE_DB_PASSWORD` — the password you set in step 3

> **Alternative:** If you'd rather use a Postgres instance on your Oracle VM instead of Supabase, that works too. Just swap the JDBC URL. The Spring Boot app doesn't care where Postgres is — it's just JDBC.

### 5.4 GitHub Repository

1. Create a new GitHub repository for the monorepo (e.g., `ciam-claims-poc`)
2. The deployment pipeline uses GitHub Actions + ghcr.io, so the repo must be on GitHub
3. You'll need to add repository secrets later for deployment (see `deployment-guide.md`)

### 5.5 Oracle VM Access

Confirm your Oracle VM has:
- Docker installed and running
- Ports available for Spring Boot (8080) and Next.js (3000) — or whatever ports you choose
- SSH access for deployment (GitHub Actions will SSH in to pull and run containers)
- `docker login ghcr.io` already authenticated (or will be during deployment setup)

---

## 6. The Complete `.env.example`

This is the single source of truth for all environment variables across all three workstreams. Place this at the monorepo root as `.env.example`, and create a `.env` (gitignored) with your real values.

```bash
# ============================================================
# CIAM Claims PoC — Environment Variables
# ============================================================
# Copy this file to .env and fill in your values.
# .env is gitignored — never commit secrets.
# ============================================================

# --- Keycloak (Phase Two) ---
KEYCLOAK_BASE_URL=https://your-deployment.phasetwo.io
KEYCLOAK_REALM=your-realm-name
KEYCLOAK_ADMIN_USER=admin
KEYCLOAK_ADMIN_PASSWORD=your-admin-password

# --- Keycloak OIDC (derived — used by both apps) ---
# This is constructed from base URL + realm. Set it explicitly so apps don't need to construct it.
KEYCLOAK_ISSUER_URI=https://your-deployment.phasetwo.io/realms/your-realm-name

# --- Social Providers (for Keycloak brokering) ---
# Leave blank to skip a provider during CIAM setup
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=

# --- Keycloak Client: BFF (Next.js server-side auth) ---
# Created by CIAM setup scripts. Fill in after running them.
KEYCLOAK_BFF_CLIENT_ID=poc-bff
KEYCLOAK_BFF_CLIENT_SECRET=

# --- Keycloak Client: Backend Service (client credentials) ---
# Created by CIAM setup scripts. Fill in after running them.
KEYCLOAK_BACKEND_CLIENT_ID=poc-backend
KEYCLOAK_BACKEND_CLIENT_SECRET=

# --- Supabase PostgreSQL ---
SUPABASE_JDBC_URL=jdbc:postgresql://db.xxxxxxxxxxxx.supabase.co:5432/postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=

# --- Next.js ---
AUTH_SECRET=generate-a-random-32-char-string-here
BACKEND_URL=http://localhost:8080
NEXT_PUBLIC_APP_URL=http://localhost:3000

# --- Production Overrides (used in deployment) ---
# BACKEND_URL=http://your-oracle-vm-ip:8080
# NEXT_PUBLIC_APP_URL=http://your-oracle-vm-ip:3000
```

---

## 7. Known Gaps & Required Fixes to Existing Specs

The four companion specs were written before some decisions were finalized. Before an AI agent starts coding from those specs, it should apply these corrections. This section is the authoritative override.

### Fixes AI Must Apply to the Specs

**AI Agent Instruction:** When you start a workstream, read the relevant spec from `ai-docs/`, but apply these corrections. If you are asked to "fix the docs," update the files in `ai-docs/` with these changes.

#### Fix 1: Remove All Dev Container References
**Affects:** `spring-boot-claims-spec.md` §2, `nextjs-claims-app-spec.md` §1, `monorepo-and-agent-teams-guide.md` §1
**What to change:**
- Remove references to `.devcontainer/` directory and `devcontainer.json`
- Replace with: "Install OpenJDK 21 (or current LTS) and Node.js LTS directly on your development machine. Use the same OpenJDK version specified in the production Dockerfile (`eclipse-temurin:21-jre-alpine` base image) to ensure parity."
- Remove the shared dev container section from the monorepo structure
- Remove `.devcontainer/` from the directory tree diagrams

#### Fix 2: Remove `poc-frontend` Client
**Affects:** `ciam-specification.md` §1.3.5 (Client 1), `monorepo-and-agent-teams-guide.md` §2
**What to change:**
- Remove the `poc-frontend` public client registration entirely
- The architecture uses BFF only (`poc-bff` for auth flow, `poc-backend` for service-to-service)
- Update the Pattern Overview table in `ciam-specification.md` §3.1 to remove Pattern 1 (Auth Code + PKCE for SPA) or note it as "not used in this PoC — BFF pattern preferred"
- Update token mapper examples that reference `poc-frontend` to reference `poc-bff` instead
- Keep Pattern 1 documented as reference knowledge, but mark it clearly as not implemented

#### Fix 3: Add CORS Configuration to Spring Boot Spec
**Affects:** `spring-boot-claims-spec.md`
**What to add:** New section (§3.4 or similar):
```
### CORS Configuration
The Spring Boot service must allow cross-origin requests from the Next.js application.
In local dev: allow origin http://localhost:3000
In production: allow the deployed Next.js URL
Configure via environment variable: ALLOWED_ORIGINS=http://localhost:3000
Use Spring Security's CORS support — configure it in the SecurityFilterChain bean.
```

#### Fix 4: Clarify Phase Two Organizations Token Mapper
**Affects:** `ciam-specification.md` §2.4.6
**What to add:** A note that the exact `organizations` claim structure must be validated during CIAM setup. The CIAM setup verification script (`verify-setup.sh`) must:
1. Obtain a token for a test user who belongs to an organization
2. Decode the JWT
3. Print the exact organizations claim structure
4. This verified structure becomes the contract that Spring Boot and Next.js code against

The conceptual token in §2.4.6 is a target — not a guarantee. The script output is the truth.

#### Fix 5: Add Supabase PgBouncer Warning to Spring Boot Spec
**Affects:** `spring-boot-claims-spec.md` §5
**What to add:** After the configuration block:
```
**Important:** Use Supabase's direct connection (port 5432), NOT the pooled
connection (port 6543). Supabase's PgBouncer runs in transaction mode, which
breaks Hibernate prepared statement caching. For a PoC with low traffic,
direct connection is correct.
```

#### Fix 6: Add `.env.example` as Canonical Source
**Affects:** All specs that reference environment variables
**What to change:** Each spec references its own env vars. Add a note in each: "See the root `.env.example` for the complete variable list. The kickoff guide (`kickoff-guide.md` §6) is the canonical source."

#### Fix 7: Update Monorepo Structure (No Dev Container, Add ai-docs)
**Affects:** `monorepo-and-agent-teams-guide.md` §1
**What to change:** The monorepo structure should be:
```
ciam-claims-poc/
├── ai-docs/                          # All specification & guide documents
│   ├── kickoff-guide.md              # ← this document (start here)
│   ├── ciam-specification.md
│   ├── spring-boot-claims-spec.md
│   ├── nextjs-claims-app-spec.md
│   ├── monorepo-and-agent-teams-guide.md
│   └── deployment-guide.md
├── CLAUDE.md                         # Root-level AI agent instructions
├── README.md
├── .gitignore
├── .env.example
├── .env                              # gitignored
├── ciam/                             # Keycloak setup scripts
├── claims-api/                       # Spring Boot backend
├── claims-web/                       # Next.js frontend
└── .github/
    └── workflows/                    # GitHub Actions CI/CD
        ├── claims-api.yml
        └── claims-web.yml
```
Remove `.devcontainer/` from the tree. Add `.github/workflows/` and `ai-docs/`.

---

## 8. Build Order (What Happens When)

The key insight: **human setup and AI coding happen in parallel.** The AI team doesn't need real credentials to scaffold projects, write CIAM scripts, build UI, or write tests with mocked auth. The human provides real credentials at a checkpoint, and the team wires everything up.

```
Phase 1: PARALLEL KICKOFF (Human + AI Team work simultaneously)
    │
    ├── HUMAN (you, in parallel):
    │     ├── Sign up for Phase Two, note base URL + realm + admin creds
    │     ├── Register Google OAuth app (Microsoft/Facebook optional)
    │     ├── Create Supabase project, note JDBC URL + password
    │     └── Fill in .env as you go — tell the lead when you have each piece
    │
    └── AI TEAM (while you do the above):
          ├── "ciam-scripter":
          │     ├── Write all ciam/scripts/*.sh from the CIAM spec
          │     ├── Write ciam/test/verify-setup.sh
          │     └── Scripts are code-complete but not runnable until .env is filled
          │
          ├── "backend-dev":
          │     ├── Scaffold Spring Boot project (build.gradle.kts, application.yml)
          │     ├── Create Flyway migrations, JPA entities, repositories
          │     ├── Build service layer (claim lifecycle, status transitions)
          │     ├── Build REST controllers and DTOs
          │     ├── Security config with mocked JWT structure (will adapt later)
          │     └── Write tests with SecurityMockMvcRequestPostProcessors.jwt()
          │
          └── "web-dev":
                ├── Scaffold Next.js project (create-next-app, Tailwind, shadcn/ui)
                ├── Set up Auth.js skeleton with Keycloak provider
                ├── Build all pages (dashboard, claims, admin, profile)
                ├── Build components (org switcher, claim forms, timeline)
                ├── API client abstraction with Bearer token + X-Organization-Id
                └── Write tests with mocked Auth.js session

Phase 2: HUMAN CHECKPOINT — Credentials Handoff
    ├── Human has .env filled in with real values
    ├── Run ciam/scripts/setup-all.sh against real Phase Two
    ├── Run ciam/test/verify-setup.sh
    ├── CRITICAL: Capture the ACTUAL token structure from verify output
    │   (the real organizations claim may differ from the spec's example)
    ├── Share token structure with backend-dev and web-dev
    └── Update .env with generated client secrets (poc-bff, poc-backend)

Phase 3: INTEGRATION WIRING (AI Team adapts to real token structure)
    ├── backend-dev: Adapt JwtAuthenticationConverter to actual org claim format
    ├── web-dev: Adapt Auth.js jwt/session callbacks to actual claim format
    ├── Both: Run tests against real Keycloak (not just mocks)
    └── Integration test: login → create claim → approve → verify in DB

Phase 4: DEPLOYMENT
    ├── Push to GitHub → Actions build Docker images → push to ghcr.io
    ├── SSH to Oracle VM → pull images → run containers
    └── Smoke test against production URLs
```

**Why this works:** ~80% of the code doesn't need real credentials. Spring Boot entities, migrations, service logic, controllers, Next.js pages, UI components, and even most tests can be written with mocked auth. The real credentials only matter for Phase 2 (running CIAM scripts) and Phase 3 (wiring real token validation).

---

## 9. How to Use This With Claude Code

### Option A: Agent Teams (Recommended — Parallel with Human)

This is the recommended approach. The AI team builds code while you set up accounts and credentials. You interact with the team lead throughout — feeding it credentials as you get them.

```bash
cd ciam-claims-poc
claude
```

Then paste the prompt from `claude-code-kickoff-prompt.md`. The team lead will:
1. Read all docs in `ai-docs/`
2. Spawn 3 teammates: `ciam-scripter`, `backend-dev`, `web-dev`
3. All 3 start building immediately (no credentials needed yet)
4. You set up Phase Two, Supabase, Google OAuth in parallel
5. When you're ready, tell the lead: *"I have my .env filled in, run the CIAM scripts"*
6. The lead coordinates Phase 2 (credentials handoff) and Phase 3 (integration wiring)

**Interacting during the build:**
- Feed credentials as you go: *"Phase Two is set up, base URL is https://xyz.phasetwo.io"*
- Ask for status: *"How are the teammates doing?"*
- Redirect work: *"Tell backend-dev to skip file attachments for now"*
- Use `Shift+Up/Down` to message teammates directly

### Option B: Sequential (One Thing at a Time)
```bash
# Terminal 1 — build CIAM scripts (can run before credentials are ready)
cd ciam-claims-poc/ciam && claude
> Read ai-docs/ciam-specification.md and build the setup scripts

# Terminal 2 (parallel with Terminal 1)
cd ciam-claims-poc/claims-api && claude
> Read ai-docs/spring-boot-claims-spec.md and ai-docs/ciam-specification.md, build the service

# Terminal 3 (parallel with Terminal 2)
cd ciam-claims-poc/claims-web && claude
> Read ai-docs/nextjs-claims-app-spec.md and ai-docs/ciam-specification.md, build the app
```

---

## 10. Success Criteria

The PoC is done when:

1. **CIAM:** `verify-setup.sh` passes — Keycloak is configured, test users get tokens with org claims
2. **Backend:** `./gradlew test` passes — all endpoints work, JWT validation enforced, org roles checked
3. **Frontend:** `pnpm test` passes, `pnpm build` succeeds — auth flow works, claims CRUD works, org switching works
4. **Integration:** A human can log in via Keycloak, create a claim, switch orgs, and approve a claim in the admin queue
5. **Deployment:** Both services run as Docker containers on the Oracle VM, accessible via their ports
6. **Security:** No raw tokens in the browser (verified via DevTools Network tab), 401 for missing tokens, 403 for wrong org

---

*This kickoff guide is the entry point. Read it first, then the specs, then build. The deployment guide covers getting it to production.*
