#!/usr/bin/env bash
# 06-create-organizations.sh — Create test organizations: acme-corp and globex-inc

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-helpers.sh"

load_env
require_commands curl jq

log_step "Creating organizations"

get_admin_token

# ── acme-corp ────────────────────────────────────────────────────────────────
ACME_ID=$(get_org_id "acme-corp")
if [[ -n "$ACME_ID" ]]; then
  log_warn "Organization 'acme-corp' already exists (ID: $ACME_ID) — skipping"
else
  log_info "Creating organization 'acme-corp'..."
  status=$(kc_post "/admin/realms/${KEYCLOAK_REALM}/orgs" '{
    "name": "acme-corp",
    "displayName": "Acme Corporation",
    "domains": ["acme-corp.com"],
    "attributes": {
      "accountNumber": ["ACC-001"],
      "industry": ["manufacturing"],
      "contractTier": ["enterprise"]
    }
  }')
  if [[ "$status" == "201" ]]; then
    ACME_ID=$(get_org_id "acme-corp")
    log_ok "Organization 'acme-corp' created (ID: $ACME_ID)"
  else
    log_error "Failed to create 'acme-corp' (HTTP $status)"
    exit 1
  fi
fi

# ── globex-inc ───────────────────────────────────────────────────────────────
GLOBEX_ID=$(get_org_id "globex-inc")
if [[ -n "$GLOBEX_ID" ]]; then
  log_warn "Organization 'globex-inc' already exists (ID: $GLOBEX_ID) — skipping"
else
  log_info "Creating organization 'globex-inc'..."
  status=$(kc_post "/admin/realms/${KEYCLOAK_REALM}/orgs" '{
    "name": "globex-inc",
    "displayName": "Globex Inc.",
    "domains": ["globex.com"],
    "attributes": {
      "accountNumber": ["ACC-003"],
      "industry": ["technology"],
      "contractTier": ["standard"]
    }
  }')
  if [[ "$status" == "201" ]]; then
    GLOBEX_ID=$(get_org_id "globex-inc")
    log_ok "Organization 'globex-inc' created (ID: $GLOBEX_ID)"
  else
    log_error "Failed to create 'globex-inc' (HTTP $status)"
    exit 1
  fi
fi

# ── Verify ───────────────────────────────────────────────────────────────────
get_admin_token
log_info "Verifying organizations..."
orgs=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/orgs")
org_count=$(echo "$orgs" | jq 'length')
log_ok "Total organizations in realm: $org_count"
echo "$orgs" | jq -r '.[] | "  \(.name) — \(.displayName // "no display name")"'

log_ok "Organization creation complete"
