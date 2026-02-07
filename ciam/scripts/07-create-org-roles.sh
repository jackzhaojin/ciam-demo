#!/usr/bin/env bash
# 07-create-org-roles.sh — Create admin, billing, viewer roles in each organization

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-helpers.sh"

load_env
require_commands curl jq

log_step "Creating organization roles"

get_admin_token

# ── Get org IDs ──────────────────────────────────────────────────────────────
ACME_ID=$(get_org_id "acme-corp")
GLOBEX_ID=$(get_org_id "globex-inc")

if [[ -z "$ACME_ID" ]]; then
  log_error "Organization 'acme-corp' not found. Run 06-create-organizations.sh first."
  exit 1
fi
if [[ -z "$GLOBEX_ID" ]]; then
  log_error "Organization 'globex-inc' not found. Run 06-create-organizations.sh first."
  exit 1
fi

log_info "acme-corp  ID: $ACME_ID"
log_info "globex-inc ID: $GLOBEX_ID"

# ── Helper: create role in an org (idempotent) ───────────────────────────────
create_org_role() {
  local org_id="$1"
  local org_name="$2"
  local role_name="$3"
  local role_desc="$4"

  get_admin_token

  if org_role_exists "$org_id" "$role_name"; then
    log_warn "  Role '$role_name' already exists in $org_name — skipping"
    return 0
  fi

  local status
  status=$(kc_post "/admin/realms/${KEYCLOAK_REALM}/orgs/${org_id}/roles" \
    "{\"name\": \"${role_name}\", \"description\": \"${role_desc}\"}")

  if [[ "$status" == "201" ]]; then
    log_ok "  Role '$role_name' created in $org_name"
  else
    log_error "  Failed to create role '$role_name' in $org_name (HTTP $status)"
    return 1
  fi
}

# ── Create roles in acme-corp ────────────────────────────────────────────────
log_info "Creating roles in acme-corp..."
create_org_role "$ACME_ID" "acme-corp" "admin"   "Full account administration"
create_org_role "$ACME_ID" "acme-corp" "billing" "Billing and invoice access"
create_org_role "$ACME_ID" "acme-corp" "viewer"  "Read-only access"

# ── Create roles in globex-inc ───────────────────────────────────────────────
log_info "Creating roles in globex-inc..."
create_org_role "$GLOBEX_ID" "globex-inc" "admin"   "Full account administration"
create_org_role "$GLOBEX_ID" "globex-inc" "billing" "Billing and invoice access"
create_org_role "$GLOBEX_ID" "globex-inc" "viewer"  "Read-only access"

# ── Verify ───────────────────────────────────────────────────────────────────
get_admin_token
log_info "Verifying roles..."

acme_roles=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/orgs/${ACME_ID}/roles")
log_ok "acme-corp roles:"
echo "$acme_roles" | jq -r '.[] | "  \(.name) — \(.description // "")"'

globex_roles=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/orgs/${GLOBEX_ID}/roles")
log_ok "globex-inc roles:"
echo "$globex_roles" | jq -r '.[] | "  \(.name) — \(.description // "")"'

log_ok "Organization role creation complete"
