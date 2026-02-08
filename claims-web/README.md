# Claims Web

Next.js frontend for the claims system, implementing the BFF (Backend-for-Frontend) pattern. Auth.js handles OIDC with Keycloak; tokens are stored in encrypted HTTP-only cookies and never reach the browser.

## Running

```bash
# Prerequisites: Node 22 LTS, pnpm, .env configured at repo root

pnpm install          # Install dependencies
pnpm dev              # Dev server on http://localhost:3000
pnpm build            # Production build (standalone output)
pnpm test             # Unit tests via Vitest
pnpm lint             # ESLint
```

Requires the Spring Boot API running on port 8080 and Keycloak configured via `ciam/` scripts.

## Pages

| Route | Description | Access |
|-------|-------------|--------|
| `/` | Landing page with sign-in | Public |
| `/dashboard` | Claims list (paginated) | Authenticated |
| `/claims/new` | File a new claim | admin, billing |
| `/claims/[id]` | Claim detail + timeline + actions | Authenticated |
| `/admin/review` | Review queue for pending claims | admin, billing |
| `/profile` | User profile, org membership | Authenticated |
| `/dev/token` | Debug: shows current JWT structure | Authenticated |

## Auth Flow

1. User clicks "Sign In" → Auth.js redirects to Keycloak
2. Keycloak authenticates → redirects back with auth code
3. Auth.js exchanges code for tokens (server-side only)
4. Custom `jwt` callback extracts `organizations` and `loyalty_tier` from token
5. Tokens stored in encrypted HTTP-only session cookie
6. Custom `session` callback exposes org data to client components (not raw tokens)
7. Auto token refresh when access token expires

**Key file:** `auth.ts` (project root, not in `src/`)

## API Client

`src/lib/api.ts` provides a server-only `apiClient<T>()` function that:
- Reads the session for the Bearer token
- Reads the `selectedOrgId` cookie for the `X-Organization-Id` header
- Handles errors: 401 → redirect to login, 403 → throw

All API calls to Spring Boot go through this client. It runs server-side only.

## Org Context

`src/lib/org-context.tsx` provides React context for the selected organization. The selection is persisted in a cookie (`selectedOrgId`) so it survives page reloads and is available to server-side API calls.

The `OrgSwitcher` component in the header lets users switch between their organizations.

## Permissions

`src/lib/permissions.ts` provides role-checking helpers:
- `hasRole(session, orgId, role)` — check specific role
- `isAdmin(session, orgId)` — admin role check
- `canCreateClaim(session, orgId)` — admin or billing
- `canApproveClaim(session, orgId)` — admin or billing

These are used in both server components (for conditional rendering) and client components (for UI visibility).

## Route Protection

`middleware.ts` protects authenticated routes. Unauthenticated users are redirected to `/`. Public routes: `/`, `/api/auth/*`, static assets.

## Docker

```dockerfile
# Multi-stage: deps → build → run
# Base: node:22-alpine with pnpm
# Output: standalone server (server.js)
# Port: 3000 (mapped to 3001 in production)
```

**AUTH_URL** (runtime env var) tells Auth.js its public-facing URL. No URLs are baked into the image — set it in `.env` on the deployment host.

## Project Structure

```
auth.ts                          # Auth.js config (root, not src/)
middleware.ts                    # Route protection
src/
├── app/
│   ├── layout.tsx               # Root layout with providers
│   ├── page.tsx                 # Landing page
│   ├── providers.tsx            # Session + org context providers
│   ├── dashboard/page.tsx       # Claims list
│   ├── claims/
│   │   ├── new/page.tsx         # File a claim (Zod + React Hook Form)
│   │   └── [id]/               # Claim detail + actions
│   ├── admin/review/            # Admin review queue
│   ├── profile/page.tsx         # User profile
│   ├── dev/token/page.tsx       # Token debug page
│   └── api/
│       ├── auth/[...nextauth]/  # Auth.js route handler
│       └── claims/[id]/[action] # BFF proxy to Spring Boot
├── lib/
│   ├── api.ts                   # Server-only API client
│   ├── org-context.tsx          # Org selection context + cookie
│   ├── permissions.ts           # Role-checking helpers
│   └── utils.ts                 # Tailwind cn() helper
├── components/
│   ├── layout/                  # Header, Sidebar, OrgSwitcher, AppShell
│   ├── claims/                  # ClaimCard, ClaimForm, ClaimTimeline, StatusBadge
│   └── ui/                      # shadcn/ui primitives
└── types/
    ├── auth.ts                  # Session/org type extensions
    └── claim.ts                 # Claim domain types
```
