#!/usr/bin/env bash
# 05-configure-token-mappers.sh — Add loyalty_tier and organizations mappers
# Adds mappers to BOTH poc-bff and poc-backend clients.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-helpers.sh"

load_env
require_commands curl jq

log_step "Configuring token claim mappers"

get_admin_token

# ── Discover the correct organization mapper type ────────────────────────────
log_info "Discovering available protocol mapper types..."
mapper_types=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/clients/${BFF_UUID:-temp}/protocol-mappers/protocol/openid-connect" 2>/dev/null || echo "[]")

# Try to find organization-related mapper types
ORG_MAPPER_TYPE=""

# Check multiple possible mapper type names that Phase Two might use
for candidate in \
  "oidc-organization-membership-mapper" \
  "oidc-organization-role-mapper" \
  "oidc-organization-idp-mapper"; do
  if echo "$mapper_types" | jq -e --arg t "$candidate" '.[] | select(.id == $t)' &>/dev/null 2>&1; then
    ORG_MAPPER_TYPE="$candidate"
    log_ok "Found organization mapper type: $ORG_MAPPER_TYPE"
    break
  fi
done

# If discovery failed, fall back to the documented type
if [[ -z "$ORG_MAPPER_TYPE" ]]; then
  ORG_MAPPER_TYPE="oidc-organization-membership-mapper"
  log_warn "Could not discover org mapper type via API. Using documented default: $ORG_MAPPER_TYPE"
fi

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

# ── Organizations Mapper (Phase Two extension) ───────────────────────────────
ORG_MAPPER=$(cat <<EOF
{
  "name": "organizations-mapper",
  "protocol": "openid-connect",
  "protocolMapper": "${ORG_MAPPER_TYPE}",
  "config": {
    "id.token.claim": "true",
    "access.token.claim": "true",
    "userinfo.token.claim": "true"
  }
}
EOF
)

log_info "Adding organizations mapper (type: $ORG_MAPPER_TYPE)..."
add_mapper "$BFF_UUID" "poc-bff" "$ORG_MAPPER"
add_mapper "$BACKEND_UUID" "poc-backend" "$ORG_MAPPER"

# ── Verify mappers ───────────────────────────────────────────────────────────
get_admin_token

log_info "Verifying mappers on poc-bff..."
bff_mappers=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/clients/${BFF_UUID}/protocol-mappers/models")
echo "$bff_mappers" | jq -r '.[] | select(.name == "loyalty-tier-mapper" or .name == "organizations-mapper") | "  \(.name) -> protocolMapper: \(.protocolMapper)"'

log_info "Verifying mappers on poc-backend..."
backend_mappers=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/clients/${BACKEND_UUID}/protocol-mappers/models")
echo "$backend_mappers" | jq -r '.[] | select(.name == "loyalty-tier-mapper" or .name == "organizations-mapper") | "  \(.name) -> protocolMapper: \(.protocolMapper)"'

log_ok "Token mapper configuration complete"
