#!/usr/bin/env bash
# 03-configure-social-idps.sh — Register Google/Microsoft/Facebook identity providers
# Skips gracefully if the relevant env vars are empty.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-helpers.sh"

load_env
require_commands curl jq

log_step "Configuring social identity providers"

get_admin_token

# ── Google ───────────────────────────────────────────────────────────────────
if [[ -n "${GOOGLE_CLIENT_ID:-}" && -n "${GOOGLE_CLIENT_SECRET:-}" ]]; then
  if idp_exists "google"; then
    log_warn "Google IdP already exists — skipping"
  else
    log_info "Registering Google identity provider..."
    status=$(kc_post "/admin/realms/${KEYCLOAK_REALM}/identity-provider/instances" "{
      \"alias\": \"google\",
      \"providerId\": \"google\",
      \"enabled\": true,
      \"trustEmail\": true,
      \"storeToken\": false,
      \"firstBrokerLoginFlowAlias\": \"first broker login\",
      \"config\": {
        \"clientId\": \"${GOOGLE_CLIENT_ID}\",
        \"clientSecret\": \"${GOOGLE_CLIENT_SECRET}\",
        \"defaultScope\": \"openid email profile\",
        \"syncMode\": \"IMPORT\"
      }
    }")
    if [[ "$status" == "201" ]]; then
      log_ok "Google IdP registered"
    else
      log_error "Failed to register Google IdP (HTTP $status)"
    fi
  fi
else
  log_warn "GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set — skipping Google"
fi

# ── Microsoft ────────────────────────────────────────────────────────────────
if [[ -n "${MICROSOFT_CLIENT_ID:-}" && -n "${MICROSOFT_CLIENT_SECRET:-}" ]]; then
  if idp_exists "microsoft"; then
    log_warn "Microsoft IdP already exists — skipping"
  else
    log_info "Registering Microsoft identity provider..."
    status=$(kc_post "/admin/realms/${KEYCLOAK_REALM}/identity-provider/instances" "{
      \"alias\": \"microsoft\",
      \"providerId\": \"microsoft\",
      \"enabled\": true,
      \"trustEmail\": true,
      \"storeToken\": false,
      \"firstBrokerLoginFlowAlias\": \"first broker login\",
      \"config\": {
        \"clientId\": \"${MICROSOFT_CLIENT_ID}\",
        \"clientSecret\": \"${MICROSOFT_CLIENT_SECRET}\",
        \"defaultScope\": \"openid email profile\",
        \"syncMode\": \"IMPORT\"
      }
    }")
    if [[ "$status" == "201" ]]; then
      log_ok "Microsoft IdP registered"
    else
      log_error "Failed to register Microsoft IdP (HTTP $status)"
    fi
  fi
else
  log_warn "MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET not set — skipping Microsoft"
fi

# ── Facebook ─────────────────────────────────────────────────────────────────
if [[ -n "${FACEBOOK_APP_ID:-}" && -n "${FACEBOOK_APP_SECRET:-}" ]]; then
  if idp_exists "facebook"; then
    log_warn "Facebook IdP already exists — skipping"
  else
    log_info "Registering Facebook identity provider..."
    status=$(kc_post "/admin/realms/${KEYCLOAK_REALM}/identity-provider/instances" "{
      \"alias\": \"facebook\",
      \"providerId\": \"facebook\",
      \"enabled\": true,
      \"trustEmail\": true,
      \"storeToken\": false,
      \"firstBrokerLoginFlowAlias\": \"first broker login\",
      \"config\": {
        \"clientId\": \"${FACEBOOK_APP_ID}\",
        \"clientSecret\": \"${FACEBOOK_APP_SECRET}\",
        \"defaultScope\": \"email public_profile\",
        \"syncMode\": \"IMPORT\"
      }
    }")
    if [[ "$status" == "201" ]]; then
      log_ok "Facebook IdP registered"
    else
      log_error "Failed to register Facebook IdP (HTTP $status)"
    fi
  fi
else
  log_warn "FACEBOOK_APP_ID or FACEBOOK_APP_SECRET not set — skipping Facebook"
fi

log_ok "Social identity provider configuration complete"
