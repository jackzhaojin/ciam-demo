#!/usr/bin/env bash
# 11-configure-frontend-mappers.sh — Add token mappers to poc-frontend client
# Same mappers as poc-bff/poc-backend: loyalty_tier, organizations, org_attributes.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-helpers.sh"

load_env
require_commands curl jq

log_step "Configuring token mappers for poc-frontend"

get_admin_token

# ── Get client UUID ──────────────────────────────────────────────────────────
FRONTEND_UUID=$(get_client_uuid "poc-frontend")
if [[ -z "$FRONTEND_UUID" ]]; then
  log_error "Client 'poc-frontend' not found. Run 10-register-frontend-client.sh first."
  exit 1
fi

log_info "poc-frontend UUID: $FRONTEND_UUID"

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

# ── Phase Two Organization Mappers ───────────────────────────────────────────
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

log_info "Adding loyalty_tier mapper..."
add_mapper "$FRONTEND_UUID" "poc-frontend" "$LOYALTY_MAPPER"

log_info "Adding organization role mapper..."
add_mapper "$FRONTEND_UUID" "poc-frontend" "$ORG_ROLE_MAPPER"

log_info "Adding organization attribute mapper..."
add_mapper "$FRONTEND_UUID" "poc-frontend" "$ORG_ATTR_MAPPER"

# ── Verify mappers ───────────────────────────────────────────────────────────
get_admin_token

log_info "Verifying mappers on poc-frontend..."
frontend_mappers=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/clients/${FRONTEND_UUID}/protocol-mappers/models")
echo "$frontend_mappers" | jq -r '.[] | select(.name | test("loyalty|org")) | "  \(.name) -> \(.protocolMapper)"'

log_ok "Frontend token mapper configuration complete"
