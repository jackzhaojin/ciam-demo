#!/usr/bin/env bash
# 10-register-frontend-client.sh — Register poc-frontend (public PKCE client)
# Used by the v1.3 strategy demo login page. Public client with PKCE S256 enforced.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-helpers.sh"

load_env
require_commands curl jq

log_step "Registering poc-frontend client (public PKCE)"

PRODUCTION_APP_URL="${PRODUCTION_APP_URL:-http://157.151.152.16:3001}"
LOCAL_APP_URL="http://localhost:3000"

DESIRED_REDIRECTS=$(jq -n \
  --arg local "${LOCAL_APP_URL}/*" \
  --arg prod "${PRODUCTION_APP_URL}/*" \
  '[ $local, $prod ] | unique')

DESIRED_ORIGINS=$(jq -n \
  --arg local "$LOCAL_APP_URL" \
  --arg prod "$PRODUCTION_APP_URL" \
  '[ $local, $prod ] | unique')

get_admin_token

# ── poc-frontend (Authorization Code + PKCE — public client) ─────────────────
FRONTEND_UUID=$(get_client_uuid "poc-frontend")
if [[ -n "$FRONTEND_UUID" ]]; then
  log_warn "Client 'poc-frontend' already exists (UUID: $FRONTEND_UUID) — updating redirect URIs/origins"

  current=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/clients/${FRONTEND_UUID}")
  current_redirects=$(echo "$current" | jq -r '.redirectUris')
  current_origins=$(echo "$current" | jq -r '.webOrigins')

  updated_redirects=$(jq -n \
    --argjson current "$current_redirects" \
    --argjson desired "$DESIRED_REDIRECTS" \
    '$current + $desired | unique')

  updated_origins=$(jq -n \
    --argjson current "$current_origins" \
    --argjson desired "$DESIRED_ORIGINS" \
    '$current + $desired | unique')

  if [[ "$updated_redirects" == "$current_redirects" && "$updated_origins" == "$current_origins" ]]; then
    log_ok "poc-frontend redirect URIs and web origins already configured"
  else
    payload=$(jq -n \
      --arg clientId "poc-frontend" \
      --argjson redirectUris "$updated_redirects" \
      --argjson webOrigins "$updated_origins" \
      '{clientId: $clientId, redirectUris: $redirectUris, webOrigins: $webOrigins}')

    status=$(kc_put "/admin/realms/${KEYCLOAK_REALM}/clients/${FRONTEND_UUID}" "$payload")
    if [[ "$status" == "204" ]]; then
      log_ok "Updated poc-frontend redirect URIs and web origins"
    else
      log_error "Failed to update 'poc-frontend' (HTTP $status)"
      exit 1
    fi
  fi
else
  log_info "Creating client 'poc-frontend' (public, authorization code + PKCE)..."
  payload=$(jq -n \
    --argjson redirectUris "$DESIRED_REDIRECTS" \
    --argjson webOrigins "$DESIRED_ORIGINS" \
    '{
    "clientId": "poc-frontend",
    "name": "PoC Frontend (PKCE)",
    "description": "Public client for v1.3 strategy demo — PKCE S256 enforced, no client secret",
    "enabled": true,
    "publicClient": true,
    "directAccessGrantsEnabled": false,
    "standardFlowEnabled": true,
    "implicitFlowEnabled": false,
    "serviceAccountsEnabled": false,
    "protocol": "openid-connect",
    "attributes": {
      "pkce.code.challenge.method": "S256"
    },
    "redirectUris": $redirectUris,
    "webOrigins": $webOrigins,
    "defaultClientScopes": ["openid", "email", "profile"],
    "optionalClientScopes": ["offline_access"]
  }')
  status=$(kc_post "/admin/realms/${KEYCLOAK_REALM}/clients" "$payload")
  if [[ "$status" == "201" ]]; then
    log_ok "Client 'poc-frontend' created"
    FRONTEND_UUID=$(get_client_uuid "poc-frontend")
  else
    log_error "Failed to create 'poc-frontend' (HTTP $status)"
    exit 1
  fi
fi

log_info "poc-frontend UUID: $FRONTEND_UUID"
log_ok "Frontend client registration complete (no secret — public client)"
