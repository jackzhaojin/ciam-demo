---
title: "Claude Code CLI Kickoff Prompt"
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

# Claude Code CLI Kickoff Prompt

## Setup (one-time)

```bash
npm install -g @anthropic-ai/claude-code
```

Ensure agent teams is enabled in `~/.claude/settings.json`:
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

## Launch

```bash
cd ciam-claims-poc   # root folder with ai-docs/ inside
claude
# Press Shift+Tab to toggle auto-accept mode
```

## Paste This

```
Read ai-docs/kickoff-guide.md first, then all other docs it references in ai-docs/. The kickoff guide is your master plan — it has the build order, .env.example, and gap fixes already applied to the specs.

IMPORTANT CONTEXT:
- We are NOT using dev containers. Local dev uses JDK 21 (eclipse-temurin) and Node 22 LTS installed directly.
- Dockerfiles in deployment-guide.md are for production CI/CD only.
- Gap fixes from kickoff-guide.md §7 have already been applied to the specs.

CREATE AN AGENT TEAM with 3 specialists. All 3 should start building immediately — they do NOT need real credentials to write code. I (the human) will be setting up Phase Two, Supabase, and Google OAuth in parallel while the team works.

Team structure:
1. "ciam-scripter" — Reads ai-docs/ciam-specification.md. Writes all bash scripts in ciam/scripts/ and ciam/test/verify-setup.sh. Scripts should be code-complete and idempotent — they'll run once I provide .env credentials.

2. "backend-dev" — Reads ai-docs/spring-boot-claims-spec.md + ai-docs/ciam-specification.md. Scaffolds the full Spring Boot project in claims-api/: build.gradle.kts, Flyway migrations, JPA entities, service layer, REST controllers, security config. Write tests with mocked JWTs (SecurityMockMvcRequestPostProcessors.jwt()). Use the CONCEPTUAL token structure from the CIAM spec for now — we'll adapt to the real structure after Phase 2.

3. "web-dev" — Reads ai-docs/nextjs-claims-app-spec.md + ai-docs/ciam-specification.md. Scaffolds the full Next.js project in claims-web/: create-next-app with TypeScript + Tailwind + shadcn/ui, Auth.js with Keycloak provider, all pages (dashboard, claims, admin, profile), components, API client. Write tests with mocked Auth.js sessions. Use the CONCEPTUAL token structure for now.

All 3 teammates start building in PARALLEL right now.

I will message you as I complete human setup steps:
- "Phase Two is ready, here's the base URL: ..." → update .env
- "Supabase is ready, here's the JDBC URL: ..." → update .env
- "All credentials are in .env, run CIAM scripts" → coordinate Phase 2
- After CIAM scripts run, I'll share the ACTUAL token structure → teammates adapt

This should be obvious - for this go, please don't have multiple Claude Code team members / swarm members work on the same feature buildout. Let's have ciam / nodejs/spring be separate.

Also we shuld note that in deployment I added /Users/jackjin/dev/jack-dev-server-configs to claude code, s you have access to that directory and make changes.

Oracle is at inside /Users/jackjin/dev/jack-dev-server-configs/server/oracle-arm4-free-vm that's claude code manages the VM, so during deployment makes sure to look at that. Actually update this info with /Users/jackjin/dev/ciam-demo/ai-docs/claude-code-kickoff-prompt.md

Use delegate mode (Shift+Tab) so you focus on coordination, not coding.
Start Phase 1 now — spawn the team.

Also, I need help creating stuff manually, please work with me!
```
