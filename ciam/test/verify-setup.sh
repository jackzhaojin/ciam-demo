#!/usr/bin/env bash
# verify-setup.sh — Comprehensive verification of CIAM Keycloak setup
#
# Authenticates as a test user, decodes the JWT, validates all expected claims,
# tests client existence, org membership, and prints a clear PASS/FAIL summary.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPERS="$(dirname "$SCRIPT_DIR")/scripts/00-helpers.sh"
source "$HELPERS"

load_env
require_commands curl jq

echo ""
echo "============================================================"
echo "  CIAM Setup Verification"
echo "============================================================"
echo "  Base URL: ${KEYCLOAK_BASE_URL}"
echo "  Realm:    ${KEYCLOAK_REALM}"
echo "============================================================"
echo ""

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  log_ok "PASS: $*"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  log_error "FAIL: $*"
}

warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  log_warn "WARN: $*"
}

# ── 1. Admin connectivity ───────────────────────────────────────────────────
log_step "1. Admin connectivity"
if get_admin_token 2>/dev/null; then
  pass "Admin token obtained"
else
  fail "Cannot obtain admin token"
  log_error "Cannot proceed without admin access."
  exit 1
fi

# ── 2. Realm configuration ──────────────────────────────────────────────────
log_step "2. Realm configuration"
realm=$(kc_get "/admin/realms/${KEYCLOAK_REALM}")

check_realm_field() {
  local field="$1"
  local expected="$2"
  local actual
  actual=$(echo "$realm" | jq -r ".${field}")
  if [[ "$actual" == "$expected" ]]; then
    pass "$field = $actual"
  else
    fail "$field = $actual (expected $expected)"
  fi
}

check_realm_field "registrationAllowed" "true"
check_realm_field "registrationEmailAsUsername" "true"
check_realm_field "bruteForceProtected" "true"
check_realm_field "accessTokenLifespan" "300"

# ── 3. Social IdPs ──────────────────────────────────────────────────────────
log_step "3. Social identity providers"
get_admin_token

for provider in google microsoft facebook; do
  if idp_exists "$provider"; then
    pass "IdP '$provider' registered"
  else
    if [[ -n "${GOOGLE_CLIENT_ID:-}" && "$provider" == "google" ]] || \
       [[ -n "${MICROSOFT_CLIENT_ID:-}" && "$provider" == "microsoft" ]] || \
       [[ -n "${FACEBOOK_APP_ID:-}" && "$provider" == "facebook" ]]; then
      fail "IdP '$provider' NOT registered (env vars were set)"
    else
      warn "IdP '$provider' not registered (env vars not set — expected)"
    fi
  fi
done

# ── 4. Clients ───────────────────────────────────────────────────────────────
log_step "4. Application clients"
get_admin_token

BFF_UUID=$(get_client_uuid "poc-bff")
BACKEND_UUID=$(get_client_uuid "poc-backend")

if [[ -n "$BFF_UUID" ]]; then
  pass "Client 'poc-bff' exists (UUID: $BFF_UUID)"

  # Verify settings
  bff_client=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/clients/${BFF_UUID}")
  bff_public=$(echo "$bff_client" | jq -r '.publicClient')
  bff_standard=$(echo "$bff_client" | jq -r '.standardFlowEnabled')
  bff_dag=$(echo "$bff_client" | jq -r '.directAccessGrantsEnabled')
  if [[ "$bff_public" == "false" ]]; then
    pass "  poc-bff is confidential (publicClient=false)"
  else
    fail "  poc-bff is public (should be confidential)"
  fi
  if [[ "$bff_standard" == "true" ]]; then
    pass "  poc-bff has standardFlowEnabled=true"
  else
    fail "  poc-bff has standardFlowEnabled=false"
  fi
  if [[ "$bff_dag" == "true" ]]; then
    pass "  poc-bff has directAccessGrantsEnabled=true (needed for test auth)"
  else
    warn "  poc-bff has directAccessGrantsEnabled=false (test auth may not work)"
  fi
else
  fail "Client 'poc-bff' NOT found"
fi

if [[ -n "$BACKEND_UUID" ]]; then
  pass "Client 'poc-backend' exists (UUID: $BACKEND_UUID)"

  backend_client=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/clients/${BACKEND_UUID}")
  backend_sa=$(echo "$backend_client" | jq -r '.serviceAccountsEnabled')
  if [[ "$backend_sa" == "true" ]]; then
    pass "  poc-backend has serviceAccountsEnabled=true"
  else
    fail "  poc-backend has serviceAccountsEnabled=false"
  fi
else
  fail "Client 'poc-backend' NOT found"
fi

# Check that poc-frontend does NOT exist (gap fix #2)
FRONTEND_UUID=$(get_client_uuid "poc-frontend")
if [[ -z "$FRONTEND_UUID" ]]; then
  pass "Client 'poc-frontend' does NOT exist (correct — BFF only)"
else
  warn "Client 'poc-frontend' exists (should have been removed per gap fix #2)"
fi

# ── 5. Token mappers ────────────────────────────────────────────────────────
log_step "5. Token mappers"
get_admin_token

if [[ -n "$BFF_UUID" ]]; then
  bff_mappers=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/clients/${BFF_UUID}/protocol-mappers/models")

  if echo "$bff_mappers" | jq -e '.[] | select(.name == "loyalty-tier-mapper")' &>/dev/null; then
    pass "loyalty-tier-mapper exists on poc-bff"
  else
    fail "loyalty-tier-mapper NOT found on poc-bff"
  fi

  # Phase Two uses 2 org mappers (active-org-mapper excluded — crashes with direct access grants)
  for mapper_name in "org-role-mapper" "org-attribute-mapper"; do
    if echo "$bff_mappers" | jq -e --arg n "$mapper_name" '.[] | select(.name == $n)' &>/dev/null; then
      mapper_type=$(echo "$bff_mappers" | jq -r --arg n "$mapper_name" '.[] | select(.name == $n) | .protocolMapper')
      pass "$mapper_name exists on poc-bff (type: $mapper_type)"
    else
      fail "$mapper_name NOT found on poc-bff"
    fi
  done
fi

if [[ -n "$BACKEND_UUID" ]]; then
  backend_mappers=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/clients/${BACKEND_UUID}/protocol-mappers/models")

  if echo "$backend_mappers" | jq -e '.[] | select(.name == "loyalty-tier-mapper")' &>/dev/null; then
    pass "loyalty-tier-mapper exists on poc-backend"
  else
    fail "loyalty-tier-mapper NOT found on poc-backend"
  fi

  for mapper_name in "org-role-mapper" "org-attribute-mapper"; do
    if echo "$backend_mappers" | jq -e --arg n "$mapper_name" '.[] | select(.name == $n)' &>/dev/null; then
      pass "$mapper_name exists on poc-backend"
    else
      fail "$mapper_name NOT found on poc-backend"
    fi
  done
fi

# ── 6. Organizations ────────────────────────────────────────────────────────
log_step "6. Organizations"
get_admin_token

ACME_ID=$(get_org_id "acme-corp")
GLOBEX_ID=$(get_org_id "globex-inc")

if [[ -n "$ACME_ID" ]]; then
  pass "Organization 'acme-corp' exists (ID: $ACME_ID)"
else
  fail "Organization 'acme-corp' NOT found"
fi

if [[ -n "$GLOBEX_ID" ]]; then
  pass "Organization 'globex-inc' exists (ID: $GLOBEX_ID)"
else
  fail "Organization 'globex-inc' NOT found"
fi

# ── 7. Organization roles ───────────────────────────────────────────────────
log_step "7. Organization roles"
get_admin_token

for org_id_var in ACME_ID GLOBEX_ID; do
  org_id="${!org_id_var}"
  org_label=$( [[ "$org_id_var" == "ACME_ID" ]] && echo "acme-corp" || echo "globex-inc" )

  if [[ -z "$org_id" ]]; then
    fail "Cannot check roles — $org_label not found"
    continue
  fi

  for role_name in admin billing viewer; do
    if org_role_exists "$org_id" "$role_name"; then
      pass "Role '$role_name' exists in $org_label"
    else
      fail "Role '$role_name' NOT found in $org_label"
    fi
  done
done

# ── 8. Test users & org membership ──────────────────────────────────────────
log_step "8. Test users and org membership"
get_admin_token

ADMIN_UID=$(get_user_id "admin@test.com")
USER_UID=$(get_user_id "user@test.com")
MULTI_UID=$(get_user_id "multi@test.com")

for email_uid_pair in "admin@test.com:$ADMIN_UID" "user@test.com:$USER_UID" "multi@test.com:$MULTI_UID"; do
  email="${email_uid_pair%%:*}"
  uid="${email_uid_pair#*:}"
  if [[ -n "$uid" ]]; then
    pass "User '$email' exists (ID: $uid)"
  else
    fail "User '$email' NOT found"
  fi
done

# Check membership
if [[ -n "$ADMIN_UID" && -n "$ACME_ID" ]]; then
  if is_org_member "$ACME_ID" "$ADMIN_UID"; then
    pass "admin@test.com is member of acme-corp"
  else
    fail "admin@test.com is NOT member of acme-corp"
  fi
fi

if [[ -n "$ADMIN_UID" && -n "$GLOBEX_ID" ]]; then
  if is_org_member "$GLOBEX_ID" "$ADMIN_UID"; then
    pass "admin@test.com is member of globex-inc"
  else
    fail "admin@test.com is NOT member of globex-inc"
  fi
fi

if [[ -n "$MULTI_UID" && -n "$ACME_ID" ]]; then
  if is_org_member "$ACME_ID" "$MULTI_UID"; then
    pass "multi@test.com is member of acme-corp"
  else
    fail "multi@test.com is NOT member of acme-corp"
  fi
fi

if [[ -n "$MULTI_UID" && -n "$GLOBEX_ID" ]]; then
  if is_org_member "$GLOBEX_ID" "$MULTI_UID"; then
    pass "multi@test.com is member of globex-inc"
  else
    fail "multi@test.com is NOT member of globex-inc"
  fi
fi

# ── 9. Token authentication & JWT decode ─────────────────────────────────────
log_step "9. Token authentication and JWT structure"

TEST_PASSWORD="Test1234"

# Get BFF client secret for auth
BFF_SECRET=""
if [[ -n "${KEYCLOAK_BFF_CLIENT_SECRET:-}" ]]; then
  BFF_SECRET="$KEYCLOAK_BFF_CLIENT_SECRET"
else
  get_admin_token
  if [[ -n "$BFF_UUID" ]]; then
    bff_secret_resp=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/clients/${BFF_UUID}/client-secret")
    BFF_SECRET=$(echo "$bff_secret_resp" | jq -r '.value // empty')
  fi
fi

if [[ -z "$BFF_SECRET" ]]; then
  fail "Cannot obtain poc-bff client secret — skipping token tests"
else
  # Clear brute-force lockout before testing (may have been triggered by prior debugging)
  get_admin_token
  if [[ -n "$ADMIN_UID" ]]; then
    curl -s -o /dev/null -X DELETE \
      "${KEYCLOAK_BASE_URL}/admin/realms/${KEYCLOAK_REALM}/attack-detection/brute-force/users/${ADMIN_UID}" \
      -H "Authorization: Bearer $(admin_token)" 2>/dev/null || true
  fi

  # Authenticate as admin@test.com via direct access grant
  log_info "Authenticating as admin@test.com via direct access grant..."
  token_response=$(curl -sf -X POST \
    "${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "client_id=poc-bff" \
    -d "client_secret=${BFF_SECRET}" \
    -d "username=admin@test.com" \
    -d "password=${TEST_PASSWORD}" \
    -d "grant_type=password" \
    -d "scope=openid email profile" 2>&1) || {
    fail "Direct access grant failed for admin@test.com"
    token_response=""
  }

  if [[ -n "$token_response" ]]; then
    access_token=$(echo "$token_response" | jq -r '.access_token // empty')

    if [[ -n "$access_token" && "$access_token" != "null" ]]; then
      pass "Access token obtained for admin@test.com"

      # Decode JWT (base64 decode the payload — second segment)
      jwt_payload=$(echo "$access_token" | cut -d'.' -f2)
      # Add padding if needed
      padding=$(( 4 - ${#jwt_payload} % 4 ))
      if [[ $padding -ne 4 ]]; then
        jwt_payload="${jwt_payload}$(printf '%*s' "$padding" | tr ' ' '=')"
      fi
      decoded=$(echo "$jwt_payload" | base64 -d 2>/dev/null || echo "$jwt_payload" | base64 -D 2>/dev/null || echo "{}")

      echo ""
      log_info "=== DECODED ACCESS TOKEN (admin@test.com) ==="
      echo "$decoded" | jq '.' 2>/dev/null || echo "$decoded"
      echo ""

      # Check for expected claims
      email_claim=$(echo "$decoded" | jq -r '.email // empty')
      if [[ "$email_claim" == "admin@test.com" ]]; then
        pass "Token contains email claim: $email_claim"
      else
        fail "Token email claim missing or wrong: '$email_claim'"
      fi

      loyalty_claim=$(echo "$decoded" | jq -r '.loyalty_tier // empty')
      if [[ -n "$loyalty_claim" ]]; then
        pass "Token contains loyalty_tier claim: $loyalty_claim"
      else
        fail "Token does NOT contain loyalty_tier claim"
      fi

      # Check for organizations claim — the key test
      org_claim=$(echo "$decoded" | jq '.organizations // empty')
      if [[ -n "$org_claim" && "$org_claim" != "null" && "$org_claim" != "" && "$org_claim" != "{}" ]]; then
        pass "Token contains organizations claim"
        echo ""
        log_info "=== ORGANIZATIONS CLAIM STRUCTURE ==="
        echo "$decoded" | jq '.organizations' 2>/dev/null
        echo ""
        log_info "This is the ACTUAL token structure. Backend and web teams must code against this exact format."
      else
        fail "Token does NOT contain organizations claim"
        log_warn "The organizations mapper may not be working correctly."
        log_warn "Check that the protocolMapper type is correct for your Phase Two version."
        echo ""
        log_info "Full token claims for debugging:"
        echo "$decoded" | jq 'keys' 2>/dev/null
      fi

      # ── 9b. Token structure assertions ──
      # Validate organizations claim structure: each org should have name + roles[]
      org_count=$(echo "$decoded" | jq '[.organizations // {} | to_entries[]] | length' 2>/dev/null || echo "0")
      if [[ "$org_count" -ge 1 ]]; then
        pass "Organizations claim contains $org_count org(s)"
      else
        fail "Organizations claim is empty or malformed"
      fi

      # Check that at least one org has a roles array
      orgs_with_roles=$(echo "$decoded" | jq '[.organizations // {} | to_entries[] | select(.value.roles | type == "array" and length > 0)] | length' 2>/dev/null || echo "0")
      if [[ "$orgs_with_roles" -ge 1 ]]; then
        pass "At least one org has non-empty roles array"
      else
        fail "No orgs have a valid roles array — backend auth will fail"
      fi

      # Check that each org entry has a 'name' field
      orgs_with_name=$(echo "$decoded" | jq '[.organizations // {} | to_entries[] | select(.value.name != null and .value.name != "")] | length' 2>/dev/null || echo "0")
      if [[ "$orgs_with_name" == "$org_count" ]]; then
        pass "All orgs have a 'name' field"
      else
        fail "Some orgs missing 'name' field ($orgs_with_name of $org_count)"
      fi

      # Validate loyalty_tier is a known value
      if [[ "$loyalty_claim" == "gold" || "$loyalty_claim" == "silver" || "$loyalty_claim" == "bronze" ]]; then
        pass "loyalty_tier is a valid tier: $loyalty_claim"
      elif [[ -n "$loyalty_claim" ]]; then
        warn "loyalty_tier has unexpected value: $loyalty_claim (expected gold/silver/bronze)"
      fi

      # Validate standard JWT claims
      iss_claim=$(echo "$decoded" | jq -r '.iss // empty')
      if [[ -n "$iss_claim" ]]; then
        pass "Token has 'iss' claim: $iss_claim"
      else
        fail "Token missing 'iss' (issuer) claim"
      fi

      exp_claim=$(echo "$decoded" | jq -r '.exp // empty')
      if [[ -n "$exp_claim" ]]; then
        pass "Token has 'exp' claim (expires at: $exp_claim)"
      else
        fail "Token missing 'exp' (expiration) claim"
      fi

      # Also decode the id_token for comparison
      id_token=$(echo "$token_response" | jq -r '.id_token // empty')
      if [[ -n "$id_token" && "$id_token" != "null" ]]; then
        id_payload=$(echo "$id_token" | cut -d'.' -f2)
        padding=$(( 4 - ${#id_payload} % 4 ))
        if [[ $padding -ne 4 ]]; then
          id_payload="${id_payload}$(printf '%*s' "$padding" | tr ' ' '=')"
        fi
        id_decoded=$(echo "$id_payload" | base64 -d 2>/dev/null || echo "$id_payload" | base64 -D 2>/dev/null || echo "{}")

        echo ""
        log_info "=== DECODED ID TOKEN (admin@test.com) ==="
        echo "$id_decoded" | jq '.' 2>/dev/null || echo "$id_decoded"
        echo ""
      fi
    else
      fail "Access token is empty in response"
      log_info "Token response: $token_response"
    fi
  fi
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "  VERIFICATION SUMMARY"
echo "============================================================"
echo -e "  ${GREEN}PASSED:${NC}  $PASS_COUNT"
echo -e "  ${RED}FAILED:${NC}  $FAIL_COUNT"
echo -e "  ${YELLOW}WARNINGS:${NC} $WARN_COUNT"
echo "============================================================"

if [[ $FAIL_COUNT -eq 0 ]]; then
  echo ""
  log_ok "All checks passed! CIAM setup is verified."
  exit 0
else
  echo ""
  log_error "$FAIL_COUNT check(s) failed. Review the errors above."
  exit 1
fi
