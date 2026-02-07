#!/usr/bin/env bash
# 02-configure-user-profile.sh — Set up custom user profile attributes

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-helpers.sh"

load_env
require_commands curl jq

log_step "Configuring user profile attributes"

get_admin_token

log_info "Setting user profile schema (loyaltyTier, phoneNumber)..."

status=$(kc_put "/admin/realms/${KEYCLOAK_REALM}/users/profile" '{
  "attributes": [
    {
      "name": "username",
      "displayName": "Username",
      "validations": { "length": { "min": 3, "max": 255 } },
      "permissions": { "view": ["admin", "user"], "edit": ["admin"] }
    },
    {
      "name": "email",
      "displayName": "Email",
      "validations": { "email": {} },
      "required": { "roles": ["user"] },
      "permissions": { "view": ["admin", "user"], "edit": ["admin", "user"] }
    },
    {
      "name": "firstName",
      "displayName": "First Name",
      "required": { "roles": ["user"] },
      "permissions": { "view": ["admin", "user"], "edit": ["admin", "user"] }
    },
    {
      "name": "lastName",
      "displayName": "Last Name",
      "required": { "roles": ["user"] },
      "permissions": { "view": ["admin", "user"], "edit": ["admin", "user"] }
    },
    {
      "name": "loyaltyTier",
      "displayName": "Loyalty Tier",
      "validations": { "options": { "options": ["bronze", "silver", "gold", "platinum"] } },
      "permissions": { "view": ["admin", "user"], "edit": ["admin"] }
    },
    {
      "name": "phoneNumber",
      "displayName": "Phone Number",
      "permissions": { "view": ["admin", "user"], "edit": ["admin", "user"] }
    }
  ]
}')

if [[ "$status" == "200" || "$status" == "204" ]]; then
  log_ok "User profile schema updated successfully"
else
  log_error "Failed to update user profile (HTTP $status)"
  exit 1
fi

# Verify
log_info "Verifying user profile attributes..."
profile=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/users/profile")
attr_names=$(echo "$profile" | jq -r '.attributes[].name' | tr '\n' ', ')
log_ok "Configured attributes: $attr_names"

log_ok "User profile configuration complete"
