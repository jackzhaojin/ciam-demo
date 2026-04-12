---
title: "Claims Application — Spring Boot Backend Specification"
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

# Claims Application — Spring Boot Backend Specification

## Companion to CIAM Specification — Backend Service

**Document Purpose:** This specification captures architecture decisions and requirements for the Spring Boot backend service that integrates with the Keycloak CIAM identity provider defined in `ciam-specification.md`. It is written to be consumed by Claude Code (or equivalent AI agent) for implementation.

**Audience:** AI agents executing the build. Human reviewers for decision validation.

**Scope:** Spring Boot backend only. Does not cover the Next.js frontend. References the CIAM spec for all identity/auth contracts.

**AI Agent Instructions:** This spec is intentionally concise. Where it says "research current best practices," the implementing agent should consult official documentation (Spring Boot, Spring Security, Gradle) for the latest stable versions and patterns before writing code. Do not assume versions — verify them.

---

## 1. Decisions Made

| Decision | Choice | Notes |
|----------|--------|-------|
| **Language** | Java (latest LTS — currently 21) | Classic, maximum AI training data coverage. Verify latest LTS at build time. |
| **Framework** | Spring Boot 3.x (latest stable) | Research the current stable release before generating `build.gradle.kts`. |
| **Build Tool** | Gradle (Kotlin DSL) | Less XML than Maven. Use the Gradle wrapper (`gradlew`). |
| **Dev Environment** | Local JDK 21 (eclipse-temurin) + Node 22 LTS | Installed directly on host. Hot reload via Spring DevTools. |
| **Database** | Supabase PostgreSQL (cloud-hosted) | Connection via standard JDBC / Spring Data JPA. Connection string provided as env var. No local database. |
| **Database Migrations** | Flyway | Schema managed as versioned migration files. Runs on app startup against Supabase. |
| **Deployment** | Docker (multi-stage production build) | Dockerfile for production CI/CD image only. |
| **Testing** | JUnit 5 + Spring Boot Test | AI must write and run tests to validate its own work. `./gradlew test` must pass before any task is considered done. |

---

## 2. Local Development Setup

Development runs directly on the host machine — no dev containers.

**Requirements:**
- JDK 21 (eclipse-temurin) installed locally
- Gradle wrapper included in the project (no Gradle install needed)
- Spring DevTools enabled for hot reload — file save triggers ~2s restart
- Environment variables for secrets loaded from a `.env` file (gitignored)

**AI agent:** Verify the current JDK 21 LTS availability from Adoptium (eclipse-temurin). Ensure the Gradle wrapper is configured for the latest stable Gradle version.

---

## 3. Identity Integration (References CIAM Spec)

This service plays two roles defined in the CIAM specification:

### 3.1 Resource Server (JWT Validation)

The backend receives JWTs issued by Keycloak and validates them. This maps to **Pattern 4 (Token Introspection — Approach A)** in the CIAM spec.

- Use Spring Security OAuth2 Resource Server with JWT support
- Configure the issuer URI from the OIDC discovery endpoint: `{KC_BASE_URL}/realms/{REALM}`
- Spring Security auto-fetches and caches the JWKS — no manual key management
- Extract custom claims from the token: `sub`, `email`, `loyalty_tier`, `organizations`

**Configuration (in `application.yml`, values from env vars):**
```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: ${KEYCLOAK_ISSUER_URI}
```

**AI agent:** Research current Spring Security OAuth2 Resource Server configuration for Spring Boot 3.x. The exact property names may have changed — verify against official docs.

### 3.2 Service Client (Client Credentials)

For service-to-service calls (e.g., calling the Keycloak Admin API), the backend uses the `poc-backend` client with the **Client Credentials** grant (Pattern 3 in the CIAM spec).

- Client ID: `poc-backend`
- Client secret: provided as env var
- This is for machine-to-machine calls only — no user context

**AI agent:** Research Spring Security's `OAuth2AuthorizedClientManager` or `WebClient` with client credentials for outbound calls. Implement as a reusable service bean.

### 3.3 Authorization Model

Authorization is derived from the JWT claims — no separate authorization service.

| Check | Source | Logic |
|-------|--------|-------|
| Is the user authenticated? | Valid JWT signature + not expired | Spring Security handles this automatically |
| Which org are they acting as? | `organizations` claim in token, or `X-Organization-Id` header | User may belong to multiple orgs — app needs to know which context they're in |
| What can they do in that org? | `organizations.{org}.roles` in token | `admin` + `billing` → full CRUD + approve/deny. `viewer` → read only. |

**Organization context pattern:** Since a user can belong to multiple organizations (see CIAM spec Section 2.4), the frontend must pass an `X-Organization-Id` header (or similar) to indicate which org context the request is for. The backend validates that the user is actually a member of that org by checking the token's `organizations` claim.

### 3.4 CORS Configuration

The Spring Boot service must allow cross-origin requests from the Next.js application.

- **Local dev:** allow origin `http://localhost:3000`
- **Production:** allow the deployed Next.js URL
- Configure via environment variable: `ALLOWED_ORIGINS=http://localhost:3000`
- Use Spring Security's CORS support — configure it in the `SecurityFilterChain` bean
- Do NOT use `@CrossOrigin` on individual controllers — centralize CORS in the security config

**AI agent:** Research Spring Security CORS configuration for Spring Boot 3.x. The CORS filter must run before the security filter chain. Use `CorsConfigurationSource` bean with `allowedOrigins` from the env var.

---

## 4. Domain Model — Insurance Claims

This is an insurance-style claims application. Keep it realistic enough to exercise the CIAM patterns but don't over-engineer.

### 4.1 Entities

**Claim**
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Primary key |
| `claimNumber` | String | Generated, format: `CLM-YYYY-NNNNN` |
| `userId` | UUID | From Keycloak `sub` claim — the claimant |
| `organizationId` | UUID | From org context — the account this claim belongs to |
| `status` | Enum | `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `DENIED`, `CLOSED` |
| `type` | Enum | `AUTO`, `PROPERTY`, `LIABILITY`, `HEALTH` |
| `description` | Text | Free-text description of the claim |
| `incidentDate` | LocalDate | When the incident occurred |
| `filedDate` | LocalDateTime | When the claim was filed (auto-set) |
| `amount` | BigDecimal | Claimed amount |
| `createdAt` | LocalDateTime | Record creation timestamp |
| `updatedAt` | LocalDateTime | Record update timestamp |

**ClaimEvent** (audit log)
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Primary key |
| `claimId` | UUID | FK to Claim |
| `actorUserId` | UUID | Who made the change (from token `sub`) |
| `eventType` | Enum | `CREATED`, `SUBMITTED`, `REVIEWED`, `APPROVED`, `DENIED`, `CLOSED`, `UPDATED` |
| `note` | Text | Optional comment |
| `timestamp` | LocalDateTime | When it happened |

### 4.2 API Endpoints

All endpoints require a valid Keycloak JWT. All claim operations are scoped to the org in context.

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/api/claims` | any org member | List claims for the current org (paginated) |
| `GET` | `/api/claims/{id}` | any org member | Get a single claim |
| `POST` | `/api/claims` | any org member | Create a new claim (status = DRAFT) |
| `PUT` | `/api/claims/{id}` | owner or admin | Update a claim (only if DRAFT) |
| `POST` | `/api/claims/{id}/submit` | owner or admin | Submit a draft claim (DRAFT → SUBMITTED) |
| `POST` | `/api/claims/{id}/review` | admin | Move to review (SUBMITTED → UNDER_REVIEW) |
| `POST` | `/api/claims/{id}/approve` | admin, billing | Approve (UNDER_REVIEW → APPROVED) |
| `POST` | `/api/claims/{id}/deny` | admin | Deny (UNDER_REVIEW → DENIED) |
| `GET` | `/api/claims/{id}/events` | any org member | Get audit log for a claim |
| `GET` | `/api/health` | none (public) | Health check |

**Status transitions:**
```
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED
                                  → DENIED
                   APPROVED/DENIED → CLOSED
```

### 4.3 Database Schema

**AI agent:** Generate Flyway migration files (`V1__create_claims_table.sql`, etc.) based on the entity definitions above. Use PostgreSQL-compatible DDL. Supabase runs standard Postgres.

---

## 5. Supabase Integration

- Connect via standard JDBC — Supabase provides a Postgres connection string
- Use Spring Data JPA with Hibernate as the ORM
- Flyway manages schema migrations
- No Supabase client SDK needed — it's just Postgres

**Configuration (in `application.yml`, values from env vars):**
```yaml
spring:
  datasource:
    url: ${SUPABASE_JDBC_URL}
    username: ${SUPABASE_DB_USER}
    password: ${SUPABASE_DB_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: validate  # Flyway manages schema — Hibernate only validates
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
```

**Important:** Use Supabase's direct connection (port 5432), NOT the pooled connection (port 6543). Supabase's PgBouncer runs in transaction mode, which breaks Hibernate prepared statement caching. For a PoC with low traffic, direct connection is correct.

**AI agent:** The Supabase connection string will be provided at runtime. Do not hardcode any database credentials. The `.env.example` file should document the required variables.

---

## 6. Environment Variables

The application must be fully configurable via environment variables. No secrets in code or config files.

| Variable | Purpose | Example |
|----------|---------|---------|
| `KEYCLOAK_ISSUER_URI` | OIDC issuer for JWT validation | `https://xyz.phasetwo.io/realms/my-realm` |
| `KEYCLOAK_CLIENT_ID` | Client ID for client credentials calls | `poc-backend` |
| `KEYCLOAK_CLIENT_SECRET` | Client secret for client credentials calls | `(secret)` |
| `SUPABASE_JDBC_URL` | JDBC connection to Supabase Postgres | `jdbc:postgresql://db.xyz.supabase.co:5432/postgres` |
| `SUPABASE_DB_USER` | Database username | `postgres` |
| `SUPABASE_DB_PASSWORD` | Database password | `(secret)` |
| `ALLOWED_ORIGINS` | CORS allowed origins for Next.js | `http://localhost:3000` |

Provide a `.env.example` with placeholder values. The `.env` file itself must be in `.gitignore`.

> **Canonical source:** See `kickoff-guide.md` §6 for the complete list of all environment variables across all workstreams. The root `.env.example` is the single source of truth.

---

## 7. Testing Strategy

**AI agents must validate their work.** Every feature should have tests. `./gradlew test` is the single command to verify everything.

| Layer | Tool | What It Tests |
|-------|------|--------------|
| Unit | JUnit 5 + Mockito | Service logic, status transitions, authorization checks |
| Integration | Spring Boot Test + `@SpringBootTest` | Full endpoint tests with mocked security context |
| Security | Spring Security Test (`@WithMockUser` or custom JWT) | Role-based access, org context validation |

**AI agent:** Research `SecurityMockMvcRequestPostProcessors.jwt()` for mocking Keycloak JWTs in Spring Security tests. This avoids needing a running Keycloak instance for tests.

---

## 8. Project Structure

Follow standard Spring Boot conventions:

```
claims-api/
├── .env.example
├── .gitignore
├── Dockerfile                    # Production multi-stage build
├── build.gradle.kts
├── settings.gradle.kts
├── gradlew / gradlew.bat
├── src/
│   ├── main/
│   │   ├── java/com/poc/claims/
│   │   │   ├── ClaimsApplication.java
│   │   │   ├── config/          # Security, JPA, WebClient configs
│   │   │   ├── model/           # JPA entities
│   │   │   ├── repository/      # Spring Data repos
│   │   │   ├── service/         # Business logic
│   │   │   ├── controller/      # REST controllers
│   │   │   └── dto/             # Request/response DTOs
│   │   └── resources/
│   │       ├── application.yml
│   │       ├── application-dev.yml
│   │       └── db/migration/    # Flyway SQL files
│   └── test/
│       └── java/com/poc/claims/
│           ├── controller/      # Endpoint tests
│           ├── service/         # Unit tests
│           └── security/        # Auth/role tests
└── README.md
```

---

## 9. Open Questions (For Human to Decide Later)

- **File/document attachments on claims:** Use Supabase Storage? Or defer to a later phase?
- **Notifications:** Email on status change? Out of scope for PoC?
- **Pagination style:** Offset-based or cursor-based?
- **API versioning:** `/api/v1/claims` or just `/api/claims` for the PoC?

---

*This specification is a companion to `ciam-specification.md`. The CIAM spec defines the identity contracts; this spec defines the backend service that consumes them.*
