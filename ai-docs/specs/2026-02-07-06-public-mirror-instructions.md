---
title: "Public Mirror: Build in Public, Think in Private"
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

# Public Mirror: Build in Public, Think in Private

## Why We're Doing This

We have a private monorepo where all development happens. This repo contains two categories of work:

1. **Code worth showing off** — MCP servers, Azure Functions, Edge Delivery Services integrations, automation scripts, GitHub Actions, infrastructure configs. This is the "build in public" portfolio that demonstrates real engineering.

2. **AI documentation** — prompts, agent configurations, CLAUDE.md, skill files, internal playbooks. This is the secret sauce. It's not that the code AI generates is impressive — what's valuable is the *thinking* behind how we orchestrate AI, the prompt engineering, the architectural decisions for multi-agent workflows. This stays private.

We want to work in ONE repo (no context switching, agents see everything, unified workspace) but publish a filtered view to a public GitHub repo that shows only the code. The public repo should have real git history — individual commits with original messages and timestamps — not periodic dump commits.

---

## The Private/Public Split

| Aspect | Private Repo (`project-private`) | Public Repo (`project`) |
|---|---|---|
| **Where you work** | ✅ Daily driver, all local dev | ❌ Never open directly |
| **CLAUDE.md** | ✅ Full version with private references | ❌ Excluded entirely |
| **ai-docs/** | ✅ Prompts, strategies, agent configs | ❌ Never exists here |
| **Source code** | ✅ Authored here | ✅ Mirrored via script |
| **GitHub Actions / CI** | ❌ No workflows here | ✅ All CI/CD lives here (free minutes) |
| **Tags / Releases** | ✅ Created here during dev | ✅ Mirrored by script, triggers builds |
| **Issues / PRs** | ❌ None | ✅ Community contributes here |
| **Stars / visibility** | Private, nobody sees | ✅ Portfolio, the "real" project |
| **Git history** | Full history including ai-docs commits | Filtered history, code commits only |
| **Contributors** | Just you | ✅ Open to community |
| **Cost** | No Actions usage | ✅ Free unlimited Actions minutes |

### What stays private (EXCLUDE_PATHS)

- `ai-docs/` (or however the AI documentation directory is named — research first)
- `CLAUDE.md` and any `.claude/` project config
- `mirror-to-public.sh` (the mirror script itself)
- `.mirror-state`
- Any `*.secret.md`, `*.private.*` files
- `scripts/internal/` or similar private tooling paths

### What gets mirrored

Everything else — source code, package configs, README, LICENSE, `.github/workflows/` (Actions live on public), tests, documentation that isn't AI-specific.

---

## Naming Convention (Repeatable Pattern)

Every project that follows this pattern uses the same naming:

| Repo | Name | Visibility | Example |
|---|---|---|---|
| **Public** (the portfolio) | The clean, real project name | Public | `demo`, `mcp-da-live`, `edge-delivery-tools` |
| **Private** (the workspace) | Same name with `-private` suffix | Private | `demo-private`, `mcp-da-live-private`, `edge-delivery-tools-private` |

**The public repo owns the good name.** It's what shows up on your GitHub profile, what people star, what gets linked on your resume. The private repo is your workspace — nobody sees the name, so it gets the suffix.

**Local folder convention:**

```
~/code/
├── demo/                  ← public repo clone (rarely touched directly)
├── demo-private/          ← private repo clone (where you actually work)
├── mcp-da-live/           ← public
├── mcp-da-live-private/   ← private (your workspace)
└── ...
```

The mirror script default: if you're in `project-private/`, the public repo is `../project/` (strip the `-private` suffix).

---

## Architecture: Three Phases

### Phase 1: Backlog Migration (one-time)

Replay the private repo's entire existing commit history to a new public repo, stripping out all private paths. Every commit that touched code gets recreated with the **exact same message, author, and timestamp**. Commits that only touched ai-docs are skipped. Tags pointing to mirrored commits are recreated.

### Phase 2: Ongoing Mirroring (repeatable)

A script that incrementally replays new commits and tags since the last sync. Run manually (or by an agent) whenever a batch of work feels ready to publish. Same filtering — ai-docs-only commits are skipped, code commits are replayed with preserved metadata, tags are mirrored and trigger public CI/CD.

### Phase 3: GitHub Actions Migration (future, NOT now)

Move CI/CD workflows from private to public. Delete from private so they don't run twice. Take advantage of free Actions minutes. **Not part of this implementation** — but the mirror script should already be syncing `.github/workflows/` so the files are present on public. Phase 3 is just about activating them there and deactivating on private.

### Two-Way Flow: Handling Public PRs

Most commits flow **private → public** via the mirror. But community PRs get merged directly on public, creating commits that only exist there. These need to flow **public → private** so the repos don't diverge.

**The flow:**
1. Contributor opens PR on public repo
2. You review and merge on public (normal GitHub flow)
3. Before your next mirror run, pull public changes into private:
   ```bash
   cd ~/code/project-private
   git remote add public git@github.com:OWNER/project.git  # one-time
   git fetch public
   git merge public/main --no-edit  # or cherry-pick specific commits
   ```
4. Now the mirror script sees private is ahead of the `.mirror-state` and syncs normally

The mirror script should detect when public is ahead of `.mirror-state` and warn (not clobber). It should print something like: "Public repo has 3 commits not in private. Pull them into private first."

### Commit flow examples

| Scenario | Result |
|---|---|
| Code commit on private | ✅ Mirrored to public, same message + timestamp |
| ai-docs-only commit on private | ⊘ Skipped, public stays quiet |
| Code + ai-docs in same commit on private | ✅ Mirrored with code changes only, same message |
| Tag `v1.2.0` on private pointing to mirrored commit | ✅ Tag mirrored to public, triggers CI/CD build |
| Tag on private pointing to ai-docs-only commit | ⊘ Skipped (no corresponding public commit) |
| Community PR merged on public | ⬅️ Pull into private before next mirror |
| 5 commits pushed at once | ✅ All 5 replayed individually in order |

---

## How to Implement This

### Step 0: Research (REQUIRED — do this BEFORE writing any code)

Before writing any code or making any changes, you MUST do the following research. Do not skip this. Do not assume you know the repo structure.

**Inspect the repository structure:**
- Run `find . -maxdepth 3 -type d | head -60` to understand the directory layout
- Run `ls -la` at the root to see all files including hidden ones
- Identify which directories contain private AI documentation. Look for folders named `ai-docs`, `ai-documentation`, `docs/internal`, `prompts`, `agent-configs`, `skills`, `strategies`, or similar. There WILL be such a folder — find it.
- Check for `CLAUDE.md`, `.claude/` directory, agent instruction files
- Check for `*.secret.md`, `*.private.*`, `.env` files, credentials
- Look at `.gitignore` to understand what's already excluded

**Inspect git history:**
- `git log --oneline -20` — recent commit patterns
- `git log --oneline | wc -l` — total backlog size
- `git remote -v` — existing remotes
- `git branch -a` — branch structure
- `git tag -l` — existing tags (these need mirroring too)
- Once you've identified the private docs path: `git log --oneline --all -- "PRIVATE_PATH/"` to count docs-only commits
- `git log --format='%an' | sort -u` — commit authors

**Research tooling:**
- Check for `git-filter-repo`: `which git-filter-repo` or `git filter-repo --version`
- `git --version` — some features vary
- `cat .gitmodules 2>/dev/null` — submodules need special handling
- `du -sh .git` — repo size affects strategy
- `git log --show-signature -1` — signed commits won't survive replay
- `which rsync` — confirm availability

**Evaluate Phase 1 approach:**

| Approach | Best for | Trade-offs |
|---|---|---|
| `git filter-repo --invert-paths` | Clean rewrite, preserves merge structure, fast | Requires installation, one-time only |
| Commit-by-commit replay | Maximum flexibility, handles mixed commits | Slower, linearizes history |

Use `git filter-repo` for Phase 1 if available. Fall back to replay loop if not. Always use replay loop for Phase 2 (incremental).

**Present findings before proceeding:**
Summarize directory structure, private paths identified, total commit count, tag count, docs-only commit count, recommended approach. Get confirmation before executing Phase 1.

---

### Step 1: Prepare the Repos (Naming and Migration)

If the project already exists under the clean name, it needs to be renamed to make room for the public repo.

#### Migrating an existing repo to the `-private` naming

**Recommended approach: Rename on GitHub + rename locally**

```bash
# 1. Rename on GitHub
#    github.com/OWNER/demo → Settings → General → Repository name
#    Rename: demo → demo-private

# 2. Update local remote
cd ~/code/demo
git remote set-url origin git@github.com:OWNER/demo-private.git

# 3. Rename local folder
cd ~/code
mv demo demo-private

# 4. Create new public repo on GitHub
#    github.com → New Repository → name: "demo" → Public → completely empty

# 5. Clone it locally
git clone git@github.com:OWNER/demo.git
```

**Before renaming, check for:**
```
□ Deploy keys, webhooks, integrations
    → github.com/OWNER/REPO → Settings → Deploy keys / Webhooks
□ GitHub Actions that hardcode the repo name
    → grep -r "OWNER/demo" .github/workflows/
□ Other repos or services referencing this repo by URL
□ GitHub Pages configuration
□ Star/fork counts (they follow the rename, not lost)
□ Collaborators with local clones (they need to update remotes)
```

**Alternative if renaming is too disruptive:** Keep private as-is, create public with a different name (e.g., `demo-public`). Less clean but zero disruption. The rename can always happen later.

**Never use:** GitHub fork (shares git network, may expose private commits) or delete-and-recreate (destroys stars, issues, PRs, Actions history, everything).

---

### Step 2: Execute Phase 1 — Backlog Migration

#### Option A: git filter-repo (preferred)

```bash
# Work on a fresh clone — never rewrite your working copy
git clone ~/code/demo-private /tmp/mirror-workbench
cd /tmp/mirror-workbench

# Remove private paths from entire history
# ⚠️ Adjust paths based on Step 0 research
git filter-repo \
  --invert-paths \
  --path ai-docs/ \
  --path CLAUDE.md \
  --path .claude/ \
  --path mirror-to-public.sh \
  --force

# Push to public
git remote add public git@github.com:OWNER/demo.git
git push public main --force
git push public --tags   # mirror all tags

# Initialize mirror state
cd ~/code/demo
git pull origin main
echo "$(cd ~/code/demo-private && git rev-parse HEAD)" > .mirror-state
git add .mirror-state && git commit -m "chore: initialize mirror state"
git push origin main

# Clean up
rm -rf /tmp/mirror-workbench
```

#### Option B: Replay loop (fallback)

Create the mirror script from Step 3 first, then:
```bash
cd ~/code/demo-private
./mirror-to-public.sh --init --dry-run   # preview
./mirror-to-public.sh --init             # execute
cd ~/code/demo && git push origin main --tags
```

---

### Step 3: Create the Mirror Script (Phase 2)

Create `mirror-to-public.sh` in the private repo root.

**Arguments:**
- `--init` — replay entire history (Phase 1 fallback or full re-sync)
- `--dry-run` — preview without changes
- `--since <SHA>` — replay from specific commit
- `--last <N>` — replay last N commits only
- No arguments — incremental from `.mirror-state`

**Configuration at top of script:**
- `PRIVATE_REPO` — default `$(pwd)`
- `PUBLIC_REPO` — default: derive from private path by stripping `-private` suffix (e.g., `../demo` if in `../demo-private`)
- `BRANCH` — default `main`
- `EXCLUDE_PATHS` — from Step 0 research. Always include: ai-docs dir, `CLAUDE.md`, `.claude/`, the mirror script, `.mirror-state`, any `*.secret.md` / `*.private.*`
- Environment variable overrides: `MIRROR_PRIVATE_REPO`, `MIRROR_PUBLIC_REPO`

**Core logic — commit replay:**

```bash
# For each commit since .mirror-state:

# 1. Check changed files
git diff-tree --no-commit-id --name-only -r $COMMIT

# 2. If ALL changes are in EXCLUDE_PATHS → skip

# 3. Extract metadata
AUTHOR_NAME=$(git log -1 --format='%an' $COMMIT)
AUTHOR_EMAIL=$(git log -1 --format='%ae' $COMMIT)
AUTHOR_DATE=$(git log -1 --format='%aI' $COMMIT)
COMMIT_MSG=$(git log -1 --format='%B' $COMMIT)

# 4. Checkout at this commit
git checkout $COMMIT --quiet

# 5. rsync excluding private paths
rsync -a --delete \
  --exclude=.git \
  --exclude=ai-docs/ \
  --exclude=CLAUDE.md \
  --exclude=.claude/ \
  --exclude=mirror-to-public.sh \
  "$PRIVATE_REPO/" "$PUBLIC_REPO/"

# 6. Commit preserving metadata
cd "$PUBLIC_REPO"
echo "$COMMIT" > .mirror-state
git add -A
# git diff --cached --quiet && continue  (skip if no changes)

GIT_AUTHOR_NAME="$AUTHOR_NAME" \
GIT_AUTHOR_EMAIL="$AUTHOR_EMAIL" \
GIT_AUTHOR_DATE="$AUTHOR_DATE" \
GIT_COMMITTER_NAME="$AUTHOR_NAME" \
GIT_COMMITTER_EMAIL="$AUTHOR_EMAIL" \
GIT_COMMITTER_DATE="$AUTHOR_DATE" \
git commit -m "$COMMIT_MSG"
```

**Core logic — tag mirroring (runs after commit replay):**

```bash
# Get all tags on private
for TAG in $(git tag -l); do
  TAG_COMMIT=$(git rev-list -n 1 "$TAG")
  
  # Check if this tag's commit was mirrored (exists in .mirror-state history)
  # The tag should point to the CORRESPONDING public commit, not the private SHA
  
  # Strategy: find the public commit that was created from this private commit
  # by searching .mirror-state values in public repo's history
  
  # If found and tag doesn't exist on public yet:
  cd "$PUBLIC_REPO"
  if ! git tag -l "$TAG" | grep -q "$TAG"; then
    # Get tag metadata
    TAG_DATE=$(cd "$PRIVATE_REPO" && git log -1 --format='%aI' "$TAG_COMMIT")
    TAG_MSG=$(cd "$PRIVATE_REPO" && git tag -n1 "$TAG" | sed "s/^$TAG\s*//")
    
    # Create tag on public at the corresponding commit
    GIT_COMMITTER_DATE="$TAG_DATE" \
    git tag -a "$TAG" -m "${TAG_MSG:-$TAG}" PUBLIC_COMMIT_SHA
  fi
  cd "$PRIVATE_REPO"
done
```

**Safety check — detect public-ahead state:**

Before starting the replay, the script should check if the public repo has commits that aren't in private (from merged community PRs):

```bash
cd "$PUBLIC_REPO"
LAST_MIRROR_STATE=$(cat .mirror-state 2>/dev/null || echo "")
PUBLIC_HEAD=$(git rev-parse HEAD)
PUBLIC_MIRROR_COMMIT=$(git log --all --format='%H' .mirror-state | head -1)

# If public HEAD is ahead of the last mirror commit, warn
if [ "$(git rev-list --count ${PUBLIC_MIRROR_COMMIT}..HEAD)" -gt 0 ]; then
  echo "⚠️  Public repo has commits not in private (likely merged PRs)."
  echo "   Pull them into private first:"
  echo "   cd $PRIVATE_REPO && git fetch public && git merge public/main"
  exit 1
fi
```

**Implementation requirements:**
- `set -euo pipefail`
- After replay loop: `git checkout $BRANCH --quiet` to return to HEAD
- Colored progress: `[14/87] ✓ abc1234 - fix auth header`
- Distinct indicators: ✓ synced, ⊘ skipped, ✗ error
- Does NOT push — prints reminder with exact command including `--tags`
- After all commits and tags: print summary with counts

**Commit the script to the private repo.** Add it to EXCLUDE_PATHS so it doesn't appear on public.

---

### Step 4: Verify

```bash
# Compare commit counts
echo "Private: $(cd ~/code/demo-private && git rev-list --count main)"
echo "Public:  $(cd ~/code/demo && git rev-list --count main)"

# Spot-check timestamps
cd ~/code/demo-private && git log --format='%aI %s' -5
cd ~/code/demo && git log --format='%aI %s' -5

# Verify no private paths leaked
cd ~/code/demo && find . -path '*/ai-docs*' -o -name 'CLAUDE.md' -o -name '.claude'
# Should return nothing

# Verify tags match
cd ~/code/demo-private && git tag -l | sort
cd ~/code/demo && git tag -l | sort

# Verify .mirror-state
cat ~/code/demo/.mirror-state
```

---

### Ongoing Workflow

```bash
# Normal development: work in private, commit as usual
cd ~/code/demo-private
# ... code, commit, code, commit ...

# When ready to publish:
./mirror-to-public.sh                               # replay commits + tags
cd ~/code/demo && git push origin main --tags        # publish (tags trigger CI)

# Or one-liner for agent execution:
./mirror-to-public.sh && cd ../demo && git push origin main --tags

# Preview first:
./mirror-to-public.sh --dry-run

# If a community PR was merged on public, pull it in first:
cd ~/code/demo-private
git fetch public && git merge public/main --no-edit
# Then mirror as normal
```

---

## Phase 3 Notes (Future — GitHub Actions Migration)

Not implementing now. The plan:

1. **Workflows already exist on public** (mirrored from private). Phase 3 activates them.
2. **Delete workflows from private** so they don't run twice.
3. **Update EXCLUDE_PATHS** — add `.github/workflows/` so the mirror stops overwriting them.
4. **Move secrets** to public repo settings.
5. **Consider a mirror-trigger workflow** — `workflow_dispatch` on public that clones private via deploy key, runs the mirror, pushes. Fully automated on free minutes.

---

## Gotchas and Edge Cases

1. **Commit messages referencing private paths** — preserved as-is. Mentioning a filename doesn't leak contents. Acceptable.
2. **Force push / rebase on private** — delete `.mirror-state` from public, re-run `--init`.
3. **Binary files** — rsync handles fine. Consider Git LFS separately if needed.
4. **Merge commits** — replay linearizes history. `git filter-repo` preserves merges. Linear is cleaner for portfolio.
5. **Signed commits** — GPG signatures won't survive. Public commits are unsigned.
6. **Branch strategy** — mirrors `main` only. Feature branches need script extension if desired.
7. **CLAUDE.md** — excluded entirely from public. Contributors using Claude Code on forks get default behavior.
8. **Community PRs diverging repos** — always pull public into private before mirroring. Script warns if public is ahead.
9. **Tags on docs-only commits** — skipped since there's no corresponding public commit. Avoid tagging docs-only commits.
10. **GitHub rename redirects** — when you rename `demo` → `demo-private`, the redirect breaks once you create the new `demo`. This is fine — old private links should be inaccessible anyway.
