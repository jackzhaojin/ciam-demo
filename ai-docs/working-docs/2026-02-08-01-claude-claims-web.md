---
title: "CLAUDE.md — Claims Web"
project: ciam-demo-private
sub_project: ciam-demo-private
type: working-doc
date: 2026-02-08
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

Next.js frontend implementing the BFF (Backend-for-Frontend) pattern. Auth.js handles OIDC with Keycloak; tokens are stored server-side in encrypted cookies and never reach the browser.

## Commands

```bash
pnpm dev                       # Dev server on port 3000
pnpm build                     # Production build (standalone output)
pnpm test                      # Unit tests via Vitest (tests/unit/)
pnpm exec playwright test      # E2E tests via Playwright (tests/e2e/)
pnpm lint                      # ESLint
```

## Architecture

**Auth flow** (`auth.ts`):
1. Auth.js Keycloak provider handles OIDC
2. Custom `jwt` callback stores access/refresh tokens + extracts `organizations` and `loyalty_tier` from profile
3. Auto token refresh when expired (calls Keycloak token endpoint)
4. Custom `session` callback surfaces org data to client (NOT raw tokens)

**API calls** (`src/lib/api.ts`):
- Server-only `apiClient<T>()` function
- Reads session for Bearer token, reads `selectedOrgId` cookie for `X-Organization-Id` header
- 401 → redirect to login, 403 → throw (don't redirect)

**Route protection** (`middleware.ts`): protects `/dashboard/*`, `/claims/*`, `/admin/*`, `/profile/*`, `/dev/*`.

**Org context** (`src/lib/org-context.tsx`): React context + cookie persistence for selected org. `OrgSwitcher` component in header.

**Permissions** (`src/lib/permissions.ts`): `hasRole()`, `isAdmin()`, `canCreateClaim()`, `canApproveClaim()` — all check roles within the selected org.

**Key pages:** `/` (landing + sign-in), `/dashboard` (claims list), `/claims/new` (file claim), `/claims/[id]` (detail + timeline), `/admin/review` (review queue), `/profile`, `/dev/token` (debug).

## Stack

Next.js 16 (App Router), TypeScript strict, Auth.js v5 beta, Tailwind v4, shadcn/ui, Zod + React Hook Form, pnpm.

**Docker:** Multi-stage build (`node:22-alpine`), outputs standalone server. `AUTH_URL` env var (runtime) tells Auth.js its public URL — no URL baked into the image.

## Specs

Read before making changes:
- `ai-docs/nextjs-claims-app-spec.md` — primary spec
- `ai-docs/ciam-specification.md` — auth contracts, token structure
