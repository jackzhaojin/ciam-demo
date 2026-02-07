#!/usr/bin/env bash
# 01-configure-realm.sh — Configure realm settings for CIAM use case

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-helpers.sh"

load_env
require_commands curl jq

log_step "Configuring realm: ${KEYCLOAK_REALM}"

get_admin_token

log_info "Updating realm settings (registration, email-as-username, brute force, token lifespans)..."

status=$(kc_put "/admin/realms/${KEYCLOAK_REALM}" '{
  "registrationAllowed": true,
  "registrationEmailAsUsername": true,
  "resetPasswordAllowed": true,
  "rememberMe": true,
  "verifyEmail": false,
  "loginWithEmailAllowed": true,
  "duplicateEmailsAllowed": false,
  "sslRequired": "external",
  "bruteForceProtected": true,
  "maxFailureWaitSeconds": 900,
  "failureFactor": 5,
  "accessTokenLifespan": 300,
  "ssoSessionIdleTimeout": 1800,
  "ssoSessionMaxLifespan": 36000
}')

if [[ "$status" == "204" || "$status" == "200" ]]; then
  log_ok "Realm '${KEYCLOAK_REALM}' configured successfully"
else
  log_error "Failed to configure realm (HTTP $status)"
  exit 1
fi

# Enable direct access grants on the realm level for test user authentication
log_info "Verifying realm configuration..."
realm_config=$(kc_get "/admin/realms/${KEYCLOAK_REALM}")
reg_allowed=$(echo "$realm_config" | jq -r '.registrationAllowed')
email_as_user=$(echo "$realm_config" | jq -r '.registrationEmailAsUsername')
brute_force=$(echo "$realm_config" | jq -r '.bruteForceProtected')

log_ok "  registrationAllowed:         $reg_allowed"
log_ok "  registrationEmailAsUsername:  $email_as_user"
log_ok "  bruteForceProtected:          $brute_force"

log_ok "Realm configuration complete"
