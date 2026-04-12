---
title: "CLAUDE.md — Claims API"
project: ciam-demo-private
sub_project: ciam-demo-private
type: working-doc
date: 2026-02-07
tags: []
why_private: "contains internal development guidance and architecture decisions"
status: active
source_repo: https://github.com/jackzhaojin/ciam-demo-private.git
source_tool: claude-code
duplicate: true
harvested: 2026-03-28
---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## What This Is

Spring Boot REST API for org-scoped insurance claims. Validates JWTs from Phase Two (hosted Keycloak), enforces org membership, and persists to Supabase PostgreSQL.

## Commands

```bash
./gradlew test                                    # All 35 tests (19 unit, 6 integration, 10 security)
./gradlew test --tests "*.ClaimControllerTest"    # Single test class
./gradlew test --tests "*.ClaimServiceTest.testCreateClaim"  # Single test method
./gradlew bootRun                                 # Dev server on port 8080
./gradlew build                                   # Full build with tests
```

## Architecture

**Request flow:** JWT validation → OrgContextFilter (validates X-Organization-Id against token) → Controller → Service → Repository

**Security chain** (in `SecurityConfig.java`):
1. Stateless sessions (no cookies server-side)
2. OAuth2 Resource Server with JWKS from Keycloak
3. Custom `JwtAuthConverter` extracts org-scoped authorities: `ORG_<uuid>_ROLE_<role>`
4. `OrgContextFilter` reads `X-Organization-Id` header, checks membership, stores `OrgContext` in request attributes

**Phase Two token quirk:** No standard `sub` claim. User UUID is derived from email hash in `JwtAuthConverter`.

**Domain model:**
- `Claim` → status lifecycle: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED/DENIED → CLOSED
- `ClaimEvent` → immutable audit log per claim
- `ClaimType` enum: AUTO, PROPERTY, HEALTH, MEDICAL

**Endpoints:** `POST/PUT/GET /api/claims`, `POST /api/claims/{id}/{action}` (submit/review/approve/deny/close), `GET /api/claims/{id}/events`. Health at `/api/health` (permitAll).

## Testing

Tests use H2 in PostgreSQL compatibility mode (`MODE=PostgreSQL`). `TestSecurityConfig` provides a mock `JwtDecoder` bean so tests don't need a real Keycloak instance. JWT claims are mocked via `SecurityMockMvcRequestPostProcessors.jwt()`.

**Test config overrides** (`application-test.yml`): `flyway.schemas: PUBLIC`, `hibernate.default_schema: PUBLIC`, `baseline-on-migrate: false`.

## Specs

Read before making changes:
- `ai-docs/spring-boot-claims-spec.md` — primary spec
- `ai-docs/ciam-specification.md` — token contracts
