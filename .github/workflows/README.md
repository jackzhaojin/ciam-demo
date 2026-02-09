# CI/CD Workflows

## Architecture

```
gh release create v1.2.0 --generate-notes
  └─> tag v1.2.0 pushed to GitHub
        ├─> claims-api.yml:  test → build ─┬─> deploy (via workflow_call)
        │                                  └─> update-release (appends image link)
        └─> claims-web.yml:  build ─┬─> deploy (via workflow_call)
                                    └─> update-release (appends image link)
                                │
                   deploy-only-*.yml  ← single source of truth for deploy logic
```

### Design Decisions

- **Release-first**: You create the GitHub Release, which pushes a tag, which triggers builds. The release exists before builds start — no race conditions.
- **workflow_call for deploy**: Deploy logic lives in `deploy-only-*.yml` only. Build workflows call into them via `workflow_call`. One place to maintain deploy/healthcheck logic.
- **Build and deploy are separable**: The `deploy` input (default: true) lets you build without deploying. Useful for retroactive version tagging or testing builds.
- **Monorepo-friendly**: One tag (`v1.2.0`) triggers all service builds. No per-service tags needed.

## Workflows

| File | Triggers | Purpose |
|------|----------|---------|
| `claims-api.yml` | Tag push `v*`, manual dispatch | Test, build Docker image, optionally deploy |
| `claims-web.yml` | Tag push `v*`, manual dispatch | Build Docker image, optionally deploy |
| `deploy-only-claims-api.yml` | Called by claims-api.yml, manual dispatch | Deploy or restart claims-api container |
| `deploy-only-claims-web.yml` | Called by claims-web.yml, manual dispatch | Deploy or restart claims-web container |

## How To

### Release a new version (normal flow)

```bash
gh release create v1.2.0 --generate-notes
```

This single command:
1. Creates tag `v1.2.0` on GitHub
2. Creates a Release page with auto-generated notes from commits
3. Tag push triggers both build workflows
4. Images pushed to GHCR as `ciam-claims-api:v1.2.0` and `ciam-claims-web:v1.2.0`
5. Both services deployed to the Oracle VM
6. Each build's `update-release` job appends its container image link to the release notes

The `update-release` job runs after a successful build on tag pushes only. It fetches the
current release body, checks if the image link is already present, and appends it if not.
Since claims-web (~5 min) finishes before claims-api (~14 min), the release notes get
updated incrementally — web's image link first, then API's. No race condition in practice.

### Build without deploying (manual dispatch)

From CLI:
```bash
gh workflow run claims-api.yml -f version=v1.0.0 -f ref=<commit-sha> -f deploy=false
```

Or use the "Run workflow" button in GitHub Actions UI. Useful for:
- Retroactively tagging old code as a version
- Rebuilding an image without touching production

### Deploy a specific version (rollback)

```bash
gh workflow run deploy-only-claims-api.yml -f action_type=deploy -f version=v1.0.0
```

Pulls `ciam-claims-api:v1.0.0` from GHCR, retags as `latest`, runs `docker compose up`.

### Restart a container (no image pull)

```bash
gh workflow run deploy-only-claims-api.yml -f action_type=restart
```

### Quick rebuild from main (no version tag)

```bash
gh workflow run claims-web.yml
```

Images tagged with branch name (e.g., `ciam-claims-web:main`).

## Docker Images

All images are pushed to GHCR (GitHub Container Registry):
- `ghcr.io/jackzhaojin/ciam-claims-api`
- `ghcr.io/jackzhaojin/ciam-claims-web`

Each build produces two tags:
- `:<version>` (e.g., `:v1.2.0`) — immutable version
- `:latest` — always points to the most recent build

## Version Reporting

Both services expose a health endpoint that reports the deployed version:

```
curl :8080/api/health  → {"status":"UP","version":"v1.2.0"}
curl :3001/api/health  → {"status":"UP","version":"v1.2.0"}
```

The version flows: **git tag → workflow `VERSION` env → Docker `build-args` → container `APP_VERSION` env var → health endpoint**. When built via tag push, the version matches the tag. When built via manual dispatch without a version, it defaults to the branch name (e.g., `main`).

## Infrastructure

- **Build**: QEMU cross-compile on x86 runners → ARM64 images (~5 min web, ~14 min API with tests)
- **Registry**: GHCR (`ghcr.io`)
- **Deploy target**: Oracle ARM64 VM (A1.Flex) via SSH
- **Compose**: `~/jack-dev-server-configs/server/oracle-arm4-free-vm/deploy-ciam/`
