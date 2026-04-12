---
title: "Release Strategy: Private → Public → Deploy"
project: ciam-demo-private
sub_project: ciam-demo-private
type: spec
date: 2026-02-22
tags: []
why_private: "contains unpublished architecture decisions and internal specifications"
status: stable
source_repo: https://github.com/jackzhaojin/ciam-demo-private.git
source_tool: claude-code
harvested: 2026-03-28
---

# Release Strategy: Private → Public → Deploy

## Two-Repo Architecture

- **Private**: `ciam-demo-private` — development, AI docs, agent configs
- **Public**: `ciam-demo` — production code, CI/CD workflows, releases

`mirror-to-public.sh` syncs commits only (no tags, no auto-push). Excluded paths: `CLAUDE.md`, `ai-docs/`, `.claude/`, `.github/workflows/`, `local-only/`, etc.

## Release Flow

```bash
# 1. Tag private repo (bookkeeping — marks which commit was released)
cd ~/dev/ciam-demo-private
git tag v1.3.0

# 2. Mirror commits to public
./mirror-to-public.sh

# 3. Push the synced commits
cd ~/dev/ciam-demo
git push

# 4. Create release on public (creates tag + triggers CI/CD)
gh release create v1.3.0 --notes "v1.3.0 - feature summary here..."
```

### What happens after step 4

`gh release create` pushes the tag and creates the release atomically. The tag push triggers both workflows in parallel:

```
push tag v1.3.0
├─ claims-api.yml:  test → build ARM64 → push GHCR → deploy to Oracle VM → update release notes
└─ claims-web.yml:  build ARM64 → push GHCR → deploy to Oracle VM → update release notes
```

Images are tagged `:<version>` + `:latest`. The `update-release` job appends container image links to the GitHub release.

## Important Rules

- **Never `git push --tags` from private to public.** SHAs differ between repos (mirror creates new commits), so a private tag on the public remote would point to a nonexistent commit. Keep tags independent.
- **Private tag is optional.** Only the public tag matters operationally. Private tag is for traceability (`git log v1.3.0` in either repo).
- **`push: tags: [v*]`** is the workflow trigger — not the `release` event (which doesn't work for tags targeting old commits).
- **Feature summaries must be hand-written** in `--notes`. `--generate-notes` only gives a changelog diff link.

## Manual Operations

```bash
# Build without deploying (e.g., retroactive build for old commit)
gh workflow run claims-api.yml -f version=v1.0.0 -f ref=<commit-sha> -f deploy=false

# Deploy a specific version (rollback)
gh workflow run deploy-only-claims-api.yml -f action_type=deploy -f version=v1.0.0

# Restart containers (no image pull)
gh workflow run deploy-only-claims-api.yml -f action_type=restart
```

## Version History

| Version | Commit (public) | Description |
|---------|----------------|-------------|
| v1.0.0  | `2429574` | Initial production release |
| v1.1.0  | `65c0e8b` | Evaluation fixes |
| v1.2.0  | `632e2b2` | Advanced claims, analytics, CI/CD refactor |
| v1.2.1  | `84266a8` | Bug fixes: redirect loop, status filtering, vitest config |
