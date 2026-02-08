# CIAM Setup Scripts

Bash scripts that configure Phase Two (hosted Keycloak) via the Admin REST API. Creates the realm, clients, organizations, roles, token mappers, and test users needed for the claims PoC.

## Running

```bash
# Prerequisites: curl, jq, .env configured at repo root

bash scripts/setup-all.sh       # Run all scripts in order
bash test/verify-setup.sh       # Validate setup (37 checks)
```

All scripts are idempotent — safe to re-run without duplicating resources.

## Scripts

| # | Script | Purpose |
|---|--------|---------|
| 00 | `helpers.sh` | Shared functions (sourced by all scripts, not run directly) |
| 01 | `configure-realm.sh` | Realm settings: registration, brute force protection, token lifespan |
| 02 | `configure-user-profile.sh` | Custom user attributes (loyalty_tier, org_attributes) |
| 03 | `configure-social-idps.sh` | Google/Microsoft/Facebook (skips if env vars empty) |
| 04 | `register-clients.sh` | Creates `poc-bff` (auth code) + `poc-backend` (client credentials) |
| 05 | `configure-token-mappers.sh` | Maps `organizations` + `loyalty_tier` into access/id tokens |
| 06 | `create-organizations.sh` | acme-corp (ACC-001), globex-inc (ACC-003) with attributes |
| 07 | `create-org-roles.sh` | admin, billing, viewer roles per org |
| 08 | `create-test-users.sh` | Test users with org memberships and role assignments |
| 09 | `configure-production-uris.sh` | Adds production redirect URIs to poc-bff client |

## Test Users

| Email | Password | Organizations |
|-------|----------|---------------|
| `admin@test.com` | `Test1234` | acme-corp (admin, billing), globex-inc (viewer) |
| `user@test.com` | `Test1234` | acme-corp (billing) |
| `multi@test.com` | `Test1234` | acme-corp (admin), globex-inc (admin) |

## Token Mappers (Critical)

Script `05` configures what claims appear in JWTs. Without these, the Spring Boot backend and Next.js frontend cannot extract org membership or loyalty tier. Both claims must appear in access_token and id_token:

- `organizations` — Phase Two Organizations extension mapper
- `loyalty_tier` — user attribute mapper

## Helper Functions

`00-helpers.sh` provides:

- **Token management:** `get_admin_token()` caches tokens and auto-refreshes every 45s (tokens expire in 60s)
- **API wrappers:** `kc_get()`, `kc_post()`, `kc_put()` — handle auth automatically
- **Lookups:** `get_client_uuid()`, `get_user_id()`, `get_org_id()` — find resources by name
- **Idempotency:** `idp_exists()`, `mapper_exists()`, `is_org_member()`, `org_role_exists()` — check before creating

## Phase Two vs Standard Keycloak

Phase Two Organizations API uses different paths than standard Keycloak:
- Organizations: `GET/POST /realms/{realm}/orgs/` (not `/admin/realms/`)
- Org roles: `/realms/{realm}/orgs/{id}/roles`
- Org members: `/realms/{realm}/orgs/{id}/members`

Standard Keycloak admin paths (`/admin/realms/`) are used for clients, users, and mappers.

## Production URIs

Script `09` adds deployment redirect URIs to the `poc-bff` client so the app can authenticate from non-localhost environments. It reads `PRODUCTION_APP_URL` from `.env` (defaults to `http://157.151.152.16:3001`). Run it standalone or as part of `setup-all.sh`.
