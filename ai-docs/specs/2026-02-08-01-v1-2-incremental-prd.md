---
title: "v1.2 Incremental PRD — Enterprise Claims Platform Upgrade"
project: ciam-demo-private
sub_project: ciam-demo-private
type: spec
date: 2026-02-08
tags: []
why_private: "contains unpublished architecture decisions and internal specifications"
status: stable
source_repo: https://github.com/jackzhaojin/ciam-demo-private.git
source_tool: claude-code
harvested: 2026-03-28
---

# v1.2 Incremental PRD — Enterprise Claims Platform Upgrade

**Date:** 2026-02-08
**Baseline:** v1.1 (working end-to-end claims lifecycle, BFF auth, multi-tenant org scoping, 36 backend tests, 28 frontend tests, 4 E2E suites)
**Goal:** Transform the PoC from a functional CRUD app into a demo that makes enterprise buyers say "this is one of the best claims platforms I've seen"
**Estimated build time:** ~3 hours sequential (single senior developer with AI assistance)
**Stack:** Spring Boot 3.x (Java 21) + Next.js 16 (React 19, TypeScript) + Supabase PostgreSQL

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Current State Summary](#2-current-state-summary)
3. [v1.2 Feature Map](#3-v12-feature-map)
4. [Feature 1: Analytics Command Center Dashboard](#4-feature-1-analytics-command-center-dashboard)
5. [Feature 2: Claim Priority & Risk Scoring Engine](#5-feature-2-claim-priority--risk-scoring-engine)
6. [Feature 3: SLA Tracking with Breach Detection](#6-feature-3-sla-tracking-with-breach-detection)
7. [Feature 4: Claim Workflow Stepper & Enhanced Detail Page](#7-feature-4-claim-workflow-stepper--enhanced-detail-page)
8. [Feature 5: Fraud Risk Signal Engine](#8-feature-5-fraud-risk-signal-engine)
9. [Feature 6: Enhanced Admin Review Queue](#9-feature-6-enhanced-admin-review-queue)
10. [Feature 7: Rich Activity Timeline](#10-feature-7-rich-activity-timeline)
11. [Feature 8: Notes & Communication Thread](#11-feature-8-notes--communication-thread)
12. [Feature 9: Document & Evidence Management](#12-feature-9-document--evidence-management)
13. [Feature 10: CSV Export & Reporting](#13-feature-10-csv-export--reporting)
14. [Feature 11: Org-Branded Dashboard Experience](#14-feature-11-org-branded-dashboard-experience)
15. [Database Schema Changes](#15-database-schema-changes)
16. [API Contract Changes](#16-api-contract-changes)
17. [Build Sequence & Time Budget](#17-build-sequence--time-budget)
18. [What NOT to Build](#18-what-not-to-build)
19. [Success Criteria](#19-success-criteria)

---

## 1. Design Philosophy

### What separates "enterprise" from "toy"

Enterprise claims platforms (Guidewire ClaimCenter, Duck Creek Claims, Snapsheet) share patterns that signal maturity to evaluators:

1. **Computed intelligence, not just stored data.** Enterprise platforms derive insights — priority scores, SLA breach risk, fraud signals, trend metrics — rather than displaying raw database rows. The difference between a platform and a form builder.

2. **Data density with visual hierarchy.** Enterprise apps show more information per screen but use cards, badges, color coding, and progressive disclosure to keep it scannable. Summary → detail → drill-down.

3. **Temporal awareness.** Enterprise apps understand time: SLA countdowns, aging indicators, relative timestamps ("3 hours ago"), trend arrows. Static dates feel amateur.

4. **Color-coded status everywhere.** Every table row, every badge, every card uses meaningful, consistent color. Not text labels — visual signals that can be scanned at a glance.

5. **Multi-role intelligence.** The UI visibly adapts to the user's role. Admins see review queues and bulk actions. Viewers see their claims and read-only status. This proves the RBAC is real, not theoretical.

6. **Action density in context.** Approve, deny, escalate, add note — all visible right where the adjuster is looking, not buried in navigation.

### Our edge: CIAM + Claims convergence

Most claims demos show either identity management OR claims processing. We show both working together: org-scoped data isolation, role-aware UI, multi-tenant analytics, token-driven authorization — all visible in a single demo flow. v1.2 amplifies this convergence.

---

## 2. Current State Summary

### What exists (v1.1)

**Backend (Spring Boot):**
- 10 REST endpoints + health check
- Claims domain: `Claim` (UUID, claimNumber, status, type, description, amount, dates) + `ClaimEvent` (audit log)
- Status machine: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED/DENIED → CLOSED
- Org-scoped access: `OrgContextFilter` validates `X-Organization-Id` against JWT
- Role-based auth: admin (full), billing (read + approve), viewer (read-only)
- Flyway migrations (2 tables: `claims`, `claim_events`)
- 36 tests passing

**Frontend (Next.js):**
- 9 pages: landing, dashboard (table + status tabs + pagination), file claim (4-step wizard), claim detail (info + actions + timeline), admin review queue, profile, token debug
- Auth.js v5 BFF pattern with Keycloak OIDC
- Org switcher (cookie-persisted)
- Role-aware UI (sidebar, buttons, page access)
- shadcn/ui components, dark mode, Tailwind
- 28 unit tests, 4 E2E test suites

**Database:**
- `claims` table (id, claim_number, user_id, organization_id, status, type, description, incident_date, filed_date, amount, created_at, updated_at)
- `claim_events` table (id, claim_id, actor_user_id, event_type, note, timestamp)

### What's missing for enterprise wow

| Gap | Category |
|-----|----------|
| No analytics / KPIs — dashboard is just a table | Data intelligence |
| No priority or severity indicators | Triage |
| No SLA tracking or aging metrics | Operational awareness |
| No fraud detection signals | Risk intelligence |
| No workflow visualization on detail page | Process visibility |
| Flat activity timeline (UUIDs, no icons, no colors) | Audit UX |
| No notes/communication on claims | Collaboration |
| No document/evidence section | Completeness |
| No export or reporting | Enterprise data management |
| No org-branded experience | CIAM convergence |

---

## 3. v1.2 Feature Map

### Priority tiers

| Tier | Features | Build time | Impact |
|------|----------|------------|--------|
| **Must-have** | Analytics dashboard, Priority scoring, SLA tracking, Workflow stepper | ~90 min | Transforms first impression |
| **Should-have** | Fraud signals, Enhanced review queue, Rich timeline, Notes thread | ~60 min | Deepens detail page wow |
| **Nice-to-have** | Documents section, CSV export, Org branding | ~30 min | Enterprise completeness |

### Dependency graph

```
                    ┌──────────────────────┐
                    │  DB Migration V3     │
                    │  (priority, notes,   │
                    │   attachments)       │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                 ▼
    ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
    │ Stats API   │  │ Notes API    │  │ Attachments  │
    │ endpoint    │  │ endpoints    │  │ metadata API │
    └──────┬──────┘  └──────┬───────┘  └──────┬───────┘
           │                │                  │
    ┌──────┴──────┐  ┌──────┴───────┐  ┌──────┴───────┐
    │ Analytics   │  │ Notes thread │  │ Documents    │
    │ Dashboard   │  │ component    │  │ section      │
    └─────────────┘  └──────────────┘  └──────────────┘

    (These are independent frontend work items)
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │ Priority     │  │ SLA tracking │  │ Fraud signals│
    │ badges       │  │ (computed)   │  │ (computed)   │
    └──────────────┘  └──────────────┘  └──────────────┘

    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │ Workflow     │  │ Enhanced     │  │ CSV export   │
    │ stepper      │  │ review queue │  │              │
    └──────────────┘  └──────────────┘  └──────────────┘
```

---

## 4. Feature 1: Analytics Command Center Dashboard

**Priority:** MUST-HAVE | **Est. time:** 30 min | **Impact:** Transforms first impression

### What changes

Replace the current dashboard layout (jump straight into claims table) with a command center: summary KPI cards on top, optional chart, then the existing claims table below.

### Dashboard layout (top to bottom)

```
┌─────────────────────────────────────────────────────────────┐
│  [Org Name] Claims Dashboard              [OrgSwitcher] [▼] │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│ Total    │ Open     │ Avg      │ Total    │ Approval        │
│ Claims   │ Claims   │ Resol.   │ Exposure │ Rate            │
│   47     │   12     │  4.2d    │ $1.23M   │  78%            │
│ +3 this  │ ▲ 2 from │          │          │ ▲ 5% from       │
│  week    │ last wk  │          │          │  last month     │
├──────────┴──────────┴──────────┴──────────┴─────────────────┤
│  [Claims by Status - horizontal stacked bar or donut]       │
│  [Claims by Type - small bar chart]                         │
├─────────────────────────────────────────────────────────────┤
│  ⚠ 3 claims at risk of SLA breach                          │
│  🔴 1 claim breached SLA (CLM-2026-00041)                   │
├─────────────────────────────────────────────────────────────┤
│  Status tabs: ALL | DRAFT | SUBMITTED | ...                 │
│  ┌──────────┬──────┬──────────┬────────┬────────┬────────┐ │
│  │ Claim #  │ Pri  │ Type     │ Status │ Amount │ SLA    │ │
│  │ CLM-0041 │ 🔴   │ AUTO     │ ██████ │ $52K   │ ⚠ 4h  │ │
│  │ CLM-0040 │ 🟡   │ PROPERTY │ ██████ │ $12K   │ ✓ OK  │ │
│  └──────────┴──────┴──────────┴────────┴────────┴────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Backend: New stats endpoint

**`GET /api/claims/stats`** — Returns aggregate metrics for the current org.

```json
{
  "totalClaims": 47,
  "openClaims": 12,
  "claimsByStatus": {
    "DRAFT": 3,
    "SUBMITTED": 5,
    "UNDER_REVIEW": 4,
    "APPROVED": 22,
    "DENIED": 8,
    "CLOSED": 5
  },
  "claimsByType": {
    "AUTO": 18,
    "PROPERTY": 12,
    "LIABILITY": 9,
    "HEALTH": 8
  },
  "totalExposure": 1234567.89,
  "averageResolutionDays": 4.2,
  "approvalRate": 0.78,
  "claimsThisWeek": 3,
  "claimsLastWeek": 1
}
```

**Implementation approach:**
- New method in `ClaimRepository` using `@Query` with native SQL aggregations
- New `ClaimStatsResponse` DTO
- New `GET /api/claims/stats` in `ClaimController`
- All queries scoped to current org via `organization_id = :orgId`

### Frontend: Chart library

Use **recharts** (already common in Next.js/React ecosystems, lightweight, composable). A simple donut chart for status distribution and a small bar chart for claims by type.

### KPI computation

| Metric | SQL / Logic |
|--------|-------------|
| Total Claims | `COUNT(*) WHERE organization_id = ?` |
| Open Claims | `COUNT(*) WHERE status NOT IN ('CLOSED', 'DENIED')` |
| Claims by Status | `GROUP BY status` |
| Claims by Type | `GROUP BY type` |
| Total Exposure | `SUM(amount) WHERE status NOT IN ('CLOSED', 'DENIED')` |
| Avg Resolution Days | `AVG(EXTRACT(EPOCH FROM (closed_event.timestamp - created_event.timestamp)) / 86400)` for claims that have both CREATED and CLOSED events |
| Approval Rate | `COUNT(APPROVED) / COUNT(APPROVED + DENIED)` |
| Claims This Week | `COUNT(*) WHERE created_at >= (now - 7 days)` |

---

## 5. Feature 2: Claim Priority & Risk Scoring Engine

**Priority:** MUST-HAVE | **Est. time:** 20 min | **Impact:** Turns passive data into active intelligence

### Design

Priority is **computed, not stored** — derived deterministically from existing claim attributes. This means zero schema changes and the score automatically updates as claims age.

### Priority algorithm

```
Score = amount_score + type_score + age_score + status_score

amount_score:
  amount >= 100,000  → 40 points
  amount >= 50,000   → 30 points
  amount >= 10,000   → 20 points
  amount >= 1,000    → 10 points
  amount < 1,000     → 5 points

type_score:
  HEALTH             → 25 points  (health claims = regulatory urgency)
  LIABILITY          → 20 points  (legal exposure)
  AUTO               → 10 points
  PROPERTY           → 5 points

age_score (days since filed):
  > 30 days          → 30 points
  > 14 days          → 20 points
  > 7 days           → 10 points
  <= 7 days          → 0 points

status_score:
  UNDER_REVIEW       → 10 points  (active adjuster attention)
  SUBMITTED          → 5 points   (waiting for pickup)
  others             → 0 points

Priority mapping:
  score >= 70        → CRITICAL (red)
  score >= 50        → HIGH (orange)
  score >= 30        → MEDIUM (yellow)
  score < 30         → LOW (green)
```

### Where it appears

| Location | Display |
|----------|---------|
| Dashboard claims table | Priority badge column (colored dot + label) |
| Claim detail page | Priority badge next to claim number |
| Admin review queue | Priority badge column, sorted high-to-low by default |
| Stats endpoint | Add `claimsByPriority` counts |

### Backend approach

Add a `PriorityCalculator` utility class (pure function, no DB). Called in `ClaimResponse.fromEntity()` to include `priority` and `priorityScore` in every response. The frontend also computes this client-side for the SLA/aging components that update in real time.

```java
public record PriorityResult(String priority, int score) {}
// priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
```

### Frontend component

New `PriorityBadge` component (similar to `StatusBadge`):

| Priority | Color | Icon |
|----------|-------|------|
| CRITICAL | red bg, white text | AlertTriangle |
| HIGH | orange bg, white text | AlertCircle |
| MEDIUM | yellow bg, dark text | Clock |
| LOW | green bg, white text | CheckCircle |

---

## 6. Feature 3: SLA Tracking with Breach Detection

**Priority:** MUST-HAVE | **Est. time:** 20 min | **Impact:** Makes operations managers lean forward

### SLA rules

| Transition | SLA Target | Rationale |
|------------|------------|-----------|
| SUBMITTED → UNDER_REVIEW | 48 hours | Adjuster must pick up within 2 business days |
| UNDER_REVIEW → decision (APPROVED/DENIED) | 14 days | Resolution within 2 weeks |
| DRAFT → SUBMITTED | 7 days | Claimant should submit within a week |

### SLA computation (frontend, real-time)

```typescript
type SlaStatus = {
  status: "OK" | "WARNING" | "BREACHED"
  remainingMs: number        // negative if breached
  targetDate: Date
  label: string              // "2d 4h remaining" or "BREACHED - 3d overdue"
}

function computeSla(claim: Claim): SlaStatus | null {
  // Only compute for active claims (not CLOSED, not terminal)
  // WARNING threshold = 25% of SLA remaining
  // BREACHED = past target date
}
```

### Where it appears

| Location | Display |
|----------|---------|
| Dashboard claims table | New "SLA" column with countdown badge |
| Dashboard alert banner | "X claims at SLA risk, Y breached" (yellow/red bar) |
| Claim detail page | SLA status card with progress bar |
| Admin review queue | SLA column, sortable |
| Stats endpoint | `slaBreachedCount`, `slaAtRiskCount` |

### SLA badge rendering

| Status | Color | Example text |
|--------|-------|-------------|
| OK (> 25% remaining) | green | "12d remaining" |
| WARNING (< 25% remaining) | yellow/amber | "8h remaining" |
| BREACHED | red | "Overdue 3d" |
| N/A (CLOSED, DRAFT) | gray | "—" |

### Backend support

The stats endpoint adds:
```json
{
  "slaBreachedCount": 1,
  "slaAtRiskCount": 3
}
```

Computed by comparing `filed_date` / last status-change event timestamp against SLA targets.

---

## 7. Feature 4: Claim Workflow Stepper & Enhanced Detail Page

**Priority:** MUST-HAVE | **Est. time:** 20 min | **Impact:** Visual workflow proof

### Workflow stepper component

Horizontal progress stepper at the top of the claim detail page showing the full lifecycle:

```
  ✓ Draft  →  ✓ Submitted  →  ● Under Review  →  ○ Decision  →  ○ Closed
  Feb 1         Feb 2           Feb 3
```

**Design rules:**
- Completed steps: filled circle + checkmark, muted color, timestamp below
- Current step: highlighted circle (primary color), pulsing dot animation
- Future steps: empty circle, gray text
- If DENIED: the Decision step shows in red with "Denied" label
- If APPROVED: the Decision step shows in green with "Approved" label
- Connector lines between steps (solid for completed, dashed for future)

**Data source:** Derive step completion from `ClaimEvent` timestamps. The events array already contains CREATED, SUBMITTED, REVIEWED, APPROVED/DENIED, CLOSED events with timestamps.

### Enhanced detail page layout

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back    CLM-2026-00041    [CRITICAL] [UNDER_REVIEW]      │
├─────────────────────────────────────────────────────────────┤
│  ✓ Draft → ✓ Submitted → ● Under Review → ○ Decision → ○   │
│  Feb 1      Feb 2          Feb 3                            │
├────────────────────────────┬────────────────────────────────┤
│  Claim Details             │  SLA Status                    │
│  Type: AUTO                │  ████████░░  8d / 14d          │
│  Amount: $52,340.00        │  "6 days remaining"            │
│  Incident: 2026-01-28      │                                │
│  Filed: 2026-02-01         │  Priority: CRITICAL (87)       │
│  Description: ...          │                                │
├────────────────────────────┤  Risk Signals                  │
│  Actions                   │  ⚠ High amount ($52K)          │
│  [Approve] [Deny]          │  ⚠ HEALTH type - regulatory    │
│                            │  ⚠ Round number amount         │
├────────────────────────────┼────────────────────────────────┤
│  Notes & Communication     │  Documents & Evidence          │
│  ┌────────────────────┐    │  📄 Incident Report.pdf (2.1MB)│
│  │ Admin: Reviewed,   │    │  📷 Photo_001.jpg (540KB)      │
│  │ requesting docs    │    │  📋 Medical Records.pdf (4.3MB)│
│  │ Feb 3, 2:30pm     │    │  [+ Upload Document]           │
│  └────────────────────┘    │                                │
│  [Add Note]                │                                │
├────────────────────────────┴────────────────────────────────┤
│  Activity Timeline                                          │
│  ● Feb 3 - Moved to Under Review (Admin User)              │
│  ● Feb 2 - Submitted for review (Admin User)               │
│  ● Feb 1 - Claim created (Admin User)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Feature 5: Fraud Risk Signal Engine

**Priority:** SHOULD-HAVE | **Est. time:** 15 min | **Impact:** Hottest topic in insurtech

### Design

Rule-based heuristic signals computed server-side from existing claim data. Not ML — but presented professionally, it communicates that the platform has intelligence built in.

### Signal rules

| Signal ID | Rule | Severity | Label |
|-----------|------|----------|-------|
| `HIGH_AMOUNT` | amount > 2x average for that claim type in org | MEDIUM | "Amount exceeds typical range" |
| `ROUND_NUMBER` | amount % 1000 == 0 AND amount > 5000 | LOW | "Suspiciously round amount" |
| `RAPID_FILING` | filedDate - incidentDate < 24 hours | LOW | "Filed unusually quickly after incident" |
| `MULTIPLE_RECENT` | Same userId has 3+ claims in last 90 days | HIGH | "Multiple claims in short period" |
| `HIGH_VALUE_NEW_USER` | First claim for this user AND amount > $25,000 | MEDIUM | "High-value claim from new claimant" |
| `TYPE_AMOUNT_MISMATCH` | PROPERTY claim > $200K or AUTO claim > $150K | MEDIUM | "Amount unusual for claim type" |

### Backend: New endpoint

**`GET /api/claims/{id}/risk-signals`** — Returns computed risk signals for a specific claim.

```json
{
  "overallRisk": "MEDIUM",
  "riskScore": 45,
  "signals": [
    {
      "id": "HIGH_AMOUNT",
      "severity": "MEDIUM",
      "label": "Amount exceeds typical range",
      "detail": "This claim ($52,340) is 2.8x the average AUTO claim ($18,692) in this organization",
      "recommendation": "Request additional documentation"
    },
    {
      "id": "ROUND_NUMBER",
      "severity": "LOW",
      "label": "Suspiciously round amount",
      "detail": "Amount is a round number ($52,000 component)",
      "recommendation": "Verify with itemized receipt"
    }
  ]
}
```

### Frontend: RiskSignals card

Displayed on the claim detail page right sidebar. Each signal as a colored chip:
- HIGH severity: red left border
- MEDIUM severity: amber left border
- LOW severity: blue left border

Overall risk level badge at top of card.

---

## 9. Feature 6: Enhanced Admin Review Queue

**Priority:** SHOULD-HAVE | **Est. time:** 15 min | **Impact:** Power-user adjuster workflow

### Current state

Simple table with claim number, type, status, amount, filed date, and action buttons. No sorting, no filtering beyond status, no priority indicators.

### Enhanced design

```
┌─────────────────────────────────────────────────────────────┐
│  Review Queue                          12 claims pending    │
├─────────────────────────────────────────────────────────────┤
│  Filters: [Type ▼] [Priority ▼] [Amount range] [Date ▼]   │
│  Sort by: [Priority (High→Low) ▼]                          │
├──────┬──────┬──────┬────────┬────────┬────────┬────────────┤
│ ☐    │ Claim│ Pri  │ Type   │ Amount │ SLA    │ Actions    │
├──────┼──────┼──────┼────────┼────────┼────────┼────────────┤
│ ☐    │ 0041 │ 🔴   │ AUTO   │ $52K   │ ⚠ 4h  │ [▶][✓][✗] │
│ ☐    │ 0038 │ 🟡   │ HEALTH │ $12K   │ ✓ OK  │ [▶][✓][✗] │
├──────┴──────┴──────┴────────┴────────┴────────┴────────────┤
│  Selected: 0  │  [Bulk Approve] [Bulk Deny]                │
└─────────────────────────────────────────────────────────────┘
```

### New capabilities

1. **Priority column** — Color-coded priority badge, default sort high→low
2. **SLA column** — Countdown badges showing urgency
3. **Sortable columns** — Click column headers to sort (priority, amount, filed date, SLA)
4. **Type filter dropdown** — Filter by AUTO, PROPERTY, LIABILITY, HEALTH
5. **Bulk selection** — Checkboxes per row, "Select All" header checkbox
6. **Bulk actions bar** — Appears when 1+ claims selected: "Approve Selected (N)" / "Deny Selected (N)"
7. **Quick-view expansion** — Click a row to expand inline claim summary (description, incident date, risk signals) without navigating away

### Backend support for bulk actions

**`POST /api/claims/bulk-action`** — Performs the same action on multiple claims.

```json
// Request
{
  "claimIds": ["uuid-1", "uuid-2", "uuid-3"],
  "action": "approve",
  "note": "Batch approved after review"
}

// Response
{
  "succeeded": ["uuid-1", "uuid-2"],
  "failed": [
    { "claimId": "uuid-3", "reason": "Claim is not in UNDER_REVIEW status" }
  ]
}
```

---

## 10. Feature 7: Rich Activity Timeline

**Priority:** SHOULD-HAVE | **Est. time:** 15 min | **Impact:** Audit trail confidence

### Current state

`ClaimTimeline` renders a vertical list with event type text, note, and timestamp. Shows actor as UUID. No icons, no color coding, basic styling.

### Enhanced design

Each timeline entry becomes a rich card:

```
  ● ✓ Approved                                    Feb 5, 2:30 PM
  │   by Admin User (admin@test.com)               3 hours ago
  │   "Reviewed documentation, all checks passed"
  │
  ● 📋 Moved to Under Review                      Feb 3, 10:15 AM
  │   by Admin User (admin@test.com)               2 days ago
  │
  ● 📤 Submitted for Review                       Feb 2, 9:00 AM
  │   by Admin User (admin@test.com)               3 days ago
  │
  ● 📝 Claim Created                              Feb 1, 4:45 PM
  │   by Admin User (admin@test.com)               4 days ago
  │   "Auto collision at Main St intersection"
```

### Enhancements

| Enhancement | Detail |
|-------------|--------|
| Event type icons | CREATED → FileText, SUBMITTED → Send, REVIEWED → Search, APPROVED → CheckCircle (green), DENIED → XCircle (red), CLOSED → Archive, UPDATED → Edit |
| Color coding | Approval events green, denial red, status changes blue, notes gray |
| Actor names | Resolve from session data or pass actor display name in event response |
| Relative timestamps | "3 hours ago" alongside absolute date |
| Note display | Show full note text with proper wrapping |
| Expandable | If more than 5 events, show latest 5 with "Show all N events" expand |

### Backend change

Add `actorDisplayName` field to `ClaimEventResponse`. Populate from the JWT's `preferred_username` or `name` claim when creating events, stored alongside `actorUserId`.

This requires a schema change — see [Section 15](#15-database-schema-changes).

---

## 11. Feature 8: Notes & Communication Thread

**Priority:** SHOULD-HAVE | **Est. time:** 20 min | **Impact:** Collaboration proof

### What it is

A free-text notes thread on each claim, separate from the audit timeline. Adjusters, admins, and billing users can add notes. Notes appear in chronological order, chat-style.

### Why it matters

In real claims processing, adjusters leave notes constantly: "Called claimant, waiting for police report", "Medical records received, forwarding to medical review", "Supervisor approved exception for amount over threshold." This is where the human workflow lives.

### Data model

New `claim_notes` table:

```sql
CREATE TABLE claim_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES claims(id),
    author_user_id UUID NOT NULL,
    author_display_name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_claim_notes_claim_id ON claim_notes(claim_id);
```

### API endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| `GET` | `/api/claims/{id}/notes` | List notes for claim (ascending) | admin, billing, viewer |
| `POST` | `/api/claims/{id}/notes` | Add note to claim | admin, billing |

**POST request:**
```json
{
  "content": "Called claimant, waiting for police report"
}
```

**GET response:**
```json
[
  {
    "id": "uuid",
    "claimId": "uuid",
    "authorDisplayName": "Admin User",
    "content": "Called claimant, waiting for police report",
    "createdAt": "2026-02-03T14:30:00Z"
  }
]
```

### Frontend component

`NotesThread` — displayed on claim detail page, left column below actions.

```
┌─────────────────────────────────┐
│  Notes (3)                      │
├─────────────────────────────────┤
│  Admin User · Feb 3, 2:30 PM   │
│  Called claimant, waiting for   │
│  police report                  │
│                                 │
│  Admin User · Feb 4, 10:00 AM  │
│  Police report received. Amount │
│  matches initial estimate.      │
│                                 │
│  Admin User · Feb 5, 9:15 AM   │
│  Forwarding to billing for     │
│  final approval.               │
├─────────────────────────────────┤
│  [                           ]  │
│  [Write a note...            ]  │
│  [              ] [Add Note]    │
└─────────────────────────────────┘
```

Viewers see notes but cannot add them (no input field rendered).

---

## 12. Feature 9: Document & Evidence Management

**Priority:** NICE-TO-HAVE | **Est. time:** 15 min | **Impact:** Enterprise completeness

### Design (metadata-only approach)

Store document metadata (filename, size, type, upload date) without actual file storage. This demonstrates the UX without the infrastructure complexity of file storage.

### Data model

New `claim_attachments` table:

```sql
CREATE TABLE claim_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES claims(id),
    filename VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by_user_id UUID NOT NULL,
    uploaded_by_display_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_claim_attachments_claim_id ON claim_attachments(claim_id);
```

### API endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| `GET` | `/api/claims/{id}/attachments` | List attachments | admin, billing, viewer |
| `POST` | `/api/claims/{id}/attachments` | Add attachment metadata | admin, billing |
| `DELETE` | `/api/claims/{id}/attachments/{attachmentId}` | Remove attachment | admin |

### Frontend component

`DocumentsSection` — displayed on claim detail page, right column.

File type icons by MIME type:
- `application/pdf` → FileText (red accent)
- `image/*` → Image (blue accent)
- `text/*` → FileText (gray accent)
- Default → File

Show: icon + filename + size (formatted: "2.1 MB") + uploaded by + date.

"Upload Document" button opens a form with filename, file type selector, and estimated size input (since we're metadata-only for the PoC).

### Seed data

When claims are created, optionally seed 2-3 mock attachments for demo purposes (e.g., "Incident_Report.pdf", "Photo_Evidence_001.jpg", "Medical_Records.pdf").

---

## 13. Feature 10: CSV Export & Reporting

**Priority:** NICE-TO-HAVE | **Est. time:** 10 min | **Impact:** Checks enterprise eval box

### Export button

Add "Export CSV" button to dashboard header (next to "File New Claim"). Downloads the current org's claims as a CSV file.

### Backend endpoint

**`GET /api/claims/export`** — Returns CSV of all claims for the current org.

Response headers:
```
Content-Type: text/csv
Content-Disposition: attachment; filename="claims-export-2026-02-08.csv"
```

CSV columns: Claim Number, Type, Status, Priority, Amount, Incident Date, Filed Date, Description, SLA Status

### Implementation

Use Spring's `HttpServletResponse` to stream CSV directly. No library dependency needed — simple string building with proper escaping.

---

## 14. Feature 11: Org-Branded Dashboard Experience

**Priority:** NICE-TO-HAVE | **Est. time:** 10 min | **Impact:** CIAM convergence proof

### What changes

Make the current organization context visually prominent throughout the app. This is where CIAM meets claims — the org-scoped experience should be unmistakable.

### Enhancements

1. **Dashboard header:** Show org name prominently: "Acme Corporation — Claims Dashboard"
2. **User role badge:** Show current role next to username in header: "Admin User [Admin]"
3. **Org stats context:** KPI cards scoped and labeled: "47 claims across Acme Corporation"
4. **Contract tier indicator:** Show org's contract tier from `org_attributes` (enterprise/standard) in the dashboard header. This proves the org attributes from the JWT are actually used in the UI.
5. **Loyalty tier badge:** Show user's loyalty tier (gold/silver/bronze) on profile page and optionally in the header. This proves user attributes from the JWT flow through.

### Data source

All of this data already exists in the JWT / Auth.js session:
- `session.user.organizations[orgId].name` — org name
- `session.user.organizations[orgId].roles` — user's roles
- `session.user.loyaltyTier` — loyalty tier
- Org attributes available via `org_attributes` claim (already extracted by Auth.js)

---

## 15. Database Schema Changes

### V3 Migration

**File:** `claims-api/src/main/resources/db/migration/V3__v1_2_notes_and_attachments.sql`

```sql
-- Notes table for claim communication thread
CREATE TABLE claim_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL,
    author_user_id UUID NOT NULL,
    author_display_name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_claim_notes_claim FOREIGN KEY (claim_id) REFERENCES claims(id)
);
CREATE INDEX idx_claim_notes_claim_id ON claim_notes(claim_id);

-- Attachments metadata table (no file storage, metadata only)
CREATE TABLE claim_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL,
    filename VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by_user_id UUID NOT NULL,
    uploaded_by_display_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_claim_attachments_claim FOREIGN KEY (claim_id) REFERENCES claims(id)
);
CREATE INDEX idx_claim_attachments_claim_id ON claim_attachments(claim_id);

-- Add actor_display_name to claim_events for rich timeline
ALTER TABLE claim_events ADD COLUMN actor_display_name VARCHAR(255);
```

### Entity changes

| Entity | Change |
|--------|--------|
| `ClaimEvent` | Add `actorDisplayName` field |
| `ClaimNote` (new) | New entity mapping `claim_notes` |
| `ClaimAttachment` (new) | New entity mapping `claim_attachments` |

### Repository changes

| Repository | New methods |
|------------|-------------|
| `ClaimRepository` | `countByOrganizationIdAndStatus()`, `sumAmountByOrganizationId()`, aggregate queries for stats |
| `ClaimNoteRepository` (new) | `findByClaimIdOrderByCreatedAtAsc()` |
| `ClaimAttachmentRepository` (new) | `findByClaimIdOrderByCreatedAtDesc()` |
| `ClaimEventRepository` | No change (existing queries sufficient) |

---

## 16. API Contract Changes

### New endpoints summary

| Method | Path | Feature | Request | Response |
|--------|------|---------|---------|----------|
| `GET` | `/api/claims/stats` | Analytics | — | `ClaimStatsResponse` |
| `GET` | `/api/claims/export` | CSV Export | — | `text/csv` file |
| `POST` | `/api/claims/bulk-action` | Bulk actions | `BulkActionRequest` | `BulkActionResponse` |
| `GET` | `/api/claims/{id}/risk-signals` | Fraud signals | — | `RiskSignalsResponse` |
| `GET` | `/api/claims/{id}/notes` | Notes | — | `ClaimNote[]` |
| `POST` | `/api/claims/{id}/notes` | Notes | `CreateNoteRequest` | `ClaimNote` |
| `GET` | `/api/claims/{id}/attachments` | Documents | — | `ClaimAttachment[]` |
| `POST` | `/api/claims/{id}/attachments` | Documents | `CreateAttachmentRequest` | `ClaimAttachment` |
| `DELETE` | `/api/claims/{id}/attachments/{aid}` | Documents | — | 204 |

### Modified responses

`ClaimResponse` gains two new computed fields:
```json
{
  "...existing fields...",
  "priority": "CRITICAL",
  "priorityScore": 87
}
```

`ClaimEventResponse` gains:
```json
{
  "...existing fields...",
  "actorDisplayName": "Admin User"
}
```

### Auth rules for new endpoints

| Endpoint | viewer | billing | admin |
|----------|--------|---------|-------|
| GET /stats | ✓ | ✓ | ✓ |
| GET /export | ✓ | ✓ | ✓ |
| POST /bulk-action | ✗ | approve only | ✓ |
| GET /risk-signals | ✓ | ✓ | ✓ |
| GET /notes | ✓ | ✓ | ✓ |
| POST /notes | ✗ | ✓ | ✓ |
| GET /attachments | ✓ | ✓ | ✓ |
| POST /attachments | ✗ | ✓ | ✓ |
| DELETE /attachments | ✗ | ✗ | ✓ |

---

## 17. Build Sequence & Time Budget

### Recommended build order (sequential, ~3 hours)

| Phase | Time | Work | Dependencies |
|-------|------|------|-------------|
| **Phase 0** | 10 min | Run V3 migration. Add `ClaimNote`, `ClaimAttachment` entities + repos. Add `actorDisplayName` to `ClaimEvent`. | None |
| **Phase 1** | 30 min | **Analytics dashboard.** Stats endpoint (aggregate queries + DTO). Frontend: KPI cards, recharts donut/bar chart, SLA alert banner. | V3 migration |
| **Phase 2** | 20 min | **Priority scoring.** `PriorityCalculator` utility. Add `priority`/`priorityScore` to `ClaimResponse`. Frontend: `PriorityBadge` component, add to dashboard table and detail page. | None |
| **Phase 3** | 20 min | **SLA tracking.** Frontend-only: `computeSla()` utility, `SlaBadge` component, SLA column in tables, SLA card on detail page. Backend: add SLA counts to stats endpoint. | Stats endpoint |
| **Phase 4** | 20 min | **Workflow stepper + detail page redesign.** `ClaimWorkflowStepper` component. Reorganize detail page layout (two-column, cards). | None |
| **Phase 5** | 15 min | **Fraud signals.** `RiskSignalService` with rule engine. `/risk-signals` endpoint. Frontend: `RiskSignals` card on detail page. | V3 migration |
| **Phase 6** | 15 min | **Enhanced review queue.** Priority/SLA columns, sort controls, type filter, row expand for quick view. | Priority + SLA |
| **Phase 7** | 15 min | **Rich timeline.** Event icons, color coding, relative timestamps, actor names, expandable. | actorDisplayName field |
| **Phase 8** | 20 min | **Notes thread.** Notes service + endpoints. Frontend `NotesThread` component with add-note form. | V3 migration |
| **Phase 9** | 15 min | **Documents section.** Attachments service + endpoints. Frontend `DocumentsSection` component. Seed mock data. | V3 migration |
| **Phase 10** | 10 min | **CSV export + org branding.** Export endpoint. Org name in dashboard header, role badge, contract tier display. | Stats endpoint |
| **Phase 11** | 10 min | **Testing.** Add unit tests for PriorityCalculator, RiskSignalService. Update E2E tests for new dashboard layout. | All features |

**Total: ~200 minutes (~3h 20m)**

### Parallelization opportunity

If using agent teams (2 agents):

**Agent A (Backend):** Phase 0 → Stats endpoint → Priority calculator → Risk signal service → Notes service → Attachments service → Export endpoint → Backend tests

**Agent B (Frontend):** KPI cards + chart → Priority badge → SLA badge → Workflow stepper → Detail page layout → Review queue → Rich timeline → Notes thread → Documents section → Org branding

After Phase 0 completes (migration + entities), both agents can work independently. Frontend can mock API responses while backend builds.

---

## 18. What NOT to Build

Explicitly out of scope for v1.2 to prevent scope creep:

| Feature | Why not |
|---------|---------|
| Actual file upload storage (S3, Supabase Storage) | Infrastructure complexity; metadata-only proves the UX |
| Real ML/AI fraud detection | Requires model training; heuristic rules demonstrate the concept |
| Email notifications | Requires email service integration (SendGrid, etc.) |
| Real-time WebSocket updates | Nice but not needed for demo; page refresh suffices |
| Claim assignment/routing | Adds workflow complexity beyond current roles model |
| Custom claim fields / dynamic forms | Over-engineering; fixed schema is fine for demo |
| Multi-language / i18n | English-only for PoC |
| Accessibility audit / WCAG compliance | Important but not demo-impacting |
| Performance optimization / caching | Unnecessary at demo data volumes |
| Mobile-responsive redesign | Desktop-first for demo; Tailwind handles basic responsiveness |

---

## 19. Success Criteria

### Demo script validation

After v1.2, this demo flow should be possible:

1. **Login as admin@test.com** → Land on analytics dashboard
2. **Dashboard shows:** 5 KPI cards, status chart, type chart, SLA alert banner, priority-sorted claims table with colored badges
3. **Org context visible:** "Acme Corporation" in header, "Admin" role badge, "Enterprise" contract tier
4. **Click a CRITICAL claim** → Detail page with:
   - Workflow stepper showing progress
   - Claim details + SLA countdown + priority badge
   - Fraud risk signals (2-3 colored chips with explanations)
   - Notes thread with existing communication
   - Documents section with mock attachments
   - Rich activity timeline with icons and colors
5. **Take action:** Approve the claim → toast notification, stepper updates, timeline entry added
6. **Go to admin review queue** → See priority-sorted claims with SLA countdown, bulk-select 2 claims, bulk approve
7. **Switch org** (Globex Inc via org switcher) → Dashboard refreshes with Globex data, different KPIs, different claims
8. **Export CSV** → Download Globex claims as CSV file
9. **Switch to viewer account** → Dashboard shows only personal claims, no admin menu, no action buttons, notes visible but read-only

### Measurable outcomes

| Metric | v1.1 | v1.2 target |
|--------|------|-------------|
| Dashboard data density | 1 table | 5 KPI cards + 2 charts + alert banner + enriched table |
| Claim detail page sections | 3 (details, actions, timeline) | 7 (stepper, details, SLA, priority, risk, notes, docs, timeline) |
| Admin review queue features | Basic table + buttons | Sortable, filterable, bulk actions, priority/SLA columns |
| Computed intelligence signals | 0 | Priority score + SLA status + fraud risk signals |
| API endpoints | 11 | 19+ |
| DB tables | 2 | 4 |
| Frontend components (claims-specific) | 6 | 14+ |

---

*This PRD was generated from a complete codebase audit of all Java files, TypeScript files, bash scripts, test files, and specification documents, combined with competitive analysis of Guidewire ClaimCenter, Duck Creek Claims, Snapsheet, and modern insurtech platforms.*
