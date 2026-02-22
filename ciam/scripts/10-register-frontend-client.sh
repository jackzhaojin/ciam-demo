#!/usr/bin/env bash
# 10-register-frontend-client.sh — Register poc-frontend (public PKCE client)
# Used by the v1.3 strategy demo login page. Public client with PKCE S256 enforced.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-helpers.sh"

load_env
require_commands curl jq

log_step "Registering poc-frontend client (public PKCE)"

get_admin_token

# ── poc-frontend (Authorization Code + PKCE — public client) ─────────────────
FRONTEND_UUID=$(get_client_uuid "poc-frontend")
if [[ -n "$FRONTEND_UUID" ]]; then
  log_warn "Client 'poc-frontend' already exists (UUID: $FRONTEND_UUID) — skipping creation"
else
  log_info "Creating client 'poc-frontend' (public, authorization code + PKCE)..."
  status=$(kc_post "/admin/realms/${KEYCLOAK_REALM}/clients" '{
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
    "redirectUris": [
      "http://localhost:3000/*"
    ],
    "webOrigins": ["http://localhost:3000"],
    "defaultClientScopes": ["openid", "email", "profile"],
    "optionalClientScopes": ["offline_access"]
  }')
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
