#!/usr/bin/env bash
# 08-create-test-users.sh — Create test users with org memberships and roles
#
# Users created:
#   admin@test.com — admin+billing in acme-corp, viewer in globex-inc
#   user@test.com  — viewer in acme-corp
#   multi@test.com — admin in both orgs

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-helpers.sh"

load_env
require_commands curl jq

log_step "Creating test users"

get_admin_token

TEST_PASSWORD="Test1234!"

# ── Get org IDs ──────────────────────────────────────────────────────────────
ACME_ID=$(get_org_id "acme-corp")
GLOBEX_ID=$(get_org_id "globex-inc")

if [[ -z "$ACME_ID" || -z "$GLOBEX_ID" ]]; then
  log_error "Organizations not found. Run 06-create-organizations.sh first."
  exit 1
fi

# ── Helper: create a user (idempotent) ───────────────────────────────────────
create_user() {
  local email="$1"
  local first_name="$2"
  local last_name="$3"
  local loyalty_tier="$4"

  get_admin_token

  local user_id
  user_id=$(get_user_id "$email")
  if [[ -n "$user_id" ]]; then
    log_warn "User '$email' already exists (ID: $user_id) — skipping creation"
    echo "$user_id"
    return 0
  fi

  log_info "Creating user '$email'..."
  local status
  status=$(kc_post "/admin/realms/${KEYCLOAK_REALM}/users" "{
    \"username\": \"${email}\",
    \"email\": \"${email}\",
    \"emailVerified\": true,
    \"enabled\": true,
    \"firstName\": \"${first_name}\",
    \"lastName\": \"${last_name}\",
    \"attributes\": {
      \"loyaltyTier\": [\"${loyalty_tier}\"],
      \"phoneNumber\": [\"+1-555-0100\"]
    },
    \"credentials\": [{
      \"type\": \"password\",
      \"value\": \"${TEST_PASSWORD}\",
      \"temporary\": false
    }]
  }")

  if [[ "$status" == "201" ]]; then
    user_id=$(get_user_id "$email")
    log_ok "User '$email' created (ID: $user_id)"
    echo "$user_id"
  else
    log_error "Failed to create user '$email' (HTTP $status)"
    return 1
  fi
}

# ── Helper: add user to org with roles ───────────────────────────────────────
assign_org_membership() {
  local user_id="$1"
  local org_id="$2"
  local org_name="$3"
  shift 3
  local roles=("$@")

  get_admin_token

  # Add as member
  if is_org_member "$org_id" "$user_id"; then
    log_warn "  User already a member of $org_name — skipping membership"
  else
    log_info "  Adding user to $org_name..."
    local status
    status=$(kc_put_nobody "/admin/realms/${KEYCLOAK_REALM}/orgs/${org_id}/members/${user_id}")
    if [[ "$status" == "201" || "$status" == "204" || "$status" == "200" ]]; then
      log_ok "  Added to $org_name"
    else
      log_error "  Failed to add to $org_name (HTTP $status)"
      return 1
    fi
  fi

  # Grant roles
  if [[ ${#roles[@]} -gt 0 ]]; then
    local roles_json="["
    local first=true
    for role in "${roles[@]}"; do
      if [[ "$first" == "true" ]]; then
        first=false
      else
        roles_json+=","
      fi
      roles_json+="{\"name\":\"${role}\"}"
    done
    roles_json+="]"

    get_admin_token
    log_info "  Granting roles [${roles[*]}] in $org_name..."
    local status
    status=$(kc_post "/admin/realms/${KEYCLOAK_REALM}/orgs/${org_id}/members/${user_id}/roles" "$roles_json")
    if [[ "$status" == "201" || "$status" == "204" || "$status" == "200" ]]; then
      log_ok "  Roles granted in $org_name"
    else
      log_warn "  Role grant returned HTTP $status (roles may already be assigned)"
    fi
  fi
}

# ── Create Users ─────────────────────────────────────────────────────────────

# admin@test.com — admin+billing in acme-corp, viewer in globex-inc
ADMIN_USER_ID=$(create_user "admin@test.com" "Admin" "User" "gold")
log_info "Assigning org memberships for admin@test.com..."
assign_org_membership "$ADMIN_USER_ID" "$ACME_ID" "acme-corp" "admin" "billing"
assign_org_membership "$ADMIN_USER_ID" "$GLOBEX_ID" "globex-inc" "viewer"

echo ""

# user@test.com — viewer in acme-corp
REGULAR_USER_ID=$(create_user "user@test.com" "Regular" "User" "bronze")
log_info "Assigning org memberships for user@test.com..."
assign_org_membership "$REGULAR_USER_ID" "$ACME_ID" "acme-corp" "viewer"

echo ""

# multi@test.com — admin in both orgs
MULTI_USER_ID=$(create_user "multi@test.com" "Multi" "OrgUser" "silver")
log_info "Assigning org memberships for multi@test.com..."
assign_org_membership "$MULTI_USER_ID" "$ACME_ID" "acme-corp" "admin"
assign_org_membership "$MULTI_USER_ID" "$GLOBEX_ID" "globex-inc" "admin"

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
log_ok "Test users created with password: ${TEST_PASSWORD}"
echo ""
log_info "User summary:"
echo "  admin@test.com  — gold tier    — acme-corp: admin,billing | globex-inc: viewer"
echo "  user@test.com   — bronze tier  — acme-corp: viewer"
echo "  multi@test.com  — silver tier  — acme-corp: admin        | globex-inc: admin"

log_ok "Test user creation complete"
