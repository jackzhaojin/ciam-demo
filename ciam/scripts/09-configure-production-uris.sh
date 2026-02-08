#!/usr/bin/env bash
# 09-configure-production-uris.sh — Add production redirect URIs to poc-bff client
#
# The initial client registration (04) only sets localhost URIs.
# This script adds production URIs (Oracle VM) so deployed apps can authenticate.
#
# Reads PRODUCTION_APP_URL from .env (defaults to http://157.151.152.16:3001).
# Idempotent: skips if the production URI is already registered.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-helpers.sh"

load_env
require_commands curl jq

log_step "Configuring production redirect URIs"

PRODUCTION_APP_URL="${PRODUCTION_APP_URL:-http://157.151.152.16:3001}"
PRODUCTION_API_URL="${PRODUCTION_API_URL:-http://157.151.152.16:8080}"

log_info "Production app URL: $PRODUCTION_APP_URL"
log_info "Production API URL: $PRODUCTION_API_URL"

get_admin_token

# ── Get poc-bff client ────────────────────────────────────────────────────────
BFF_UUID=$(get_client_uuid "poc-bff")
if [[ -z "$BFF_UUID" ]]; then
  log_error "Client 'poc-bff' not found — run 04-register-clients.sh first"
  exit 1
fi
log_info "poc-bff UUID: $BFF_UUID"

# ── Fetch current config ─────────────────────────────────────────────────────
current=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/clients/${BFF_UUID}")
current_redirects=$(echo "$current" | jq -r '.redirectUris')
current_origins=$(echo "$current" | jq -r '.webOrigins')

PROD_REDIRECT="${PRODUCTION_APP_URL}/api/auth/callback/keycloak"
PROD_API_REDIRECT="${PRODUCTION_API_URL}/login/oauth2/code/keycloak"

# ── Check if already configured ──────────────────────────────────────────────
app_redirect_exists=$(echo "$current_redirects" | jq -r --arg uri "$PROD_REDIRECT" '[.[] | select(. == $uri)] | length')
if [[ "$app_redirect_exists" -gt 0 ]]; then
  log_warn "Production app redirect URI already registered — skipping"
  echo "  $PROD_REDIRECT"
  log_ok "Production URIs already configured"
  exit 0
fi

# ── Build updated arrays ─────────────────────────────────────────────────────
updated_redirects=$(echo "$current_redirects" | jq \
  --arg app "$PROD_REDIRECT" \
  --arg api "$PROD_API_REDIRECT" \
  '. + [$app, $api] | unique')

updated_origins=$(echo "$current_origins" | jq \
  --arg app "$PRODUCTION_APP_URL" \
  --arg api "$PRODUCTION_API_URL" \
  '. + [$app, $api] | unique')

log_info "Updated redirectUris:"
echo "$updated_redirects" | jq -r '.[]' | while read -r uri; do echo "  $uri"; done

log_info "Updated webOrigins:"
echo "$updated_origins" | jq -r '.[]' | while read -r uri; do echo "  $uri"; done

# ── PUT update ────────────────────────────────────────────────────────────────
get_admin_token
payload=$(jq -n \
  --arg clientId "poc-bff" \
  --argjson redirectUris "$updated_redirects" \
  --argjson webOrigins "$updated_origins" \
  '{clientId: $clientId, redirectUris: $redirectUris, webOrigins: $webOrigins}')

status=$(kc_put "/admin/realms/${KEYCLOAK_REALM}/clients/${BFF_UUID}" "$payload")
if [[ "$status" == "204" ]]; then
  log_ok "Production redirect URIs added to poc-bff"
else
  log_error "Failed to update poc-bff (HTTP $status)"
  exit 1
fi
