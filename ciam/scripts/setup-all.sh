#!/usr/bin/env bash
# setup-all.sh — Run all CIAM setup scripts in order

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/00-helpers.sh"

load_env
require_commands curl jq

echo ""
echo "============================================================"
echo "  CIAM Keycloak Setup — Phase Two"
echo "============================================================"
echo "  Base URL: ${KEYCLOAK_BASE_URL}"
echo "  Realm:    ${KEYCLOAK_REALM}"
echo "============================================================"
echo ""

# Verify connectivity first
log_info "Verifying connectivity to Keycloak..."
get_admin_token
log_ok "Connected to Keycloak successfully"
echo ""

SCRIPTS=(
  "01-configure-realm.sh"
  "02-configure-user-profile.sh"
  "03-configure-social-idps.sh"
  "04-register-clients.sh"
  "05-configure-token-mappers.sh"
  "06-create-organizations.sh"
  "07-create-org-roles.sh"
  "08-create-test-users.sh"
  "09-configure-production-uris.sh"
)

FAILED=0
for script in "${SCRIPTS[@]}"; do
  script_path="$SCRIPT_DIR/$script"
  if [[ ! -f "$script_path" ]]; then
    log_error "Script not found: $script_path"
    FAILED=1
    continue
  fi

  if ! bash "$script_path"; then
    log_error "Script failed: $script"
    FAILED=1
    break
  fi

  echo ""
done

echo ""
echo "============================================================"
if [[ $FAILED -eq 0 ]]; then
  log_ok "All CIAM setup scripts completed successfully"
  echo ""
  log_info "Next steps:"
  echo "  1. Copy the client secrets printed above into your .env"
  echo "  2. Run: bash ciam/test/verify-setup.sh"
else
  log_error "Setup failed — check errors above"
  exit 1
fi
echo "============================================================"
