---
title: "Customer Identity & Access Management (CIAM) Specification"
project: ciam-demo-private
sub_project: ciam-demo-private
type: spec
date: 2026-02-07
tags: []
why_private: "contains unpublished architecture decisions and internal specifications"
status: stable
source_repo: https://github.com/jackzhaojin/ciam-demo-private.git
source_tool: claude-code
harvested: 2026-03-28
---

# Customer Identity & Access Management (CIAM) Specification

## Proof of Concept — Identity Provider Setup & Integration Patterns

**Document Purpose:** This specification defines the architecture, setup procedures, and integration patterns for a Customer Identity & Access Management (CIAM) proof of concept. The selected IdP is **Keycloak**, hosted on **Phase Two** (managed cloud), serving as a stand-in for Ping Identity / ForgeRock to learn and validate authentication patterns used in production enterprise CIAM deployments.

**Audience:** This document is intended for both human readers and AI agents that will execute setup scripts, generate further documentation, or build downstream applications that integrate with this IdP.

**Scope:** This specification covers the identity provider only — its setup, configuration, identity brokering, B2B account modeling, and the authentication/authorization patterns it exposes. It does not cover the implementation of consuming applications (Spring Boot backend, Next.js frontend), though it defines the contracts those applications will integrate against.

---

## Table of Contents

- [Part 1: IdP Setup & Configuration](#part-1-idp-setup--configuration)
- [Part 2: Identity Provider Integration & B2B Account Modeling](#part-2-identity-provider-integration--b2b-account-modeling)
- [Part 3: Authentication & Authorization Patterns for Application Integration](#part-3-authentication--authorization-patterns-for-application-integration)
- [Appendix A: Glossary & Concept Mapping (Keycloak → Ping/ForgeRock)](#appendix-a-glossary--concept-mapping-keycloak--pingforgerock)
- [Appendix B: Key URLs & Endpoints](#appendix-b-key-urls--endpoints)

---

## Part 1: IdP Setup & Configuration

### 1.1 Platform Decision

| Factor | Decision | Rationale |
|--------|----------|-----------|
| **IdP Software** | Keycloak (v26.x) | Open-source, CNCF project, full OIDC/OAuth 2.0/SAML 2.0 support. Same standards as Ping/ForgeRock. |
| **Hosting** | Phase Two (free tier) | Cloud-hosted, no infrastructure to manage, free-forever tier with 1 realm, full Admin REST API access, includes Organizations extension for B2B modeling. Team members can access without VPN/tunneling. |
| **Data Storage** | Managed by Phase Two | Phase Two manages the backing PostgreSQL database. No database setup required. All customer identity data (users, credentials, attributes, org membership) stored in their managed infrastructure. |
| **Alternative (Local)** | Docker + PostgreSQL | If full data control is needed later, Keycloak can be self-hosted with `docker compose` and a Postgres volume. API scripts written against Phase Two will work identically against a local instance. |

### 1.2 Manual Setup Steps (Human Required)

These steps require human action and cannot be fully automated via API because they involve account creation and external provider registration.

#### Step 1: Create Phase Two Account

1. Navigate to [https://phasetwo.io](https://phasetwo.io)
2. Sign up for the free tier
3. Create a new deployment — this provisions a Keycloak instance
4. Record the following values:
   - **Keycloak Base URL**: `https://{your-deployment}.phasetwo.io` (exact format may vary)
   - **Admin Username**: (created during signup)
   - **Admin Password**: (created during signup)
   - **Realm Name**: Phase Two creates a default realm — note its name

#### Step 2: Register OAuth Apps with Social Providers

Each social identity provider requires you to register an application in their developer console to obtain a Client ID and Client Secret. Keycloak needs these credentials to broker authentication.

**Google:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Navigate to APIs & Services → Credentials → Create Credentials → OAuth Client ID
4. Application type: Web application
5. Authorized redirect URI: `{KEYCLOAK_BASE_URL}/realms/{REALM}/broker/google/endpoint`
6. Record: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

**Microsoft (Azure AD):**
1. Go to [Azure Portal](https://portal.azure.com/) → Azure Active Directory → App Registrations → New Registration
2. Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
3. Redirect URI: `{KEYCLOAK_BASE_URL}/realms/{REALM}/broker/microsoft/endpoint`
4. Navigate to Certificates & Secrets → New Client Secret
5. Record: `MICROSOFT_CLIENT_ID` (Application ID), `MICROSOFT_CLIENT_SECRET`

**Facebook:**
1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app → Consumer type
3. Add Facebook Login product
4. Valid OAuth Redirect URI: `{KEYCLOAK_BASE_URL}/realms/{REALM}/broker/facebook/endpoint`
5. Record: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`

> **Note for AI agents:** The credentials from Step 2 will be provided as environment variables or secrets when executing the setup scripts in Step 3. Do not hardcode these values.

#### Step 3: Obtain Admin API Token

This step bridges manual setup to automated configuration. All subsequent configuration is performed via API.

```bash
# Environment variables (set these from Steps 1 and 2)
export KC_BASE_URL="https://{your-deployment}.phasetwo.io"
export KC_REALM="your-realm-name"
export KC_ADMIN_USER="admin"
export KC_ADMIN_PASSWORD="your-admin-password"

# Obtain admin access token
ACCESS_TOKEN=$(curl -s -X POST \
  "${KC_BASE_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=admin-cli" \
  -d "username=${KC_ADMIN_USER}" \
  -d "password=${KC_ADMIN_PASSWORD}" \
  -d "grant_type=password" \
  | jq -r '.access_token')

echo "Token obtained (expires in 60s): ${ACCESS_TOKEN:0:20}..."
```

> **Important:** The admin access token has a short lifespan (typically 60 seconds). Scripts must refresh this token before each batch of API calls. AI agents executing these scripts should implement a token refresh wrapper.

### 1.3 Automated Configuration via API

Everything below is executed via the Keycloak Admin REST API. These operations can be scripted and run by AI agents.

#### 1.3.1 Realm Configuration

The realm is the top-level container for all CIAM configuration. Phase Two's free tier provides one realm. Configure it for customer-facing use:

```bash
# Update realm settings for CIAM use case
curl -s -X PUT \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "registrationAllowed": true,
    "registrationEmailAsUsername": true,
    "resetPasswordAllowed": true,
    "rememberMe": true,
    "verifyEmail": true,
    "loginWithEmailAllowed": true,
    "duplicateEmailsAllowed": false,
    "sslRequired": "external",
    "bruteForceProtected": true,
    "maxFailureWaitSeconds": 900,
    "failureFactor": 5,
    "accessTokenLifespan": 300,
    "ssoSessionIdleTimeout": 1800,
    "ssoSessionMaxLifespan": 36000
  }'
```

**What this does:**
- Enables customer self-registration (critical for CIAM)
- Uses email as the username (standard CIAM pattern)
- Enables password reset flow
- Enables email verification on registration
- Configures brute force protection (locks after 5 failures)
- Sets token lifespans (5-minute access tokens, 30-minute idle session, 10-hour max session)

#### 1.3.2 Custom User Profile Attributes

Define the custom attributes that will be stored on customer user records:

```bash
# Get current user profile configuration
curl -s -X GET \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/users/profile" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json"

# Update user profile to add custom CIAM attributes
curl -s -X PUT \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/users/profile" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

**What this does:**
- Defines the user profile schema for customer accounts
- `loyaltyTier` is an example business attribute — admin-editable only, visible to the user
- `phoneNumber` supports progressive profiling (customer can add it later)

> **Note:** Account numbers and organization membership are handled via the Organizations extension (see Part 2), not as flat user attributes.

#### 1.3.3 Configure Social Identity Providers

These API calls register the external identity providers using the credentials obtained in Step 2.

**Google:**
```bash
curl -s -X POST \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/identity-provider/instances" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
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
  }"
```

**Microsoft:**
```bash
curl -s -X POST \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/identity-provider/instances" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
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
  }"
```

**Facebook:**
```bash
curl -s -X POST \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/identity-provider/instances" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
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
  }"
```

**What these do:**
- Register each social provider as an identity broker
- `trustEmail: true` means Keycloak trusts the email from Google/Microsoft/Facebook without additional verification
- `syncMode: IMPORT` creates a local Keycloak user on first login, linked to the social account
- `firstBrokerLoginFlowAlias` controls what happens on the first social login (see Section 2.2)

#### 1.3.4 Configure Identity Provider Mappers

Map claims from social providers into Keycloak user attributes:

```bash
# Example: Map Google profile picture to user attribute
curl -s -X POST \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/identity-provider/instances/google/mappers" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "picture-mapper",
    "identityProviderAlias": "google",
    "identityProviderMapper": "hardcoded-attribute-idp-mapper",
    "config": {
      "syncMode": "INHERIT",
      "attribute": "picture",
      "attribute.value": ""
    }
  }'
```

> **Note for AI agents:** The specific mapper types and configurations vary per provider. Consult the Keycloak documentation for the full list of available identity provider mapper types. The general pattern is `POST /admin/realms/{realm}/identity-provider/instances/{alias}/mappers`.

#### 1.3.5 Register Application Clients

Each consuming application needs to be registered as a client in Keycloak. This section defines the clients; Part 3 explains the patterns they support.

**~~Client 1: poc-frontend~~ — REMOVED**

> The architecture uses the BFF pattern exclusively. The `poc-bff` confidential client handles all user-facing auth flows. A public `poc-frontend` client is not registered — it would be an unnecessary security surface. See Pattern 2 (BFF) below.

**Client 1: Spring Boot Backend (Confidential Client — Client Credentials)**
```bash
curl -s -X POST \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/clients" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
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
    "secret": "GENERATE_A_STRONG_SECRET_HERE",
    "defaultClientScopes": ["openid", "email", "profile"],
    "optionalClientScopes": []
  }'
```

**Client 2: Backend-for-Frontend (Confidential Client — Authorization Code)**
```bash
curl -s -X POST \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/clients" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "poc-bff",
    "name": "PoC Backend-for-Frontend",
    "description": "Confidential client for BFF pattern — Next.js server-side + Spring Boot",
    "enabled": true,
    "publicClient": false,
    "directAccessGrantsEnabled": false,
    "standardFlowEnabled": true,
    "implicitFlowEnabled": false,
    "serviceAccountsEnabled": false,
    "protocol": "openid-connect",
    "secret": "GENERATE_A_STRONG_SECRET_HERE",
    "redirectUris": [
      "http://localhost:8080/login/oauth2/code/keycloak",
      "http://localhost:3000/api/auth/callback/keycloak"
    ],
    "webOrigins": ["http://localhost:3000", "http://localhost:8080"],
    "defaultClientScopes": ["openid", "email", "profile"],
    "optionalClientScopes": ["offline_access"]
  }'
```

> **Note for AI agents:** After creating confidential clients, retrieve the generated client secret via `GET /admin/realms/{realm}/clients/{client-uuid}/client-secret`. Store these securely as environment variables for the consuming applications.

#### 1.3.6 Configure Token Claim Mappers (Protocol Mappers)

These mappers control what custom claims appear in the JWT tokens issued to applications:

```bash
# First, get the client UUID for poc-bff
CLIENT_UUID=$(curl -s -X GET \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/clients?clientId=poc-bff" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  | jq -r '.[0].id')

# Add loyalty tier as a token claim
curl -s -X POST \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/clients/${CLIENT_UUID}/protocol-mappers/models" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "loyalty-tier-mapper",
    "protocol": "openid-connect",
    "protocolMapper": "oidc-usermodel-attribute-mapper",
    "config": {
      "user.attribute": "loyaltyTier",
      "claim.name": "loyalty_tier",
      "jsonType.label": "String",
      "id.token.claim": "true",
      "access.token.claim": "true",
      "userinfo.token.claim": "true",
      "multivalued": "false"
    }
  }'

# Add organization membership as a token claim (Phase Two extension)
# Phase Two provides a built-in "Organization" protocol mapper type.
# This must be explicitly added to the client — it is NOT automatic.

# Step 1: Add the organizations mapper to poc-bff
curl -s -X POST \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/clients/${CLIENT_UUID}/protocol-mappers/models" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "organizations-mapper",
    "protocol": "openid-connect",
    "protocolMapper": "oidc-organization-membership-mapper",
    "config": {
      "id.token.claim": "true",
      "access.token.claim": "true",
      "userinfo.token.claim": "true"
    }
  }'

# IMPORTANT: The exact protocolMapper type name ("oidc-organization-membership-mapper")
# must be verified against your Phase Two deployment. To list available mapper types:
# GET ${KC_BASE_URL}/admin/realms/${KC_REALM}/protocol-mapper/types/openid-connect
# Look for mapper types containing "organization" in the name.
# Phase Two versions may use different mapper names — verify before running.

# Step 2: Also add the mapper to poc-backend (for client credentials calls that
# need org context, if applicable)
BACKEND_UUID=$(curl -s -X GET \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/clients?clientId=poc-backend" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  | jq -r '.[0].id')

curl -s -X POST \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/clients/${BACKEND_UUID}/protocol-mappers/models" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "organizations-mapper",
    "protocol": "openid-connect",
    "protocolMapper": "oidc-organization-membership-mapper",
    "config": {
      "id.token.claim": "true",
      "access.token.claim": "true",
      "userinfo.token.claim": "true"
    }
  }'
```

#### 1.3.7 JWKS and Key Management

Keycloak automatically generates RSA and/or EC key pairs for token signing. To inspect and manage these:

```bash
# List realm keys (signing and encryption keys)
curl -s -X GET \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/keys" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  | jq '.keys[] | {kid, algorithm, type, status, use}'

# The public JWKS endpoint (no auth required — this is what applications use)
curl -s "${KC_BASE_URL}/realms/${KC_REALM}/protocol/openid-connect/certs" | jq .

# The well-known OIDC discovery document (no auth required)
curl -s "${KC_BASE_URL}/realms/${KC_REALM}/.well-known/openid-configuration" | jq .
```

**What this means for applications:** Consuming applications validate tokens by fetching the JWKS from the public endpoint and checking the token signature against the published keys. Applications should cache the JWKS and refresh it periodically. When Keycloak rotates keys, the old key remains in the JWKS for a configurable grace period so existing tokens remain valid.

**How this maps to Ping:** Ping/ForgeRock uses the same JWKS mechanism. The `.well-known/openid-configuration` endpoint is an OIDC standard — every compliant IdP publishes it. The key rotation patterns are identical.

---

## Part 2: Identity Provider Integration & B2B Account Modeling

### 2.1 Authentication Methods Overview

The IdP supports multiple authentication methods simultaneously. A customer visiting the login page sees all enabled options and chooses how to authenticate. Regardless of method chosen, the application receives an identical token format.

| Method | Type | How It Works | Configuration |
|--------|------|-------------|---------------|
| **Email + Password** | Local credentials | Keycloak stores bcrypt-hashed password. Customer self-registers or is created via API. | Enabled by default. Self-registration enabled in Section 1.3.1. |
| **Google** | Social broker (OIDC) | Keycloak redirects to Google, receives Google ID token, creates/links local user. | Configured in Section 1.3.3. Requires Google OAuth app. |
| **Microsoft** | Social broker (OIDC) | Same pattern as Google but against Microsoft's identity platform. | Configured in Section 1.3.3. Requires Azure AD app registration. |
| **Facebook** | Social broker (OAuth 2.0) | Same pattern, Facebook-specific OAuth flow. | Configured in Section 1.3.3. Requires Facebook developer app. |
| **Enterprise SAML/OIDC** | Federated broker | For B2B — a customer's company runs their own IdP (e.g., Okta, Azure AD). Keycloak federates with it. | Configured per-organization via API (see Section 2.4). |
| **Passkeys / WebAuthn** | Passwordless | FIDO2-compliant passwordless authentication using biometrics or hardware keys. | Enabled via authentication flow configuration in Keycloak. |

### 2.2 First Login Flow (Account Linking)

When a customer authenticates via a social provider for the first time, Keycloak runs the "first broker login" flow. This determines how social identities are linked to Keycloak accounts.

**Default behavior (recommended for CIAM):**

1. Customer clicks "Sign in with Google"
2. Google authenticates the customer and returns profile (email, name)
3. Keycloak checks: does a local account with this email already exist?
   - **No match:** Keycloak creates a new local user, links it to the Google identity. Customer proceeds.
   - **Match found:** Keycloak prompts the customer to verify ownership of the existing account (e.g., by entering their existing password) and then links the Google identity to that account.
4. On all subsequent logins via Google, Keycloak recognizes the linked identity and authenticates immediately.

**API to configure the first broker login flow:**

```bash
# List authentication flows
curl -s -X GET \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/authentication/flows" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  | jq '.[] | {id, alias, description}'

# The "first broker login" flow is created by default
# To customize it (e.g., auto-link by email without verification for trusted providers):
# 1. Copy the flow
# 2. Modify executions to change the linking behavior
# 3. Assign the custom flow to specific identity providers
```

> **Note for AI agents:** Customizing authentication flows involves multiple API calls to copy flows, add/remove executions, and reorder steps. The Keycloak Admin API endpoints are under `/admin/realms/{realm}/authentication/flows` and `/authentication/executions`. This is an area where reviewing the current flow structure before making changes is important.

### 2.3 Account Linking: Multi-Provider Identities

A single customer can have multiple identity providers linked to their account. For example:
- Customer registers with email + password
- Later clicks "Link Google Account" in their account management portal
- Later clicks "Link Microsoft Account"
- All three methods now authenticate to the same Keycloak user, same user ID, same token claims

Keycloak provides an Account Management Console at `{KC_BASE_URL}/realms/{REALM}/account` where customers can self-manage their linked identity providers, profile, password, and MFA settings.

The federated identity links can also be managed via API:

```bash
# List identity provider links for a user
curl -s -X GET \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/users/{USER_ID}/federated-identity" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"

# Programmatically link a social identity to an existing user
curl -s -X POST \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/users/{USER_ID}/federated-identity/google" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "identityProvider": "google",
    "userId": "google-subject-id-here",
    "userName": "customer@gmail.com"
  }'
```

### 2.4 B2B Account/Organization Modeling

This section addresses the many-to-many relationship between customers and accounts (organizations). Phase Two's Organizations extension provides first-class support for this pattern.

#### 2.4.1 Data Model

```
┌─────────────┐       ┌──────────────────────┐       ┌─────────────┐
│   Customer   │ M───N │  Organization        │       │ Org Roles   │
│   (User)     │       │  (Account)           │       │             │
├─────────────┤       ├──────────────────────┤       ├─────────────┤
│ id (UUID)    │       │ id (UUID)            │       │ name        │
│ email        │       │ name                 │       │ description │
│ firstName    │       │ displayName          │       │             │
│ lastName     │       │ domains[]            │       │             │
│ loyaltyTier  │       │ attributes{}         │       │             │
│ phoneNumber  │       │ idpLink (optional)   │       │             │
└─────────────┘       └──────────────────────┘       └─────────────┘
                               │
                      ┌────────┴────────┐
                      │   Membership    │
                      ├─────────────────┤
                      │ userId          │
                      │ organizationId  │
                      │ roles[]         │
                      └─────────────────┘
```

**Key relationships:**
- One customer can belong to many organizations (accounts)
- One organization can have many customers (users)
- Each membership carries its own set of roles (admin in Org A, viewer in Org B)
- Organizations can optionally have their own identity provider (e.g., Org A's users authenticate via Org A's corporate Azure AD)

#### 2.4.2 Organization Setup via API

Phase Two exposes an Organizations API as an extension on top of Keycloak's Admin API:

```bash
# Create an organization (account)
curl -s -X POST \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/orgs" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "acme-corp",
    "displayName": "Acme Corporation",
    "domains": ["acme-corp.com"],
    "attributes": {
      "accountNumber": ["ACC-001"],
      "industry": ["manufacturing"],
      "contractTier": ["enterprise"]
    }
  }'

# Create a second organization
curl -s -X POST \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/orgs" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "globex-inc",
    "displayName": "Globex Inc.",
    "domains": ["globex.com"],
    "attributes": {
      "accountNumber": ["ACC-003"],
      "industry": ["technology"],
      "contractTier": ["standard"]
    }
  }'
```

#### 2.4.3 Organization Roles

```bash
# Get the organization ID (from the create response or by listing)
ORG_ID="uuid-of-acme-corp"

# Create roles within an organization
curl -s -X POST \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/orgs/${ORG_ID}/roles" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{ "name": "admin", "description": "Full account administration" }'

curl -s -X POST \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/orgs/${ORG_ID}/roles" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{ "name": "billing", "description": "Billing and invoice access" }'

curl -s -X POST \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/orgs/${ORG_ID}/roles" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{ "name": "viewer", "description": "Read-only access" }'
```

#### 2.4.4 Assign Users to Organizations

```bash
# Add a user to an organization with specific roles
curl -s -X PUT \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/orgs/${ORG_ID}/members/${USER_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"

# Grant roles to the user within the organization
curl -s -X POST \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/orgs/${ORG_ID}/members/${USER_ID}/roles" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '[
    { "name": "admin" },
    { "name": "billing" }
  ]'

# Same user, different org, different roles
GLOBEX_ORG_ID="uuid-of-globex-inc"
curl -s -X PUT \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/orgs/${GLOBEX_ORG_ID}/members/${USER_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"

curl -s -X POST \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/orgs/${GLOBEX_ORG_ID}/members/${USER_ID}/roles" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '[
    { "name": "viewer" }
  ]'
```

#### 2.4.5 Organization-Specific Identity Providers

For B2B scenarios where an organization wants their users to authenticate via their own corporate IdP:

```bash
# Link an OIDC identity provider to an organization
# First, create the IdP instance (similar to social providers)
curl -s -X POST \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/identity-provider/instances" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "alias": "acme-corp-azure-ad",
    "providerId": "oidc",
    "enabled": true,
    "trustEmail": true,
    "config": {
      "clientId": "ACME_AZURE_AD_CLIENT_ID",
      "clientSecret": "ACME_AZURE_AD_CLIENT_SECRET",
      "authorizationUrl": "https://login.microsoftonline.com/ACME_TENANT_ID/oauth2/v2.0/authorize",
      "tokenUrl": "https://login.microsoftonline.com/ACME_TENANT_ID/oauth2/v2.0/token",
      "userInfoUrl": "https://graph.microsoft.com/oidc/userinfo",
      "defaultScope": "openid email profile",
      "syncMode": "IMPORT"
    }
  }'

# Then link it to the organization via Phase Two's API
curl -s -X POST \
  "${KC_BASE_URL}/admin/realms/${KC_REALM}/orgs/${ORG_ID}/idps" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "alias": "acme-corp-azure-ad"
  }'
```

**What this enables:** When a user with an `@acme-corp.com` email visits the login page, Keycloak can automatically redirect them to Acme Corp's Azure AD — they never see the Keycloak login form. This is the same pattern Ping uses with "Connection-based routing" or "Home Realm Discovery."

#### 2.4.6 Token Structure with Organization Claims

When configured correctly, the JWT token issued by Keycloak will include organization membership. The exact claim structure depends on Phase Two's extension configuration, but conceptually:

```json
{
  "sub": "a1b2c3d4-user-uuid",
  "email": "jane.doe@example.com",
  "email_verified": true,
  "name": "Jane Doe",
  "given_name": "Jane",
  "family_name": "Doe",
  "loyalty_tier": "gold",
  "organizations": {
    "acme-corp": {
      "id": "org-uuid-001",
      "name": "Acme Corporation",
      "roles": ["admin", "billing"],
      "attributes": {
        "accountNumber": "ACC-001"
      }
    },
    "globex-inc": {
      "id": "org-uuid-003",
      "name": "Globex Inc.",
      "roles": ["viewer"],
      "attributes": {
        "accountNumber": "ACC-003"
      }
    }
  },
  "iss": "https://your-deployment.phasetwo.io/realms/your-realm",
  "aud": "poc-frontend",
  "exp": 1738900000,
  "iat": 1738899700
}
```

> **CRITICAL — Verification Required:** The token structure above is a *target*, not a guarantee. The exact claim format depends on Phase Two's Organizations extension version and the specific mapper type used (`oidc-organization-membership-mapper` or similar). The CIAM setup verification script (`ciam/test/verify-setup.sh`) **must**:
> 1. Obtain a token for a test user who belongs to at least one organization with roles
> 2. Decode the JWT and print the raw `organizations` claim (or whatever claim name Phase Two uses)
> 3. Document the **exact** claim structure in the script output
> 4. This verified structure becomes the contract that Spring Boot and Next.js code against
>
> If the actual structure differs from the conceptual example above (e.g., different claim name, flat array instead of nested object, different role format), the Spring Boot `JwtAuthenticationConverter` and Next.js Auth.js callbacks must be adapted to match the **actual** structure, not this example.

### 2.5 Separation of Concerns: What Lives Where

| Data | Stored In | Rationale |
|------|-----------|-----------|
| Customer identity (email, name, password hash) | Keycloak | Core IdP responsibility |
| Authentication method links (Google, Microsoft, etc.) | Keycloak | Federated identity management |
| Organization/account membership & roles | Keycloak (Organizations extension) | Authorization context, embedded in tokens |
| Organization metadata (account number, tier, industry) | Keycloak organization attributes | Needed in tokens for application routing |
| Business data (orders, invoices, products, transactions) | Application database (Spring Boot) | Business domain — not identity |
| User preferences, app-specific settings | Application database (Spring Boot) | Application concerns, keyed by Keycloak user UUID |

**Design principle:** Keycloak answers "who is this person, how did they prove it, and where do they belong." The application answers "what can they see and do within the business domain." Use the Keycloak `sub` (user UUID) and organization IDs as foreign keys in the application database.

---

## Part 3: Authentication & Authorization Patterns for Application Integration

This section defines the authentication patterns the IdP must support and how consuming applications interact with it. The focus is on the IdP's configuration and contract — not the application implementation.

### 3.1 Pattern Overview

| # | Pattern | Client Type | Use Case | Keycloak Client |
|---|---------|-------------|----------|-----------------|
| ~~1~~ | ~~Authorization Code + PKCE~~ | ~~Public~~ | ~~Browser SPA directly authenticating users~~ | ~~`poc-frontend`~~ — **Not used in this PoC. BFF pattern preferred. Documented for reference only.** |
| 2 | Authorization Code (Confidential) | Confidential | Backend-for-Frontend pattern — server handles token exchange (primary auth flow for this PoC) | `poc-bff` |
| 3 | Client Credentials | Confidential | Service-to-service — no user context | `poc-backend` |
| 4 | Token Introspection | N/A | Backend validates opaque tokens against the IdP | Any confidential client |
| 5 | Token Refresh | Public or Confidential | Silently extending user sessions without re-authentication | `poc-frontend`, `poc-bff` |
| 6 | Social Login Brokering | N/A (IdP-side) | Customer chooses Google/Microsoft/Facebook to authenticate | All clients (IdP handles broker) |

### 3.2 Pattern 1: Authorization Code + PKCE (Browser SPA)

**What it is:** The recommended flow for single-page applications where the client cannot securely store a secret. PKCE (Proof Key for Code Exchange) prevents authorization code interception attacks.

**IdP contract:**

```
1. App redirects browser to:
   GET {KC_BASE_URL}/realms/{REALM}/protocol/openid-connect/auth
     ?client_id=poc-frontend
     &response_type=code
     &redirect_uri=http://localhost:3000/callback
     &scope=openid email profile
     &state={random}
     &code_challenge={SHA256(code_verifier)}
     &code_challenge_method=S256

2. Keycloak presents login page (email/password + social buttons)

3. After authentication, Keycloak redirects to:
   http://localhost:3000/callback?code={auth_code}&state={state}

4. App exchanges code for tokens:
   POST {KC_BASE_URL}/realms/{REALM}/protocol/openid-connect/token
     Content-Type: application/x-www-form-urlencoded
     grant_type=authorization_code
     &client_id=poc-frontend
     &code={auth_code}
     &redirect_uri=http://localhost:3000/callback
     &code_verifier={original_code_verifier}

5. Keycloak returns:
   {
     "access_token": "eyJ...",
     "id_token": "eyJ...",
     "refresh_token": "eyJ...",
     "expires_in": 300,
     "token_type": "Bearer"
   }
```

**Keycloak configuration requirements (already done in Section 1.3.5):**
- Client `poc-frontend`: `publicClient: true`, `standardFlowEnabled: true`
- PKCE enforced via `pkce.code.challenge.method: S256`
- Redirect URIs and web origins configured

**Ping equivalent:** PingOne / PingFederate Authorization Code flow with PKCE — identical standard.

### 3.3 Pattern 2: Authorization Code — Confidential (Backend-for-Frontend)

**What it is:** A server-side application (Spring Boot or Next.js API routes) handles the OAuth flow. The client secret is stored securely on the server, never exposed to the browser. The server exchanges the authorization code for tokens, stores them in a server-side session, and proxies API calls on behalf of the user.

**IdP contract:**

```
1. Server redirects browser to Keycloak (same as Pattern 1, but with poc-bff client ID)

2. After authentication, Keycloak redirects to:
   http://localhost:8080/login/oauth2/code/keycloak?code={auth_code}&state={state}

3. Server exchanges code for tokens (server-side, includes client secret):
   POST {KC_BASE_URL}/realms/{REALM}/protocol/openid-connect/token
     Content-Type: application/x-www-form-urlencoded
     grant_type=authorization_code
     &client_id=poc-bff
     &client_secret={CLIENT_SECRET}
     &code={auth_code}
     &redirect_uri=http://localhost:8080/login/oauth2/code/keycloak

4. Server receives tokens and stores them in session (never sent to browser)
```

**Keycloak configuration requirements (already done in Section 1.3.5):**
- Client `poc-bff`: `publicClient: false`, `standardFlowEnabled: true`, `serviceAccountsEnabled: false`
- Client secret generated and stored in server configuration

**Why this pattern matters:** This is considered more secure than Pattern 1 for applications that have a server component, because the access token never touches the browser. It's the pattern Ping recommends for production CIAM deployments.

### 3.4 Pattern 3: Client Credentials (Service-to-Service)

**What it is:** A backend service authenticates as itself (not on behalf of a user). There is no user context — this is for machine-to-machine communication. For example, a batch processing service that needs to call the Keycloak Admin API, or a microservice that needs to validate its own identity to another microservice.

**IdP contract:**

```
1. Service requests token directly:
   POST {KC_BASE_URL}/realms/{REALM}/protocol/openid-connect/token
     Content-Type: application/x-www-form-urlencoded
     grant_type=client_credentials
     &client_id=poc-backend
     &client_secret={CLIENT_SECRET}
     &scope=openid

2. Keycloak returns:
   {
     "access_token": "eyJ...",
     "expires_in": 300,
     "token_type": "Bearer"
   }
   (No id_token or refresh_token — there's no user)
```

**Keycloak configuration requirements (already done in Section 1.3.5):**
- Client `poc-backend`: `publicClient: false`, `serviceAccountsEnabled: true`, `standardFlowEnabled: false`
- Assign appropriate service account roles if the service needs admin API access

**Ping equivalent:** PingFederate Client Credentials grant — identical standard.

### 3.5 Pattern 4: Token Introspection

**What it is:** A resource server (API backend) receives a token from a client and needs to validate it. There are two approaches:

**Approach A — Local validation (recommended, no IdP call needed):**
1. Backend fetches JWKS from `{KC_BASE_URL}/realms/{REALM}/protocol/openid-connect/certs`
2. Backend caches the JWKS keys
3. For each incoming request, backend verifies the JWT signature against the cached keys
4. Backend checks token expiration, issuer, audience claims

**Approach B — Token introspection endpoint (for opaque tokens or additional validation):**
```
POST {KC_BASE_URL}/realms/{REALM}/protocol/openid-connect/token/introspect
  Content-Type: application/x-www-form-urlencoded
  client_id=poc-backend
  &client_secret={CLIENT_SECRET}
  &token={access_token}

Response:
{
  "active": true,
  "sub": "user-uuid",
  "email": "jane@example.com",
  "realm_access": { "roles": ["customer"] },
  "client_id": "poc-frontend",
  "exp": 1738900000,
  ...
}
```

**When to use which:** Local JWT validation (Approach A) is faster and doesn't require a network call for every API request. Use introspection (Approach B) when you need real-time revocation checking or when working with opaque tokens.

### 3.6 Pattern 5: Token Refresh

**What it is:** Access tokens are short-lived (5 minutes as configured). To keep the user's session active without re-authentication, the client uses the refresh token to obtain new access tokens.

**IdP contract:**

```
POST {KC_BASE_URL}/realms/{REALM}/protocol/openid-connect/token
  Content-Type: application/x-www-form-urlencoded
  grant_type=refresh_token
  &client_id=poc-frontend
  &refresh_token={refresh_token}

Response:
{
  "access_token": "eyJ...(new)",
  "refresh_token": "eyJ...(rotated)",
  "expires_in": 300
}
```

**Important CIAM consideration:** Keycloak rotates the refresh token on each use (refresh token rotation). The old refresh token is immediately invalidated. This prevents replay attacks if a refresh token is compromised. This behavior is configurable in realm settings.

### 3.7 Pattern 6: Social Login Brokering (IdP-Side)

**What it is:** This is not a separate application integration pattern — it's transparent to the application. The application always redirects to Keycloak's authorization endpoint. Keycloak's login page presents all available authentication options (email/password, Google, Microsoft, Facebook). The customer chooses. Keycloak handles the entire broker flow and returns a Keycloak-issued token to the application regardless of which method was used.

**Application integration impact:** None. The application code is identical whether the user logs in with a password or Google. The only difference is the `identity_provider` claim in the token, which tells the application how the user authenticated (useful for audit logging).

**IdP configuration:** Completed in Sections 1.3.3 and 2.4.5. No additional application-side configuration needed.

### 3.8 Logout Patterns

**Single Logout (SLO):** When a customer logs out of one application, they should be logged out of all applications connected to the same Keycloak session.

**IdP contract:**

```
# Front-channel logout (browser redirect)
GET {KC_BASE_URL}/realms/{REALM}/protocol/openid-connect/logout
  ?client_id=poc-frontend
  &post_logout_redirect_uri=http://localhost:3000
  &id_token_hint={id_token}

# Back-channel logout (server-to-server notification)
# Keycloak sends POST to each client's registered backchannel logout URL
# Configure in client settings:
#   "attributes": { "backchannel.logout.url": "http://localhost:8080/logout/callback" }
```

### 3.9 OIDC Discovery — The Universal Contract

All patterns above are discoverable via the standard OIDC discovery document:

```
GET {KC_BASE_URL}/realms/{REALM}/.well-known/openid-configuration
```

This returns all endpoints (authorization, token, introspection, JWKS, logout, userinfo), supported grant types, supported scopes, supported signing algorithms, and more. Any OIDC-compliant library (Spring Security, next-auth, etc.) can auto-configure itself from this single URL.

**This is the primary integration point.** Consuming applications should be configured with this URL and the client ID/secret — nothing else. The application library discovers everything it needs.

---

## Appendix A: Glossary & Concept Mapping (Keycloak → Ping/ForgeRock)

| Keycloak Concept | Ping/ForgeRock Equivalent | Description |
|-----------------|--------------------------|-------------|
| Realm | Environment / Tenant | Top-level isolation boundary for identity configuration |
| Client | Application / OAuth Client | A registered application that authenticates via the IdP |
| Identity Provider (Broker) | External IdP / Connection | A federated identity source (Google, Azure AD, SAML) |
| User | User / Digital Identity | A customer's identity record |
| User Attributes | User Profile Schema | Custom properties on a user (loyalty tier, phone) |
| Groups | Populations / Groups | Organizational grouping of users |
| Organizations (Phase Two) | Populations / Organizations | B2B multi-tenant account modeling |
| Realm Roles | Roles | Global permissions |
| Client Roles | Application Roles | Permissions scoped to a specific application |
| Authentication Flow | Authentication Policy / Policy Tree | The sequence of steps for authentication (password → MFA → consent) |
| Protocol Mapper | Attribute Mapping / Token Customization | Rules for including user/org data in JWT claims |
| First Broker Login Flow | Identity Linking Policy | Rules for what happens when a user first authenticates via a social/federated provider |
| JWKS Endpoint | JWKS Endpoint | Public key set for token signature verification (identical standard) |
| Well-Known Configuration | Discovery Endpoint | OIDC discovery document (identical standard) |

## Appendix B: Key URLs & Endpoints

All URLs below assume `{BASE}` = your Phase Two Keycloak base URL and `{REALM}` = your realm name.

**Public endpoints (no authentication required):**

| Endpoint | URL |
|----------|-----|
| OIDC Discovery | `{BASE}/realms/{REALM}/.well-known/openid-configuration` |
| JWKS (Public Keys) | `{BASE}/realms/{REALM}/protocol/openid-connect/certs` |
| Authorization | `{BASE}/realms/{REALM}/protocol/openid-connect/auth` |
| Token | `{BASE}/realms/{REALM}/protocol/openid-connect/token` |
| UserInfo | `{BASE}/realms/{REALM}/protocol/openid-connect/userinfo` |
| Logout | `{BASE}/realms/{REALM}/protocol/openid-connect/logout` |
| Account Console | `{BASE}/realms/{REALM}/account` |
| Registration | `{BASE}/realms/{REALM}/protocol/openid-connect/registrations` |

**Admin API endpoints (require admin bearer token):**

| Resource | URL Pattern |
|----------|------------|
| Realms | `{BASE}/admin/realms/{REALM}` |
| Users | `{BASE}/admin/realms/{REALM}/users` |
| Clients | `{BASE}/admin/realms/{REALM}/clients` |
| Identity Providers | `{BASE}/admin/realms/{REALM}/identity-provider/instances` |
| Authentication Flows | `{BASE}/admin/realms/{REALM}/authentication/flows` |
| Realm Keys | `{BASE}/admin/realms/{REALM}/keys` |
| Organizations (Phase Two) | `{BASE}/admin/realms/{REALM}/orgs` |
| Org Members | `{BASE}/admin/realms/{REALM}/orgs/{ORG_ID}/members` |
| Org Roles | `{BASE}/admin/realms/{REALM}/orgs/{ORG_ID}/roles` |
| Token Introspection | `{BASE}/realms/{REALM}/protocol/openid-connect/token/introspect` |

---

*Document generated from CIAM proof-of-concept planning session. This specification covers the identity provider layer only. Companion documents will cover the Spring Boot backend integration, Next.js frontend integration, and the testing harness application.*
