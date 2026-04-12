---
title: "Claims Application — Next.js Web Application Specification"
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

# Claims Application — Next.js Web Application Specification

## Companion to CIAM Specification & Spring Boot Backend Specification

**Document Purpose:** This specification captures architecture decisions and requirements for the Next.js web application that integrates with the Keycloak CIAM identity provider (defined in `ciam-specification.md`) and the Spring Boot claims API (defined in `spring-boot-claims-spec.md`). It is written to be consumed by Claude Code (or equivalent AI agent) for implementation.

**Audience:** AI agents executing the build. Human reviewers for decision validation.

**Scope:** Next.js web application only. References the CIAM spec for all identity/auth contracts and the Spring Boot spec for API contracts.

**AI Agent Instructions:** This spec is intentionally concise. Where it says "research current best practices," the implementing agent should consult official documentation (Next.js, next-auth/Auth.js, Tailwind, shadcn/ui) for the latest stable versions and patterns before writing code. Do not assume versions — verify them.

---

## 1. Decisions Made

| Decision | Choice | Notes |
|----------|--------|-------|
| **Framework** | Next.js (latest stable, App Router) | Research the current stable release before generating `package.json`. Use the App Router — no Pages Router. |
| **Language** | TypeScript | Strict mode enabled. |
| **Auth Library** | Auth.js (next-auth v5) | Handles OIDC integration with Keycloak. Research the latest stable Auth.js release — the v4 → v5 migration changed the API surface significantly. |
| **Styling** | Tailwind CSS + shadcn/ui | shadcn/ui provides accessible, composable components. Not a dependency — components are copied into the project. |
| **State Management** | React Server Components + minimal client state | Prefer server components. Client state only where interactivity requires it (forms, modals, org switcher). No Redux/Zustand unless complexity demands it. |
| **HTTP Client** | `fetch` (native) | Server components use server-side fetch directly. Client components use route handlers as a proxy when needed. |
| **Package Manager** | pnpm | Faster, stricter than npm. Use `pnpm` in all scripts. |
| **Testing** | Vitest + React Testing Library + Playwright | Unit/component tests with Vitest. E2E tests with Playwright for auth flows. |
| **Dev Environment** | Local Node.js 22 LTS | Installed directly on host. No dev containers. |

---

## 2. Identity Integration (References CIAM Spec)

### 2.1 Auth Pattern: BFF via Auth.js

This application uses the **Backend-for-Frontend (BFF) pattern** — a hybrid of Pattern 1 (Authorization Code + PKCE) and Pattern 2 (Confidential Client) from the CIAM spec, implemented via Auth.js (next-auth v5) running on the Next.js server.

Auth.js handles:
- Redirecting to Keycloak's authorization endpoint
- PKCE code challenge/verifier generation
- Token exchange (code → tokens)
- Token refresh (Pattern 5 from CIAM spec)
- Session management (encrypted HTTP-only cookie — tokens never reach the browser)

**Why BFF over pure SPA:** The browser never sees the raw access token. Auth.js stores tokens in an encrypted server-side session cookie. API calls to Spring Boot are proxied through Next.js server-side code that attaches the token. This is the pattern Ping recommends for production CIAM deployments (see CIAM spec Section 3.3).

**AI agent:** Research the current Auth.js Keycloak provider configuration. The provider is built-in — do not write a custom OIDC provider unless the built-in one is insufficient.

### 2.2 Auth.js Configuration

```typescript
// Conceptual — verify against current Auth.js docs
// auth.ts (or equivalent)
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Keycloak({
      clientId: process.env.KEYCLOAK_CLIENT_ID,       // "poc-bff"
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
      issuer: process.env.KEYCLOAK_ISSUER_URI,
    }),
  ],
  callbacks: {
    // Extract custom claims (loyalty_tier, organizations) from the Keycloak token
    // and surface them in the Auth.js session
  },
})
```

**Critical: Token Claims Passthrough**

The Keycloak token contains custom claims that the application needs:
- `loyalty_tier` — display in profile
- `organizations` — populate org switcher, determine permissions
- `sub` — user ID for API calls

Auth.js must be configured to pass these claims from the Keycloak ID token into the Auth.js session object. This requires custom `jwt` and `session` callbacks. The AI agent should research the current Auth.js pattern for forwarding custom OIDC claims.

### 2.3 Security: Token Handling & Validation

**Server-side token flow (BFF):**
1. User authenticates → Auth.js receives tokens from Keycloak
2. Auth.js stores the access token, refresh token, and ID token in an **encrypted HTTP-only cookie**
3. Browser only sees an opaque session cookie — never the raw JWT
4. Server Components and Route Handlers read the session to get the access token
5. API calls to Spring Boot attach the access token as `Authorization: Bearer {token}`
6. Spring Boot validates the token against Keycloak's JWKS (see Spring Boot spec Section 3.1)

**Token refresh:** Auth.js should be configured to automatically refresh the access token using the refresh token when the access token expires (5-minute lifespan per CIAM spec). The AI agent should implement token refresh in the Auth.js `jwt` callback:

```typescript
// Conceptual — verify against current Auth.js docs
callbacks: {
  async jwt({ token, account }) {
    // On initial sign-in, store tokens
    if (account) {
      token.accessToken = account.access_token
      token.refreshToken = account.refresh_token
      token.expiresAt = account.expires_at
    }
    
    // If token hasn't expired, return as-is
    if (Date.now() < (token.expiresAt as number) * 1000) {
      return token
    }
    
    // Token expired — refresh it
    // POST to Keycloak token endpoint with grant_type=refresh_token
    // Update token.accessToken, token.refreshToken, token.expiresAt
    // If refresh fails, set token.error = "RefreshAccessTokenError"
    return token
  }
}
```

**Session expiration handling:**
- If token refresh fails (refresh token expired or revoked), Auth.js should flag the session
- The middleware should catch this and redirect to the login page
- Display a "Session expired — please sign in again" message

**CSRF protection:** Auth.js provides built-in CSRF protection for its routes. No additional CSRF configuration needed for Auth.js endpoints.

**Middleware (route protection):**
```typescript
// middleware.ts
// Protect all routes except landing page and auth API routes
// Redirect unauthenticated users to sign-in
// Redirect users with expired/invalid sessions to sign-in
```

### 2.4 Organization Context

Users can belong to multiple organizations. The application must:

1. On login, read the `organizations` claim from the session
2. Default to the first org (or last-used org stored in a cookie)
3. Provide an org switcher in the nav bar
4. Send the selected org ID as `X-Organization-Id` header on every API call to Spring Boot
5. Re-fetch data when the org context changes
6. Validate that the org ID in the cookie is still present in the user's token claims (in case membership was revoked)

The org context determines what claims the user sees and what actions they can take.

---

## 3. Pages & Features

### 3.1 Feature Map

| # | Feature | Route | Auth Required | Priority |
|---|---------|-------|---------------|----------|
| 1 | Login / Landing | `/` | No | **MVP** |
| 2 | Auth Callback | `/api/auth/[...nextauth]` | N/A (Auth.js) | **MVP** |
| 3 | Claims Dashboard | `/dashboard` | Yes | **MVP** |
| 4 | File a Claim | `/claims/new` | Yes | **MVP** |
| 5 | Claim Detail + Timeline | `/claims/[id]` | Yes | **MVP** |
| 6 | Admin Review Queue | `/admin/review` | Yes (admin role) | **MVP** |
| 7 | Profile / Account | `/profile` | Yes | Nice-to-have |
| 8 | Token Debugger | `/dev/token` | Yes (dev only) | Nice-to-have |

### 3.2 Feature Details

**1. Login / Landing Page**
- If unauthenticated: show hero section with "Sign In" button
- Sign-in button triggers Auth.js `signIn("keycloak")` which redirects to Keycloak
- Keycloak's login page shows email/password + social buttons (Google, Microsoft, Facebook)
- On success: redirect to `/dashboard`

**2. Claims Dashboard (`/dashboard`)**
- Server component that fetches `GET /api/claims` from Spring Boot
- Table/card view of claims for the selected organization
- Columns: Claim Number, Type, Status, Amount, Filed Date
- Filter by status (tabs or dropdown)
- "File New Claim" button
- Paginated (match whatever pagination the backend implements)

**3. File a Claim (`/claims/new`)**
- Multi-step form (can be single-page with sections if simpler):
  - Step 1: Select claim type (AUTO, PROPERTY, LIABILITY, HEALTH)
  - Step 2: Incident details (date, description)
  - Step 3: Amount
  - Step 4: Review & submit
- On submit: `POST /api/claims` then redirect to claim detail
- Initial status is DRAFT — optionally prompt to submit immediately

**4. Claim Detail + Timeline (`/claims/[id]`)**
- Fetch `GET /api/claims/{id}` and `GET /api/claims/{id}/events`
- Show claim details at the top (status badge, type, amount, description)
- Show audit event log as a vertical timeline component
- Action buttons based on status + user role:
  - DRAFT: "Edit" (owner/admin), "Submit" (owner/admin)
  - SUBMITTED: "Begin Review" (admin)
  - UNDER_REVIEW: "Approve" (admin/billing), "Deny" (admin)
  - APPROVED/DENIED: "Close" (admin)
- Each action calls the corresponding Spring Boot endpoint

**5. Admin Review Queue (`/admin/review`)**
- Only visible to users with `admin` role in the current org
- Fetch claims with status `SUBMITTED` and `UNDER_REVIEW`
- Quick-action buttons for approve/deny directly from the list
- Sort by filed date (oldest first)

**6. Profile / Account (`/profile`)**
- Show user info from session (name, email, loyalty tier)
- Show organization memberships from token
- Link to Keycloak Account Console for password change, MFA, linked accounts
- URL: `{KEYCLOAK_BASE_URL}/realms/{REALM}/account`

**7. Token Debugger (`/dev/token`)**
- Only available in development or behind a feature flag
- Show the decoded JWT (access token and ID token)
- Show the Auth.js session object
- Show the current organization context
- Useful for demos and debugging CIAM integration

### 3.3 Role-Based UI

The application must conditionally render UI elements based on the user's roles in the current organization:

| Role | Capabilities |
|------|-------------|
| `viewer` | See dashboard, view claim details, view timeline. No create/edit/action. |
| `admin` | Everything. Create claims, submit, review, approve, deny, close. See admin queue. |
| `billing` | View dashboard, view details, approve claims. Cannot deny or create. |
| Any org member | Create and submit their own claims. |

**Implementation:** Create a `usePermissions()` hook (or server-side utility) that reads the organizations claim from the session and returns the roles for the current org context. Use this to conditionally render buttons and gate route access.

---

## 4. API Integration Layer

### 4.1 Server-Side API Calls (Preferred)

Since this is an App Router project, prefer **Server Components** that call the Spring Boot API directly from the server. The Auth.js session (including the access token) is available server-side.

```typescript
// Conceptual pattern — verify against current Auth.js + Next.js App Router docs
// app/dashboard/page.tsx (Server Component)
import { auth } from "@/auth"

export default async function DashboardPage() {
  const session = await auth()
  const orgId = /* from session or cookie */
  
  const claims = await fetch(`${process.env.BACKEND_URL}/api/claims`, {
    headers: {
      "Authorization": `Bearer ${session.accessToken}`,
      "X-Organization-Id": orgId,
    },
  })
  
  return <ClaimsDashboard data={await claims.json()} />
}
```

### 4.2 Client-Side API Calls (When Needed)

For interactive operations (form submissions, status changes), use Next.js **Server Actions** or **Route Handlers** that proxy to Spring Boot. The browser sends requests to Next.js, which attaches the auth token and forwards to Spring Boot.

**AI agent:** Research the current Next.js App Router patterns for Server Actions vs. Route Handlers. Prefer Server Actions for form submissions if they support the use case cleanly.

### 4.3 API Client Abstraction

Create a thin API client that:
- Reads the access token from the Auth.js session
- Attaches the `Authorization` header
- Attaches the `X-Organization-Id` header from the current org context
- Handles 401 responses (trigger re-auth — redirect to login)
- Handles 403 responses (show "not authorized" message — don't redirect)
- Handles standard error responses from Spring Boot

---

## 5. Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `KEYCLOAK_ISSUER_URI` | OIDC issuer URL | `https://xyz.phasetwo.io/realms/my-realm` |
| `KEYCLOAK_CLIENT_ID` | Auth.js client ID | `poc-bff` |
| `KEYCLOAK_CLIENT_SECRET` | Auth.js client secret (BFF pattern) | `(secret)` |
| `AUTH_SECRET` | Auth.js encryption secret for session cookies | `(generated random string)` |
| `BACKEND_URL` | Spring Boot API base URL (server-side only) | `http://localhost:8080` |
| `NEXT_PUBLIC_APP_URL` | Public app URL (for redirects) | `http://localhost:3000` |

Provide a `.env.example` with placeholder values. The `.env.local` file must be in `.gitignore`.

> **Canonical source:** See `kickoff-guide.md` §6 for the complete list of all environment variables across all workstreams. The root `.env.example` is the single source of truth.

---

## 6. UI/UX Guidelines

- **Component library:** Use shadcn/ui components exclusively. Do not install other UI libraries.
- **Layout:** Standard sidebar or top-nav layout. Org switcher in the header. User avatar/menu in top-right.
- **Responsive:** Must work on desktop. Tablet/mobile nice-to-have for PoC.
- **Loading states:** Use skeleton components (shadcn/ui has these) during data fetches.
- **Error states:** Show meaningful error messages. Distinguish between auth errors (redirect to login) and API errors (show error toast/alert).
- **Status badges:** Color-coded claim status badges (DRAFT=gray, SUBMITTED=blue, UNDER_REVIEW=yellow, APPROVED=green, DENIED=red, CLOSED=gray).
- **Dark mode:** Nice-to-have. Tailwind and shadcn/ui support it natively.

---

## 7. Testing Strategy

| Layer | Tool | What It Tests |
|-------|------|--------------|
| Unit | Vitest + React Testing Library | Component rendering, hook logic, permission checks |
| Integration | Vitest | API client, auth callbacks, org context logic, token refresh |
| E2E | Playwright | Full login flow, create claim, approve claim, org switching |

**AI agent:** For auth-related tests, mock the Auth.js session rather than requiring a running Keycloak. Research `vi.mock()` patterns for mocking Auth.js in Vitest.

For Playwright E2E tests, these will require running Keycloak and Spring Boot. They can be deferred to a later phase or run against a shared dev environment.

---

## 8. Project Structure

```
claims-web/
├── .env.example
├── .env.local                    # gitignored
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── tailwind.config.ts
├── tsconfig.json
├── components.json               # shadcn/ui config
├── auth.ts                       # Auth.js configuration
├── middleware.ts                  # Auth middleware (protect routes)
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout with providers
│   │   ├── page.tsx              # Landing / login page
│   │   ├── dashboard/
│   │   │   └── page.tsx          # Claims dashboard
│   │   ├── claims/
│   │   │   ├── new/
│   │   │   │   └── page.tsx      # File a claim form
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Claim detail + timeline
│   │   ├── admin/
│   │   │   └── review/
│   │   │       └── page.tsx      # Admin review queue
│   │   ├── profile/
│   │   │   └── page.tsx          # User profile
│   │   ├── dev/
│   │   │   └── token/
│   │   │       └── page.tsx      # Token debugger (dev only)
│   │   └── api/
│   │       └── auth/
│   │           └── [...nextauth]/
│   │               └── route.ts  # Auth.js route handler
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── layout/               # Header, sidebar, org-switcher
│   │   ├── claims/               # Claim-specific components
│   │   └── common/               # Shared components
│   ├── lib/
│   │   ├── api.ts                # API client abstraction
│   │   ├── permissions.ts        # Role/permission utilities
│   │   └── utils.ts              # General utilities
│   └── types/
│       ├── claim.ts              # Claim-related types
│       └── auth.ts               # Auth/session type extensions
├── tests/
│   ├── unit/                     # Vitest unit tests
│   └── e2e/                      # Playwright E2E tests
└── playwright.config.ts
```

---

## 9. Open Questions (For Human to Decide Later)

- **Real-time updates:** WebSocket or polling for claim status changes? Out of scope for PoC?
- **Internationalization:** English-only for PoC?
- **Offline support:** Not needed for PoC.
- **Analytics:** Track user actions? Out of scope for PoC?
- **Auth.js v4 vs v5:** If v5 is still unstable, fall back to v4. AI agent should check stability at build time. **Important:** The `jwt` and `session` callback APIs changed significantly between v4 and v5. The conceptual code samples in this spec (§2.2, §2.3) may not match the actual v5 API. The implementing agent MUST verify callback signatures against the current Auth.js documentation before writing code.

---

*This specification is a companion to `ciam-specification.md` and `spring-boot-claims-spec.md`. The CIAM spec defines the identity contracts, the Spring Boot spec defines the API contracts, and this spec defines the web application that consumes both.*
