# CIAM Claims PoC

A proof-of-concept demonstrating Customer Identity and Access Management (CIAM) patterns: multi-tenant org-scoped access control, BFF authentication, and claims lifecycle management.

## What It Does

Users authenticate via Keycloak (Phase Two), select an organization, and manage insurance claims. The system enforces that users can only access data within organizations they belong to, with role-based permissions (admin, billing, viewer) per org.

**Live deployment:** Oracle ARM64 VM with Docker Compose.

**Demo video (v1.2.1):** https://youtu.be/DIWQCDbMUM8

## Architecture

```
┌─────────────┐       OIDC        ┌──────────────────┐
│  Keycloak   │◄────────────────►│   Next.js (BFF)   │
│ (Phase Two) │                   │   Auth.js v5      │
└─────────────┘                   │   Port 3000       │
                                  └────────┬──────────┘
                                           │ Bearer + X-Organization-Id
                                           ▼
                                  ┌──────────────────┐
                                  │  Spring Boot API  │
                                  │  JWT validation   │
                                  │  Port 8080        │
                                  └────────┬──────────┘
                                           │
                                           ▼
                                  ┌──────────────────┐
                                  │    Supabase       │
                                  │   PostgreSQL      │
                                  └──────────────────┘
```

**BFF pattern:** Tokens never reach the browser. Auth.js stores them in encrypted HTTP-only session cookies. Server-side route handlers attach tokens when calling the Spring Boot API.

## Monorepo Structure

| Directory | What | Tech | README |
|-----------|------|------|--------|
| [`ciam/`](ciam/) | Keycloak setup scripts | Bash, curl, jq | [ciam/README.md](ciam/README.md) |
| [`claims-api/`](claims-api/) | Backend REST API | Java 21, Spring Boot 3.x, Gradle | [claims-api/README.md](claims-api/README.md) |
| [`claims-web/`](claims-web/) | Frontend application | Next.js 16, TypeScript, Auth.js | [claims-web/README.md](claims-web/README.md) |
| `ai-docs/` | Design specifications | Markdown | — |

## Quick Start

**Prerequisites:** JDK 21, Node 22 LTS, pnpm, curl, jq

```bash
# 1. Configure environment
cp .env.example .env
# Fill in Keycloak and Supabase credentials

# 2. Set up Keycloak (creates clients, orgs, test users)
bash ciam/scripts/setup-all.sh
bash ciam/test/verify-setup.sh    # Should pass 37/37 checks

# 3. Start the backend
cd claims-api && ./gradlew bootRun

# 4. Start the frontend (in another terminal)
cd claims-web && pnpm install && pnpm dev
```

Open http://localhost:3000 and sign in with a test user:

| User | Password | Orgs |
|------|----------|------|
| `admin@test.com` | `Test1234` | acme-corp (admin, billing), globex-inc (viewer) |
| `user@test.com` | `Test1234` | acme-corp (billing) |
| `multi@test.com` | `Test1234` | acme-corp (admin), globex-inc (admin) |

## Testing

```bash
cd claims-api && ./gradlew test              # 35 tests (unit + integration + security)
cd claims-web && pnpm test                   # Unit tests via Vitest (tests/unit/)
cd claims-web && pnpm exec playwright test   # E2E tests via Playwright (tests/e2e/)
bash ciam/test/verify-setup.sh               # Keycloak config validation
```

## Deployment

GitHub Actions builds ARM64 Docker images, pushes to GHCR, and deploys to an Oracle VM via SSH. See [`.github/workflows/`](.github/workflows/) for CI/CD pipelines.

Both services report their deployed version via health endpoints (`/api/health`). The version is set at Docker build time from the release tag.

Production environment variables live in `.env` on the VM only (not in GitHub Secrets beyond SSH credentials). See each sub-project's README for Docker details.

## Key Concepts

- **Org-scoped access:** Every API request includes an `X-Organization-Id` header, validated against the JWT's `organizations` claim
- **Phase Two tokens:** Custom JWT structure with `organizations`, `org_attributes`, and `loyalty_tier` claims (no standard `sub` — UUID derived from email)
- **Token mappers:** Configured via CIAM scripts; determine what claims appear in JWTs. Without them, the security model breaks
- **Claim lifecycle:** DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED/DENIED → CLOSED, with immutable event audit log
