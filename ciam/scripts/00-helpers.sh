#!/usr/bin/env bash
# 00-helpers.sh — Shared functions for CIAM setup scripts
# Source this file; do not execute it directly.

set -euo pipefail

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ── Logging ──────────────────────────────────────────────────────────────────
log_info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_step()  { echo -e "\n${BLUE}━━━ $* ━━━${NC}"; }

# ── .env Loading ─────────────────────────────────────────────────────────────
# Walk up from the script directory to find the repo root .env
load_env() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[1]:-${BASH_SOURCE[0]}}")" && pwd)"
  local search_dir="$script_dir"

  while [[ "$search_dir" != "/" ]]; do
    if [[ -f "$search_dir/.env" ]]; then
      log_info "Loading .env from $search_dir/.env"
      set -a
      # shellcheck disable=SC1091
      source "$search_dir/.env"
      set +a
      return 0
    fi
    search_dir="$(dirname "$search_dir")"
  done

  log_error ".env file not found (searched upward from $script_dir)"
  exit 1
}

# ── Dependency Check ─────────────────────────────────────────────────────────
require_commands() {
  local missing=0
  for cmd in "$@"; do
    if ! command -v "$cmd" &>/dev/null; then
      log_error "Required command not found: $cmd"
      missing=1
    fi
  done
  if [[ $missing -eq 1 ]]; then
    log_error "Install missing dependencies and re-run."
    exit 1
  fi
}

# ── Admin Token ──────────────────────────────────────────────────────────────
# The token expires in ~60s. Call get_admin_token before each batch of API calls.
_ADMIN_TOKEN=""
_TOKEN_OBTAINED_AT=0

get_admin_token() {
  local now
  now=$(date +%s)
  local elapsed=$(( now - _TOKEN_OBTAINED_AT ))

  # Refresh if token is older than 45 seconds (15s safety margin on 60s expiry)
  if [[ -n "$_ADMIN_TOKEN" && $elapsed -lt 45 ]]; then
    return 0
  fi

  log_info "Refreshing admin token..."
  local response
  # Phase Two hosted Keycloak: authenticate against the realm (not master)
  # The admin user must have realm-management roles assigned
  response=$(curl -sf -X POST \
    "${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "client_id=admin-cli" \
    -d "username=${KEYCLOAK_ADMIN_USER}" \
    -d "password=${KEYCLOAK_ADMIN_PASSWORD}" \
    -d "grant_type=password" 2>&1) || {
    log_error "Failed to obtain admin token. Check KEYCLOAK_BASE_URL, KEYCLOAK_REALM, KEYCLOAK_ADMIN_USER, KEYCLOAK_ADMIN_PASSWORD."
    log_error "Response: $response"
    exit 1
  }

  _ADMIN_TOKEN=$(echo "$response" | jq -r '.access_token')
  if [[ -z "$_ADMIN_TOKEN" || "$_ADMIN_TOKEN" == "null" ]]; then
    log_error "Admin token is empty. Response: $response"
    exit 1
  fi

  _TOKEN_OBTAINED_AT=$(date +%s)
  log_ok "Admin token obtained (expires in ~60s)"
}

# Convenience: returns the current token value
admin_token() {
  echo "$_ADMIN_TOKEN"
}

# ── Keycloak API Helpers ─────────────────────────────────────────────────────
# Wrapper for authenticated GET requests
kc_get() {
  local path="$1"
  get_admin_token
  curl -sf -X GET \
    "${KEYCLOAK_BASE_URL}${path}" \
    -H "Authorization: Bearer $(admin_token)" \
    -H "Content-Type: application/json"
}

# Wrapper for authenticated POST requests; returns HTTP status code
kc_post() {
  local path="$1"
  local data="$2"
  get_admin_token
  curl -s -o /dev/null -w "%{http_code}" -X POST \
    "${KEYCLOAK_BASE_URL}${path}" \
    -H "Authorization: Bearer $(admin_token)" \
    -H "Content-Type: application/json" \
    -d "$data"
}

# POST that returns the response body (for cases where we need the created resource)
kc_post_body() {
  local path="$1"
  local data="$2"
  get_admin_token
  curl -sf -X POST \
    "${KEYCLOAK_BASE_URL}${path}" \
    -H "Authorization: Bearer $(admin_token)" \
    -H "Content-Type: application/json" \
    -d "$data"
}

# Wrapper for authenticated PUT requests; returns HTTP status code
kc_put() {
  local path="$1"
  local data="$2"
  get_admin_token
  curl -s -o /dev/null -w "%{http_code}" -X PUT \
    "${KEYCLOAK_BASE_URL}${path}" \
    -H "Authorization: Bearer $(admin_token)" \
    -H "Content-Type: application/json" \
    -d "$data"
}

# PUT without body (e.g., adding member to org)
kc_put_nobody() {
  local path="$1"
  get_admin_token
  curl -s -o /dev/null -w "%{http_code}" -X PUT \
    "${KEYCLOAK_BASE_URL}${path}" \
    -H "Authorization: Bearer $(admin_token)" \
    -H "Content-Type: application/json"
}

# POST that returns the response body along with HTTP status (for debugging)
kc_post_verbose() {
  local path="$1"
  local data="$2"
  get_admin_token
  local tmpfile
  tmpfile=$(mktemp)
  local status
  status=$(curl -s -w "%{http_code}" -X POST \
    "${KEYCLOAK_BASE_URL}${path}" \
    -H "Authorization: Bearer $(admin_token)" \
    -H "Content-Type: application/json" \
    -d "$data" \
    -o "$tmpfile")
  local body
  body=$(cat "$tmpfile")
  rm -f "$tmpfile"
  echo "${status}|${body}"
}

# ── Idempotency Helpers ─────────────────────────────────────────────────────

# Check if an identity provider with alias exists
idp_exists() {
  local alias="$1"
  local status
  get_admin_token
  status=$(curl -s -o /dev/null -w "%{http_code}" -X GET \
    "${KEYCLOAK_BASE_URL}/admin/realms/${KEYCLOAK_REALM}/identity-provider/instances/${alias}" \
    -H "Authorization: Bearer $(admin_token)")
  [[ "$status" == "200" ]]
}

# Get client UUID by clientId, returns empty string if not found
get_client_uuid() {
  local client_id="$1"
  local result
  result=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/clients?clientId=${client_id}")
  echo "$result" | jq -r '.[0].id // empty'
}

# Check if a protocol mapper exists on a client
mapper_exists() {
  local client_uuid="$1"
  local mapper_name="$2"
  local mappers
  mappers=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/clients/${client_uuid}/protocol-mappers/models")
  echo "$mappers" | jq -e --arg name "$mapper_name" '.[] | select(.name == $name)' &>/dev/null
}

# Get user ID by username/email, returns empty string if not found
get_user_id() {
  local username="$1"
  local result
  result=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/users?username=${username}&exact=true")
  echo "$result" | jq -r '.[0].id // empty'
}

# Get organization ID by name, returns empty string if not found
get_org_id() {
  local org_name="$1"
  local result
  result=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/orgs?search=${org_name}")
  echo "$result" | jq -r --arg name "$org_name" '.[] | select(.name == $name) | .id // empty'
}

# Check if a user is a member of an organization
is_org_member() {
  local org_id="$1"
  local user_id="$2"
  local members
  members=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/orgs/${org_id}/members")
  echo "$members" | jq -e --arg uid "$user_id" '.[] | select(.id == $uid)' &>/dev/null
}

# Check if org role exists
org_role_exists() {
  local org_id="$1"
  local role_name="$2"
  local roles
  roles=$(kc_get "/admin/realms/${KEYCLOAK_REALM}/orgs/${org_id}/roles")
  echo "$roles" | jq -e --arg name "$role_name" '.[] | select(.name == $name)' &>/dev/null
}
