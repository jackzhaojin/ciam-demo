---
title: "CIAM Claims PoC — Deployment Guide"
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

# CIAM Claims PoC — Deployment Guide

## Docker, GitHub Actions, ghcr.io, and Oracle VM

**Document Purpose:** This guide covers how to package, build, push, and deploy the Spring Boot backend and Next.js frontend as Docker containers. It defines the Dockerfiles, GitHub Actions workflows, and the deployment process to the Oracle VM.

**Audience:** AI agents building the CI/CD pipeline, and the human operator managing the Oracle VM.

**Prerequisites:** Read `kickoff-guide.md` first. The application must be working locally before you deploy it.

---

## 1. Deployment Architecture

```
GitHub Repository (ciam-claims-poc)
    │
    │  push to main (or manual trigger)
    │
    ▼
GitHub Actions
    ├── claims-api workflow (triggered by changes in claims-api/**)
    │     ├── Build Spring Boot JAR
    │     ├── Build Docker image (eclipse-temurin:21)
    │     └── Push to ghcr.io/OWNER/ciam-claims-api:latest
    │
    └── claims-web workflow (triggered by changes in claims-web/**)
          ├── Build Next.js (pnpm build)
          ├── Build Docker image (node:lts-alpine)
          └── Push to ghcr.io/OWNER/ciam-claims-web:latest
    │
    │  SSH to Oracle VM
    ▼
Oracle VM
    ├── docker pull ghcr.io/OWNER/ciam-claims-api:latest
    ├── docker pull ghcr.io/OWNER/ciam-claims-web:latest
    ├── docker run claims-api on port 8080
    └── docker run claims-web on port 3000
```

**No reverse proxy for now.** Services are exposed directly on their ports. Add Traefik/Nginx/Caddy later when you need SSL or domain routing.

---

## 2. Dockerfiles

### 2.1 Spring Boot — `claims-api/Dockerfile`

Multi-stage build: compile with JDK, run with JRE. Uses the same OpenJDK version as local development.

```dockerfile
# ============================================================
# Stage 1: Build
# ============================================================
FROM eclipse-temurin:21-jdk-alpine AS build

WORKDIR /app

# Copy Gradle wrapper and build files first (layer caching)
COPY gradlew gradlew
COPY gradle/ gradle/
COPY build.gradle.kts settings.gradle.kts ./

# Download dependencies (cached unless build files change)
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon

# Copy source code
COPY src/ src/

# Build the fat JAR (skip tests — they ran in CI already)
RUN ./gradlew bootJar --no-daemon -x test

# ============================================================
# Stage 2: Run
# ============================================================
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy the built JAR from the build stage
COPY --from=build /app/build/libs/*.jar app.jar

# Spring Boot default port
EXPOSE 8080

# JVM tuning for containers
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
```

**Key decisions:**
- `eclipse-temurin:21` — same JDK family for build and run. Use this same version locally.
- Alpine base — smaller image (~200MB vs ~400MB for Debian).
- Non-root user — basic security hygiene.
- `UseContainerSupport` — lets the JVM respect Docker memory limits.
- Tests skipped in Docker build — they run in the GitHub Actions step before the Docker build.

### 2.2 Next.js — `claims-web/Dockerfile`

Multi-stage build: install deps + build, then copy the standalone output.

```dockerfile
# ============================================================
# Stage 1: Dependencies
# ============================================================
FROM node:22-alpine AS deps

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# ============================================================
# Stage 2: Build
# ============================================================
FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars that are baked into the client bundle
# NEXT_PUBLIC_* vars must be available at build time
# Server-side vars (BACKEND_URL, auth secrets) are provided at runtime
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN pnpm build

# ============================================================
# Stage 3: Run
# ============================================================
FROM node:22-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy the standalone build output
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

USER appuser

EXPOSE 3000

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

**Key decisions:**
- Node 22 (current LTS as of early 2026). AI agent should verify at build time.
- Standalone output mode — requires `output: 'standalone'` in `next.config.ts`. This creates a self-contained `server.js` that doesn't need `node_modules` at runtime.
- `NEXT_PUBLIC_*` vars are build-time — they get baked into the JS bundle. Server-side vars (`BACKEND_URL`, `AUTH_SECRET`, Keycloak secrets) are injected at runtime via `docker run -e`.

**Required `next.config.ts` setting:**
```typescript
const nextConfig = {
  output: 'standalone',
  // ... other config
}
```

AI agent: ensure `output: 'standalone'` is set in the Next.js config. Without it, the Dockerfile's Stage 3 will fail because `.next/standalone` won't exist.

---

## 3. GitHub Actions Workflows

### 3.1 Design Principles

- **Path-based triggers:** Each workflow only runs when files in its directory change. Changing a file in `claims-api/` doesn't trigger the `claims-web` build.
- **Manual trigger:** Both workflows support `workflow_dispatch` for on-demand builds.
- **Shared secrets:** Keycloak and Supabase credentials are stored as GitHub repository secrets and injected at build/deploy time.
- **Tag strategy:** Images are tagged with both `latest` and the short Git SHA for traceability.

### 3.2 Claims API Workflow — `.github/workflows/claims-api.yml`

```yaml
name: Build & Deploy Claims API

on:
  push:
    branches: [main]
    paths:
      - 'claims-api/**'
      - '.github/workflows/claims-api.yml'
  workflow_dispatch:
    inputs:
      deploy:
        description: 'Deploy to Oracle VM after build?'
        required: false
        default: 'true'
        type: choice
        options:
          - 'true'
          - 'false'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository_owner }}/ciam-claims-api

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'

      - name: Cache Gradle packages
        uses: actions/cache@v4
        with:
          path: |
            ~/.gradle/caches
            ~/.gradle/wrapper
          key: ${{ runner.os }}-gradle-${{ hashFiles('claims-api/**/*.gradle.kts') }}
          restore-keys: ${{ runner.os }}-gradle-

      - name: Run tests
        working-directory: claims-api
        run: ./gradlew test --no-daemon
        env:
          # Tests use an in-memory H2 or mocked DB — no real Supabase needed
          SPRING_PROFILES_ACTIVE: test

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=latest
            type=sha,prefix=,format=short

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: ./claims-api
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: ${{ github.event_name == 'push' || github.event.inputs.deploy == 'true' }}

    steps:
      - name: Deploy to Oracle VM
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.ORACLE_VM_HOST }}
          username: ${{ secrets.ORACLE_VM_USER }}
          key: ${{ secrets.ORACLE_VM_SSH_KEY }}
          script: |
            # Pull the latest image
            docker pull ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest

            # Stop and remove the old container (if running)
            docker stop ciam-claims-api || true
            docker rm ciam-claims-api || true

            # Run the new container
            docker run -d \
              --name ciam-claims-api \
              --restart unless-stopped \
              -p 8080:8080 \
              -e KEYCLOAK_ISSUER_URI="${{ secrets.KEYCLOAK_ISSUER_URI }}" \
              -e KEYCLOAK_CLIENT_ID="${{ secrets.KEYCLOAK_BACKEND_CLIENT_ID }}" \
              -e KEYCLOAK_CLIENT_SECRET="${{ secrets.KEYCLOAK_BACKEND_CLIENT_SECRET }}" \
              -e SUPABASE_JDBC_URL="${{ secrets.SUPABASE_JDBC_URL }}" \
              -e SUPABASE_DB_USER="${{ secrets.SUPABASE_DB_USER }}" \
              -e SUPABASE_DB_PASSWORD="${{ secrets.SUPABASE_DB_PASSWORD }}" \
              -e ALLOWED_ORIGINS="${{ secrets.ALLOWED_ORIGINS }}" \
              -e SPRING_PROFILES_ACTIVE=prod \
              ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest

            # Verify it started
            sleep 10
            docker logs ciam-claims-api --tail 20
            curl -sf http://localhost:8080/api/health || echo "Health check failed — check logs"

```

### 3.3 Claims Web Workflow — `.github/workflows/claims-web.yml`

```yaml
name: Build & Deploy Claims Web

on:
  push:
    branches: [main]
    paths:
      - 'claims-web/**'
      - '.github/workflows/claims-web.yml'
  workflow_dispatch:
    inputs:
      deploy:
        description: 'Deploy to Oracle VM after build?'
        required: false
        default: 'true'
        type: choice
        options:
          - 'true'
          - 'false'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository_owner }}/ciam-claims-web

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: latest

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
          cache-dependency-path: claims-web/pnpm-lock.yaml

      - name: Install dependencies
        working-directory: claims-web
        run: pnpm install --frozen-lockfile

      - name: Run tests
        working-directory: claims-web
        run: pnpm test
        env:
          # Mock values for build/test — not real secrets
          AUTH_SECRET: test-secret-not-real
          KEYCLOAK_ISSUER_URI: https://test.example.com/realms/test
          KEYCLOAK_CLIENT_ID: test-client
          KEYCLOAK_CLIENT_SECRET: test-secret

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=latest
            type=sha,prefix=,format=short

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: ./claims-web
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          build-args: |
            NEXT_PUBLIC_APP_URL=${{ secrets.NEXT_PUBLIC_APP_URL }}

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: ${{ github.event_name == 'push' || github.event.inputs.deploy == 'true' }}

    steps:
      - name: Deploy to Oracle VM
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.ORACLE_VM_HOST }}
          username: ${{ secrets.ORACLE_VM_USER }}
          key: ${{ secrets.ORACLE_VM_SSH_KEY }}
          script: |
            # Pull the latest image
            docker pull ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest

            # Stop and remove the old container (if running)
            docker stop ciam-claims-web || true
            docker rm ciam-claims-web || true

            # Run the new container
            docker run -d \
              --name ciam-claims-web \
              --restart unless-stopped \
              -p 3000:3000 \
              -e AUTH_SECRET="${{ secrets.AUTH_SECRET }}" \
              -e KEYCLOAK_ISSUER_URI="${{ secrets.KEYCLOAK_ISSUER_URI }}" \
              -e KEYCLOAK_CLIENT_ID="${{ secrets.KEYCLOAK_BFF_CLIENT_ID }}" \
              -e KEYCLOAK_CLIENT_SECRET="${{ secrets.KEYCLOAK_BFF_CLIENT_SECRET }}" \
              -e BACKEND_URL="${{ secrets.BACKEND_URL }}" \
              -e NEXT_PUBLIC_APP_URL="${{ secrets.NEXT_PUBLIC_APP_URL }}" \
              ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest

            # Verify it started
            sleep 10
            docker logs ciam-claims-web --tail 20
            curl -sf http://localhost:3000 || echo "Health check failed — check logs"

```

---

## 4. GitHub Repository Secrets

Set these in your GitHub repo under **Settings → Secrets and variables → Actions → Repository secrets**:

| Secret | Purpose | Example Value |
|--------|---------|---------------|
| `ORACLE_VM_HOST` | SSH host for deployment | `129.xxx.xxx.xxx` |
| `ORACLE_VM_USER` | SSH username | `opc` or `ubuntu` |
| `ORACLE_VM_SSH_KEY` | SSH private key (entire PEM content) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `KEYCLOAK_ISSUER_URI` | OIDC issuer URL | `https://xyz.phasetwo.io/realms/my-realm` |
| `KEYCLOAK_BACKEND_CLIENT_ID` | Spring Boot client ID | `poc-backend` |
| `KEYCLOAK_BACKEND_CLIENT_SECRET` | Spring Boot client secret | `(from Keycloak)` |
| `KEYCLOAK_BFF_CLIENT_ID` | Next.js BFF client ID | `poc-bff` |
| `KEYCLOAK_BFF_CLIENT_SECRET` | Next.js BFF client secret | `(from Keycloak)` |
| `SUPABASE_JDBC_URL` | Postgres connection string | `jdbc:postgresql://db.xxx.supabase.co:5432/postgres` |
| `SUPABASE_DB_USER` | Postgres username | `postgres` |
| `SUPABASE_DB_PASSWORD` | Postgres password | `(your password)` |
| `AUTH_SECRET` | Auth.js session encryption key | `(random 32-char string)` |
| `BACKEND_URL` | Spring Boot URL from Next.js perspective | `http://129.xxx.xxx.xxx:8080` |
| `NEXT_PUBLIC_APP_URL` | Next.js public URL | `http://129.xxx.xxx.xxx:3000` |
| `ALLOWED_ORIGINS` | CORS origins for Spring Boot | `http://129.xxx.xxx.xxx:3000` |

> **Note on BACKEND_URL:** In production on the Oracle VM, if both containers run on the same host, you can use `http://host.docker.internal:8080` or the VM's internal IP. The simplest option is the VM's public IP since there's no reverse proxy.

---

## 5. Oracle VM Setup (One-Time)

Run these once on your Oracle VM to prepare for deployments:

```bash
# 1. Authenticate Docker with ghcr.io
#    Create a GitHub Personal Access Token (PAT) with read:packages scope
#    Settings → Developer settings → Personal access tokens → Tokens (classic)
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# 2. Verify authentication
docker pull ghcr.io/YOUR_USERNAME/ciam-claims-api:latest
# (This will fail if the image doesn't exist yet — that's fine, just verify no auth errors)

# 3. Open firewall ports (if not already)
# Oracle Cloud uses iptables AND security lists
# Check your VCN security list in the Oracle Cloud console — ports 8080 and 3000 must be open

# On the VM itself (Oracle Linux / Ubuntu):
sudo iptables -I INPUT -p tcp --dport 8080 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 3000 -j ACCEPT

# Make iptables rules persistent (Oracle Linux)
sudo iptables-save | sudo tee /etc/iptables/rules.v4

# 4. (Optional) Create a deploy script for manual deploys
cat > ~/deploy-claims.sh << 'EOF'
#!/bin/bash
set -e

REGISTRY="ghcr.io"
OWNER="YOUR_GITHUB_USERNAME"

echo "Pulling latest images..."
docker pull $REGISTRY/$OWNER/ciam-claims-api:latest
docker pull $REGISTRY/$OWNER/ciam-claims-web:latest

echo "Restarting claims-api..."
docker stop ciam-claims-api 2>/dev/null || true
docker rm ciam-claims-api 2>/dev/null || true
docker run -d \
  --name ciam-claims-api \
  --restart unless-stopped \
  --env-file ~/claims-api.env \
  -p 8080:8080 \
  $REGISTRY/$OWNER/ciam-claims-api:latest

echo "Restarting claims-web..."
docker stop ciam-claims-web 2>/dev/null || true
docker rm ciam-claims-web 2>/dev/null || true
docker run -d \
  --name ciam-claims-web \
  --restart unless-stopped \
  --env-file ~/claims-web.env \
  -p 3000:3000 \
  $REGISTRY/$OWNER/ciam-claims-web:latest

echo "Waiting for services to start..."
sleep 15

echo "Claims API health:"
curl -sf http://localhost:8080/api/health && echo " ✓" || echo " ✗ FAILED"

echo "Claims Web:"
curl -sf http://localhost:3000 > /dev/null && echo " ✓" || echo " ✗ FAILED"

echo "Done."
EOF
chmod +x ~/deploy-claims.sh
```

**Environment files on the VM (alternative to GitHub secrets in docker run):**

If you prefer to keep secrets on the VM rather than passing them through GitHub Actions, create env files:

```bash
# ~/claims-api.env
KEYCLOAK_ISSUER_URI=https://xyz.phasetwo.io/realms/my-realm
KEYCLOAK_CLIENT_ID=poc-backend
KEYCLOAK_CLIENT_SECRET=xxx
SUPABASE_JDBC_URL=jdbc:postgresql://db.xxx.supabase.co:5432/postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=xxx
ALLOWED_ORIGINS=http://YOUR_VM_IP:3000
SPRING_PROFILES_ACTIVE=prod
```

```bash
# ~/claims-web.env
AUTH_SECRET=xxx
KEYCLOAK_ISSUER_URI=https://xyz.phasetwo.io/realms/my-realm
KEYCLOAK_CLIENT_ID=poc-bff
KEYCLOAK_CLIENT_SECRET=xxx
BACKEND_URL=http://YOUR_VM_IP:8080
NEXT_PUBLIC_APP_URL=http://YOUR_VM_IP:3000
NODE_ENV=production
```

---

## 6. Keycloak Redirect URIs for Production

When deploying to the Oracle VM, you need to update the Keycloak client redirect URIs to include the production URLs. Add these alongside the localhost URIs (keep both for local dev):

**For `poc-bff` client:**
- Add redirect URI: `http://YOUR_VM_IP:3000/api/auth/callback/keycloak`
- Add web origin: `http://YOUR_VM_IP:3000`
- Add post-logout redirect: `http://YOUR_VM_IP:3000/*`

**For `poc-backend` client:**
- No redirect URIs needed (client credentials only)
- But if you're using it for anything with redirects, add the VM URL

You can update these via the Keycloak Admin API or through the Phase Two admin console.

```bash
# Example: Update poc-bff redirect URIs via API
# (Get client UUID first, then PUT updated config)
# See ciam-specification.md §1.3.5 for the full client configuration
```

> **Important:** If you later add a domain name or SSL, update these URIs again. Keycloak strictly validates redirect URIs as a security measure.

---

## 7. Monitoring & Troubleshooting

### Check running containers
```bash
docker ps
# Should show ciam-claims-api and ciam-claims-web

docker logs ciam-claims-api --tail 50 -f
docker logs ciam-claims-web --tail 50 -f
```

### Common issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Spring Boot fails to start | Supabase connection refused | Check JDBC URL, ensure port 5432 (not 6543). Check Supabase project is active. |
| 401 on all API calls | Keycloak issuer URI mismatch | Token `iss` must exactly match `KEYCLOAK_ISSUER_URI` configured in Spring Boot. No trailing slashes. |
| Auth.js redirect fails | Redirect URI not registered in Keycloak | Add the production URL to the poc-bff client's redirect URIs in Keycloak. |
| CORS errors in browser | Spring Boot missing CORS config | Ensure `ALLOWED_ORIGINS` includes the Next.js URL. Check the CORS config in SecurityFilterChain. |
| Next.js can't reach Spring Boot | Wrong BACKEND_URL | If both on same VM, use the VM's IP or `host.docker.internal`. Not `localhost` (that's the container's localhost). |
| Images won't pull | ghcr.io auth expired | Re-run `docker login ghcr.io` on the VM. |

### Health check endpoints
```bash
# Spring Boot
curl http://YOUR_VM_IP:8080/api/health

# Next.js (just check it responds)
curl http://YOUR_VM_IP:3000
```

---

## 8. Future Improvements (Not Now)

Things to add when you're past the PoC stage:

- **Reverse proxy (Traefik/Caddy)** — SSL termination, domain routing, automatic HTTPS
- **Docker Compose on the VM** — manage both containers as a stack instead of individual `docker run` commands
- **Blue-green deployment** — run new container, health check, swap, remove old
- **Image vulnerability scanning** — add Trivy or Grype to the GitHub Actions pipeline
- **Database backups** — Supabase handles this, but verify the schedule in their dashboard
- **Log aggregation** — ship Docker logs to a central service
- **Resource limits** — add `--memory` and `--cpus` flags to `docker run`

---

*This deployment guide is a companion to the kickoff guide and the three specification documents in `ai-docs/`. Get the app working locally first (kickoff guide), then use this to ship it.*
