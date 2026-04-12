---
title: "v1.0 Current State Evaluation"
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

# v1.0 Current State Evaluation

**Date:** 2026-02-07
**Scope:** Honest assessment of ciam-demo-private after v1.0.0 — what works, what's fragile, what's missing, prioritized by functional impact.

---

## What This Project Is

An insurance claims application proving out enterprise CIAM patterns: Keycloak (Phase Two hosted) for identity, Spring Boot for the API, Next.js for the frontend. The security model is the point — every request is authenticated, tokens carry org membership, the backend validates everything, tokens never reach the browser.

**Three workstreams:** `ciam/` (Keycloak setup scripts), `claims-api/` (Spring Boot), `claims-web/` (Next.js).

---

## Current State: What Works

The core thesis is proven and working end-to-end:

- **Full auth flow**: Browser → Keycloak OIDC → Auth.js encrypted cookie → server-side route handler → Spring Boot (Bearer token + X-Organization-Id)
- **Token security**: Tokens never reach the browser. BFF pattern correctly implemented.
- **Org-scoped access control**: Every API call validates org membership via JWT. Cross-org access returns 403.
- **Claims lifecycle**: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED/DENIED → CLOSED — all transitions enforced with role checks.
- **Audit trail**: Every state change produces an immutable ClaimEvent.
- **Multi-org switching**: Cookie-persisted org context, validated against token on every request.
- **Deployment**: GitHub Actions builds ARM64 Docker images, deploys to Oracle VM via SSH. Both services running in production.
- **Test suites**: 36 Spring Boot tests (unit + integration + security), 28 Next.js tests (unit). All passing.

### By the Numbers

| Metric | Value |
|--------|-------|
| Spring Boot Java files | 21 |
| Next.js TypeScript/TSX files | 44 |
| CIAM setup scripts | 10 + 1 verification harness |
| Spring Boot tests | 36 (19 unit, 6 integration, 10+ security) |
| Next.js tests | 28 (4 test files) |
| CIAM verification checks | 37 |
| API endpoints | 10 + health |
| Frontend pages/routes | 9 |
| Flyway migrations | 2 |
| Test users | 3 (admin, user, multi) |
| Organizations | 2 (acme-corp, globex-inc) |

---

## Gaps by Functional Priority

### TIER 1 — Security & Correctness Issues

These affect the integrity of the authorization model. Should be fixed before calling it production-grade.

#### 1. Backend: No role check on claim creation

**Impact: MEDIUM** | `ClaimService.java:31`

Any authenticated org member can create claims via `POST /api/claims` — including viewers. The frontend hides the button for viewers (`canCreateClaim()` in `permissions.ts`), but the API is wide open. A viewer with curl can create claims.

The spec (`nextjs-claims-app-spec.md` §3.3) says viewer = "No create/edit/action." The frontend enforces this; the backend doesn't.

Same issue for billing users — spec says billing cannot create claims, but the backend allows it.

#### 2. Frontend: Admin review page not role-gated

**Impact: MEDIUM** | `middleware.ts`

Any authenticated user can navigate directly to `/admin/review` by typing the URL. The sidebar hides the link for non-admins, but the route itself is accessible. The page renders and shows the review queue — users just can't take actions (backend enforces roles).

This is an information disclosure issue: non-admins can see all submitted/under-review claims.

#### 3. Frontend: Submit button visible to non-owners

**Impact: LOW** | `ClaimActions.tsx`

The Submit button appears for ALL users when a claim is in DRAFT status. No owner/admin check in the UI. Clicking it as a non-owner hits a 403 from the backend, but there's no error feedback — the button just does nothing.

#### 4. `closeClaim()` permission ambiguity

**Impact: LOW** | `ClaimService.java:151-163`

Any org member can close APPROVED/DENIED claims. The spec doesn't explicitly define who can close. This may be intentional (anyone can archive a resolved claim), but it's undocumented. If sensitive, add a role check.

#### 5. `sub` claim fallback

**Impact: LOW (if consistent)** | `JwtAuthConverter.java`

Phase Two tokens lack a standard `sub` claim. The backend derives user UUID from email via `UUID.nameUUIDFromBytes(email.getBytes())`. This is stable as long as Phase Two consistently omits `sub`. If it sometimes includes `sub` and sometimes doesn't, the same user could get two different UUIDs — breaking claim ownership.

Current tokens consistently omit `sub`, so this is stable today.

---

### TIER 2 — UX & Error Handling

These don't break functionality but make the application feel incomplete during demos.

#### 6. No error feedback on claim actions

**Impact: HIGH (for UX)** | `ClaimActions.tsx`, `AdminActions.tsx`

When a user clicks Approve, Deny, Submit, Review, or Close and the backend returns an error (403, 400, 500), nothing happens. No toast, no alert, no indication of failure. The page just sits there.

`sonner` (toast library) is installed but unused. This is the single highest-impact UX fix.

#### 7. No client-side form validation

**Impact: MEDIUM** | `ClaimForm.tsx`

The create-claim form has no input validation. Users can submit empty descriptions, negative amounts, or future incident dates. The backend catches some of this (400 with field errors), but the frontend doesn't display server validation errors inline.

`zod` and `react-hook-form` are both in `package.json` but unused. The infrastructure is there; it just needs to be wired up.

#### 8. Dashboard/detail pages fail silently

**Impact: MEDIUM** | `dashboard/page.tsx`, `claims/[id]/page.tsx`

If the backend is down or returns an error, these pages show generic fallback text ("Failed to load claims") with no retry mechanism and no distinction between network errors, 401s, and 403s.

#### 9. No Keycloak logout

**Impact: LOW** | `auth.ts`

Auth.js `signOut()` clears the local session but doesn't redirect to Keycloak's logout endpoint. Users can re-authenticate without entering credentials until the Keycloak session expires (30-minute idle, 10-hour max).

For a demo, this means "sign out → sign in as different user" requires waiting or manually clearing the Keycloak session.

---

### TIER 3 — Testing Gaps

These affect confidence in the system but don't block functionality.

#### 10. No E2E tests

**Impact: HIGH (for confidence)**

No Playwright tests exist. The spec calls for E2E coverage of: login → create claim → approve flow. All verification is manual or via unit tests with mocked auth.

This is the biggest gap for long-term maintenance. Any auth.ts or middleware.ts change could silently break the login flow with no automated detection.

#### 11. Frontend test coverage ~20%

**Impact: MEDIUM**

28 tests cover permissions utilities, org-context, and two components (StatusBadge, ClaimTimeline). Not tested: auth flow (token refresh, session callbacks), API client error handling, form submission, action handlers, page rendering.

#### 12. Spring Boot missing edge case tests

**Impact: LOW**

Missing: viewer creating claims (should be allowed per current impl), concurrent updates (optimistic locking), invalid state transitions (APPROVED → DRAFT), database constraint violations.

---

### TIER 4 — Polish & Nice-to-Have

These are spec items marked as optional or low-priority.

#### 13. Dark mode not wired

`next-themes` is installed. Dark mode CSS variables exist in `globals.css`. No toggle button in the UI. Could be wired up in 15 minutes.

#### 14. Token debugger doesn't decode JWT

`/dev/token` shows the Auth.js session object as JSON but doesn't base64-decode the raw JWT payload. Less useful for debugging token mapper issues.

#### 15. Mobile responsiveness not optimized

Desktop-first layout. Sidebar always visible on small screens. Spec says "tablet/mobile nice-to-have."

#### 16. `apiClient()` abstraction unused

`src/lib/api.ts` defines a clean `apiClient<T>()` function, but pages inline their own fetch calls instead. Inconsistent pattern — should consolidate.

---

## CIAM Scripts: Assessment

### Strengths
- All 10 scripts are properly idempotent (check-before-create pattern)
- Token refresh with 45-second auto-renewal
- Verification harness (37 checks) with actual JWT decoding
- Correct BFF-only client setup (poc-frontend intentionally removed)
- Organization setup with attributes (accountNumber, industry, contractTier)

### Concerns

**Phase Two dependency:** The entire setup assumes specific Phase Two extension mapper types (`oidc-organization-role-mapper`, `oidc-organization-attribute-mapper`). These are not standard Keycloak — they're Phase Two extensions. If Phase Two changes versions or deprecates these mapper types, the CIAM scripts will silently fail to produce correct token claims. The verification script prints the token but doesn't assert the structure.

**Direct access grants:** `poc-bff` has `directAccessGrantsEnabled: true` — needed for the verification script to authenticate test users, but it's a security anti-pattern in production (exposes passwords to the client).

**No rollback:** If setup partially fails, there's no cleanup script. Manual deletion in the Keycloak UI is required.

---

## Infrastructure: Assessment

### What's Solid
- Multi-stage Dockerfiles for both services (non-root user, optimized images)
- GitHub Actions CI/CD (ARM64 QEMU builds, GHCR push, SSH deploy)
- Environment-driven config (no baked-in secrets, `AUTH_URL` at runtime)
- Public/private mirror workflow with per-commit replay

### What's Missing
- No health check endpoints beyond `/api/health` (no Spring Actuator)
- No monitoring or logging infrastructure
- No reverse proxy (services exposed directly on ports)
- No SSL/TLS termination

---

## Spec vs. Reality Summary

| Area | Spec Compliance | Notes |
|------|----------------|-------|
| CIAM setup | 90% | Missing: org-specific IdP federation, email verification enabled |
| Spring Boot API | 95% | Missing: viewer/billing role restrictions on create |
| Next.js frontend | 90% | Missing: form validation, error toasts, E2E tests, admin page gating |
| Deployment | 100% | Both services deployed and running |
| Security model | 95% | BFF pattern correct, org isolation solid, minor role enforcement gaps |

---

## Recommended v1.1 Fix Order

Priority based on functional impact — what improves the system most per unit of effort.

| # | Fix | Effort | Impact | Category |
|---|-----|--------|--------|----------|
| 1 | Add error/success toasts to claim actions | 30 min | HIGH | UX |
| 2 | Restrict viewer/billing from creating claims (backend) | 15 min | MEDIUM | Security |
| 3 | Add role check to `/admin/review` page | 10 min | MEDIUM | Security |
| 4 | Fix Submit button visibility (owner/admin check) | 10 min | LOW | UX |
| 5 | Wire up form validation (zod + react-hook-form) | 1 hr | MEDIUM | UX |
| 6 | Wire Keycloak logout redirect | 15 min | LOW | Auth |
| 7 | Add 3-5 Playwright E2E tests | 2-3 hr | HIGH | Testing |
| 8 | Consolidate `apiClient()` usage across pages | 30 min | LOW | Code quality |
| 9 | Wire dark mode toggle | 15 min | LOW | Polish |
| 10 | Add token structure assertions to verify-setup.sh | 30 min | MEDIUM | CIAM |

Items 1-6 are quick wins (under 3 hours total). Item 7 (E2E tests) is the biggest investment but provides the most long-term value.

---

*This evaluation was generated from a full codebase audit — every Java file, every TypeScript file, every bash script, every test file was read and compared against the specification documents in `ai-docs/2026-02-07-initial/`.*
