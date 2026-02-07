#!/usr/bin/env bash
# 04-register-clients.sh — Register poc-backend and poc-bff clients
# NO poc-frontend client (removed per gap fix #2 — BFF pattern only)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-helpers.sh"

load_env
require_commands curl jq

log_step "Registering application clients"

get_admin_token

# ── poc-backend (Client Credentials — service-to-service) ────────────────────
BACKEND_UUID=$(get_client_uuid "poc-backend")
if [[ -n "$BACKEND_UUID" ]]; then
  log_warn "Client 'poc-backend' already exists (UUID: $BACKEND_UUID) — skipping creation"
else
  log_info "Creating client 'poc-backend' (confidential, client credentials)..."
  status=$(kc_post "/admin/realms/${KEYCLOAK_REALM}/clients" '{
    "clientId": "poc-backend",
    "name": "PoC Backend Service",
    "description": "Spring Boot backend — confidential client for service-to-service",
    "enabled": true,
    "publicClient": false,
    "directAccessGrantsEnabled": false,
    "standardFlowEnabled": false,
    "implicitFlowEnabled": false,
    "serviceAccountsEnabled": true,
    "protocol": "openid-connect",
    "defaultClientScopes": ["openid", "email", "profile"],
    "optionalClientScopes": []
  }')
  if [[ "$status" == "201" ]]; then
    log_ok "Client 'poc-backend' created"
    BACKEND_UUID=$(get_client_uuid "poc-backend")
  else
    log_error "Failed to create 'poc-backend' (HTTP $status)"
    exit 1
  fi
fi

# ── poc-bff (Authorization Code — confidential BFF) ─────────────────────────
BFF_UUID=$(get_client_uuid "poc-bff")
if [[ -n "$BFF_UUID" ]]; then
  log_warn "Client 'poc-bff' already exists (UUID: $BFF_UUID) — skipping creation"
else
  log_info "Creating client 'poc-bff' (confidential, authorization code)..."
  status=$(kc_post "/admin/realms/${KEYCLOAK_REALM}/clients" '{
    "clientId": "poc-bff",
    "name": "PoC Backend-for-Frontend",
    "description": "Confidential client for BFF pattern — Next.js server-side + Spring Boot",
    "enabled": true,
    "publicClient": false,
    "directAccessGrantsEnabled": true,
    "standardFlowEnabled": true,
    "implicitFlowEnabled": false,
    "serviceAccountsEnabled": false,
    "protocol": "openid-connect",
    "redirectUris": [
      "http://localhost:8080/login/oauth2/code/keycloak",
      "http://localhost:3000/api/auth/callback/keycloak"
    ],
    "webOrigins": ["http://localhost:3000", "http://localhost:8080"],
    "defaultClientScopes": ["openid", "email", "profile"],
    "optionalClientScopes": ["offline_access"]
  }')
  if [[ "$status" == "201" ]]; then
    log_ok "Client 'poc-bff' created"
    BFF_UUID=$(get_client_uuid "poc-bff")
  else
    log_error "Failed to create 'poc-bff' (HTTP $status)"
    exit 1
  fi
fi

# ── Retrieve and print client secrets ────────────────────────────────────────
get_admin_token

log_info "Retrieving client secrets..."

if [[ -n "$BACKEND_UUID" ]]; then
  backend_secret_resp=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/clients/${BACKEND_UUID}/client-secret")
  BACKEND_SECRET=$(echo "$backend_secret_resp" | jq -r '.value // empty')
  if [[ -n "$BACKEND_SECRET" ]]; then
    log_ok "poc-backend secret: $BACKEND_SECRET"
  else
    log_warn "poc-backend secret not available (may need to generate)"
  fi
fi

if [[ -n "$BFF_UUID" ]]; then
  bff_secret_resp=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/clients/${BFF_UUID}/client-secret")
  BFF_SECRET=$(echo "$bff_secret_resp" | jq -r '.value // empty')
  if [[ -n "$BFF_SECRET" ]]; then
    log_ok "poc-bff secret:     $BFF_SECRET"
  else
    log_warn "poc-bff secret not available (may need to generate)"
  fi
fi

echo ""
log_info "Add these to your .env file:"
echo "  KEYCLOAK_BACKEND_CLIENT_SECRET=${BACKEND_SECRET:-<not available>}"
echo "  KEYCLOAK_BFF_CLIENT_SECRET=${BFF_SECRET:-<not available>}"

log_ok "Client registration complete"
