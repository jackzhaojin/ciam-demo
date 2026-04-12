---
title: Test Credentials
project: ciam-demo-private
sub_project: ciam-demo-private
type: working-doc
date: 2026-03-28
tags: [credentials, testing]
why_private: "contains test user passwords and environment URLs"
status: active
source_repo: https://github.com/jackzhaojin/ciam-demo-private.git
source_tool: claude-code
harvested: 2026-03-28
---

# Test Credentials

All passwords: `Test1234`

## Organizations

| Org Name    | Display Name     | Contract Tier | Industry      | Account # |
|-------------|------------------|---------------|---------------|-----------|
| acme-corp   | Acme Corporation | enterprise    | manufacturing | ACC-001   |
| globex-inc  | Globex Inc.      | standard      | technology    | ACC-003   |

## Roles (per org)

`admin` > `billing` > `viewer`

## Test Users

| Email            | Password | Loyalty Tier | acme-corp Roles   | globex-inc Roles |
|------------------|----------|-------------|-------------------|------------------|
| admin@test.com   | Test1234 | gold        | admin, billing    | viewer           |
| user@test.com    | Test1234 | bronze      | viewer            | (none)           |
| multi@test.com   | Test1234 | silver      | admin             | admin            |

## Recommended Test Flows

- **Full admin flow**: Login as `admin@test.com`, select Acme Corporation. Can file, submit, review, approve/deny claims.
- **Viewer-only flow**: Login as `user@test.com`, select Acme Corporation. Can view claims but cannot approve/deny.
- **Org switching**: Login as `multi@test.com`, switch between Acme and Globex to verify org-scoped data isolation.
- **Cross-org viewer**: Login as `admin@test.com`, switch to Globex Inc. Should have viewer-level access only.

## App URLs (local dev)

- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- Keycloak: https://usw2.auth.ac/auth/realms/claim-ciam-poc
