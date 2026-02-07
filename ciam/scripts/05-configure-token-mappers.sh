#!/usr/bin/env bash
# 05-configure-token-mappers.sh — Add loyalty_tier and organizations mappers
# Adds mappers to BOTH poc-bff and poc-backend clients.
# Phase Two uses separate mappers for org roles, attributes, and active org.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-helpers.sh"

load_env
require_commands curl jq

log_step "Configuring token claim mappers"

get_admin_token

# ── Get client UUIDs ─────────────────────────────────────────────────────────
BFF_UUID=$(get_client_uuid "poc-bff")
BACKEND_UUID=$(get_client_uuid "poc-backend")

if [[ -z "$BFF_UUID" ]]; then
  log_error "Client 'poc-bff' not found. Run 04-register-clients.sh first."
  exit 1
fi
if [[ -z "$BACKEND_UUID" ]]; then
  log_error "Client 'poc-backend' not found. Run 04-register-clients.sh first."
  exit 1
fi

log_info "poc-bff UUID:     $BFF_UUID"
log_info "poc-backend UUID: $BACKEND_UUID"

# ── Helper: add a mapper to a client (idempotent) ───────────────────────────
add_mapper() {
  local client_uuid="$1"
  local client_name="$2"
  local mapper_json="$3"
  local mapper_name
  mapper_name=$(echo "$mapper_json" | jq -r '.name')

  get_admin_token

  if mapper_exists "$client_uuid" "$mapper_name"; then
    log_warn "  Mapper '$mapper_name' already exists on $client_name — skipping"
    return 0
  fi

  local status
  status=$(kc_post "/admin/realms/${KEYCLOAK_REALM}/clients/${client_uuid}/protocol-mappers/models" "$mapper_json")
  if [[ "$status" == "201" ]]; then
    log_ok "  Mapper '$mapper_name' added to $client_name"
  else
    log_error "  Failed to add mapper '$mapper_name' to $client_name (HTTP $status)"
    return 1
  fi
}

# ── Loyalty Tier Mapper ──────────────────────────────────────────────────────
LOYALTY_MAPPER='{
  "name": "loyalty-tier-mapper",
  "protocol": "openid-connect",
  "protocolMapper": "oidc-usermodel-attribute-mapper",
  "config": {
    "user.attribute": "loyaltyTier",
    "claim.name": "loyalty_tier",
    "jsonType.label": "String",
    "id.token.claim": "true",
    "access.token.claim": "true",
    "userinfo.token.claim": "true",
    "multivalued": "false"
  }
}'

log_info "Adding loyalty_tier mapper..."
add_mapper "$BFF_UUID" "poc-bff" "$LOYALTY_MAPPER"
add_mapper "$BACKEND_UUID" "poc-backend" "$LOYALTY_MAPPER"

# ── Phase Two Organization Mappers ───────────────────────────────────────────
# Phase Two uses separate mapper types. IMPORTANT: claim.name is REQUIRED.
# The active-organization-mapper is excluded — it crashes for users with org
# memberships when using direct access grants (no active org session context).
#
# Token claim structure:
#   organizations: { "<org-uuid>": { name: "...", roles: [...] } }
#   org_attributes: { "<org-uuid>": { name: "...", attributes: { ... } } }

ORG_ROLE_MAPPER='{
  "name": "org-role-mapper",
  "protocol": "openid-connect",
  "protocolMapper": "oidc-organization-role-mapper",
  "config": {
    "claim.name": "organizations",
    "id.token.claim": "true",
    "access.token.claim": "true",
    "userinfo.token.claim": "true"
  }
}'

ORG_ATTR_MAPPER='{
  "name": "org-attribute-mapper",
  "protocol": "openid-connect",
  "protocolMapper": "oidc-organization-attribute-mapper",
  "config": {
    "claim.name": "org_attributes",
    "id.token.claim": "true",
    "access.token.claim": "true",
    "userinfo.token.claim": "true"
  }
}'

log_info "Adding organization role mapper..."
add_mapper "$BFF_UUID" "poc-bff" "$ORG_ROLE_MAPPER"
add_mapper "$BACKEND_UUID" "poc-backend" "$ORG_ROLE_MAPPER"

log_info "Adding organization attribute mapper..."
add_mapper "$BFF_UUID" "poc-bff" "$ORG_ATTR_MAPPER"
add_mapper "$BACKEND_UUID" "poc-backend" "$ORG_ATTR_MAPPER"

# ── Verify mappers ───────────────────────────────────────────────────────────
get_admin_token

log_info "Verifying mappers on poc-bff..."
bff_mappers=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/clients/${BFF_UUID}/protocol-mappers/models")
echo "$bff_mappers" | jq -r '.[] | select(.name | test("loyalty|org")) | "  \(.name) -> \(.protocolMapper)"'

log_info "Verifying mappers on poc-backend..."
backend_mappers=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/clients/${BACKEND_UUID}/protocol-mappers/models")
echo "$backend_mappers" | jq -r '.[] | select(.name | test("loyalty|org")) | "  \(.name) -> \(.protocolMapper)"'

log_ok "Token mapper configuration complete"
