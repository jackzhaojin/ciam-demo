# Claims API

Spring Boot REST API for org-scoped insurance claims management. Validates JWTs from Phase Two (hosted Keycloak), enforces organization membership on every request, and persists to Supabase PostgreSQL.

## Running

```bash
# Prerequisites: JDK 21, .env configured at repo root

./gradlew bootRun       # Start on port 8080
./gradlew test          # Run all 35 tests
./gradlew build         # Full build
```

The API requires a running Keycloak instance (configured via `ciam/` scripts) and Supabase PostgreSQL.

## API Endpoints

All endpoints (except `/api/health`) require a valid JWT Bearer token and `X-Organization-Id` header.

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| `GET` | `/api/health` | Health check | Public |
| `POST` | `/api/claims` | Create a claim | admin, billing |
| `GET` | `/api/claims` | List claims (paginated) | All |
| `GET` | `/api/claims/{id}` | Get claim detail | All |
| `PUT` | `/api/claims/{id}` | Update draft claim | Owner |
| `POST` | `/api/claims/{id}/submit` | Submit for review | Owner |
| `POST` | `/api/claims/{id}/review` | Start review | admin |
| `POST` | `/api/claims/{id}/approve` | Approve claim | admin, billing |
| `POST` | `/api/claims/{id}/deny` | Deny claim | admin, billing |
| `POST` | `/api/claims/{id}/close` | Close claim | admin |
| `GET` | `/api/claims/{id}/events` | Audit trail | All |

## Security Model

1. **JWT validation** — Spring Security OAuth2 Resource Server fetches JWKS from Keycloak automatically
2. **Org extraction** — `JwtAuthConverter` reads the `organizations` claim from Phase Two tokens and builds authorities in the format `ORG_<uuid>_ROLE_<role>`
3. **Org context filter** — `OrgContextFilter` reads `X-Organization-Id` header, verifies the user is a member of that org (403 if not), and stores the org context for downstream use
4. **No `sub` claim** — Phase Two tokens omit the standard `sub`. User UUID is derived from email hash

## Domain Model

**Claim lifecycle:**
```
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → CLOSED
                                  → DENIED  → CLOSED
```

**Entities:**
- `Claim` — UUID PK, auto-generated claim number, org/user IDs, type (AUTO/PROPERTY/HEALTH/MEDICAL), status, amount, timestamps
- `ClaimEvent` — immutable audit log: event type, actor, message, timestamp

## Testing

Tests use H2 in PostgreSQL compatibility mode so Flyway migrations work without a real database. `TestSecurityConfig` provides a mock `JwtDecoder` so no Keycloak connection is needed.

```bash
./gradlew test                                          # All tests
./gradlew test --tests "*.ClaimControllerTest"          # One test class
./gradlew test --tests "*.ClaimServiceTest.testCreate*" # Pattern match
```

**Test breakdown:** 19 unit + 6 integration + 10 security tests.

## Docker

```dockerfile
# Built by GitHub Actions, pushed to ghcr.io/jackzhaojin/ciam-claims-api
# Multi-stage: gradle build → eclipse-temurin:21-jre-alpine runtime
# ARM64 platform (Oracle VM)
```

Environment variables are injected at runtime via `.env` on the deployment host.

## Project Structure

```
src/main/java/com/poc/claims/
├── config/
│   ├── SecurityConfig.java      # Filter chain, CORS, JWT setup
│   ├── JwtAuthConverter.java    # Token → authorities extraction
│   └── OrgContextFilter.java    # X-Organization-Id validation
├── controller/
│   └── ClaimController.java     # REST endpoints
├── service/
│   └── ClaimService.java        # Business logic, status transitions
├── model/
│   ├── Claim.java               # JPA entity
│   ├── ClaimEvent.java          # Audit log entity
│   ├── ClaimStatus.java         # Status enum
│   └── ClaimType.java           # Type enum
├── repository/
│   ├── ClaimRepository.java
│   └── ClaimEventRepository.java
└── dto/                         # Request/response objects
```
