# Auth Patterns (v1.3)

5 sequence diagrams for PKCE login and Java token validation.

## 1) PKCE login: password to auth code to token

```mermaid
sequenceDiagram
    actor User
    participant Browser as NextJS Login UI
    participant NextAPI as NextJS PKCE Proxy
    participant CIAM as CIAM Keycloak
    participant Java as Spring Boot Auth API

    User->>Browser: Pick strategy and enter email/password
    Browser->>NextAPI: get-login-form(auth url)
    NextAPI->>CIAM: GET /auth
    CIAM-->>NextAPI: login form action + cookies
    NextAPI-->>Browser: form action + cookies
    Browser->>NextAPI: submit-credentials(email,password,cookies)
    NextAPI->>CIAM: POST login-actions/authenticate
    CIAM-->>NextAPI: redirect with auth code
    NextAPI-->>Browser: auth code
    Browser->>Java: POST /api/auth/pkce-callback(code, verifier, strategy)
    Java->>CIAM: POST /token(code + verifier)
    CIAM-->>Java: access token
    Java-->>Browser: validation result
```

## 2) Java flow: JWKS Vanilla

```mermaid
sequenceDiagram
    participant Browser as NextJS Login UI
    participant Java as Spring Boot Auth API
    participant CIAM as CIAM Keycloak

    Browser->>Java: pkce-callback(code, verifier, jwks-vanilla)
    Java->>CIAM: POST /token
    CIAM-->>Java: access token (JWT)
    Java->>CIAM: GET /certs (JWKS)
    CIAM-->>Java: public keys
    Java->>Java: Parse JWT header and payload
    Java->>Java: Pick key by kid
    Java->>Java: Verify RSA signature
    Java->>Java: Check exp and iss
    Java-->>Browser: PASS or FAIL + claims
```

## 3) Java flow: JWKS Nimbus

```mermaid
sequenceDiagram
    participant Browser as NextJS Login UI
    participant Java as Spring Boot Auth API
    participant CIAM as CIAM Keycloak

    Browser->>Java: pkce-callback(code, verifier, jwks-nimbus)
    Java->>CIAM: POST /token
    CIAM-->>Java: access token (JWT)
    Java->>CIAM: GET /certs (JWKS)
    CIAM-->>Java: public keys
    Java->>Java: Nimbus parse JWT
    Java->>Java: Nimbus verify signature
    Java->>Java: Nimbus check claims
    Java-->>Browser: PASS or FAIL + claims
```

## 4) Java flow: Introspection Vanilla HTTP

```mermaid
sequenceDiagram
    participant Browser as NextJS Login UI
    participant Java as Spring Boot Auth API
    participant CIAM as CIAM Keycloak

    Browser->>Java: pkce-callback(code, verifier, introspection-vanilla)
    Java->>CIAM: POST /token
    CIAM-->>Java: access token
    Java->>CIAM: POST /token/introspect(token, client auth)
    CIAM-->>Java: active true or false + claims
    Java->>Java: Check active true
    Java->>Java: Read claim fields
    Java-->>Browser: PASS or FAIL + claims
```

## 5) Java flow: Introspection Nimbus

```mermaid
sequenceDiagram
    participant Browser as NextJS Login UI
    participant Java as Spring Boot Auth API
    participant CIAM as CIAM Keycloak

    Browser->>Java: pkce-callback(code, verifier, introspection-nimbus)
    Java->>CIAM: POST /token
    CIAM-->>Java: access token
    Java->>CIAM: POST introspection by Nimbus client
    CIAM-->>Java: active true or false + claims
    Java->>Java: Nimbus read introspection response
    Java->>Java: Validate active and issuer
    Java-->>Browser: PASS or FAIL + claims
```
