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

## 2) PKCE + Java flow: JWKS Vanilla

```mermaid
sequenceDiagram
    actor User
    participant Browser as NextJS Login UI
    participant NextAPI as NextJS PKCE Proxy
    participant CIAM as CIAM Keycloak
    participant Java as Spring Boot Auth API

    User->>Browser: Choose jwks-vanilla and sign in
    Browser->>NextAPI: submit-credentials(email,password,cookies)
    NextAPI->>CIAM: POST login-actions/authenticate
    CIAM-->>NextAPI: redirect with auth code
    NextAPI-->>Browser: auth code
    Browser->>Java: pkce-callback(code, verifier, jwks-vanilla)
    Java->>CIAM: POST /token
    CIAM-->>Java: access token (JWT)
    Java->>CIAM: GET /certs
    CIAM-->>Java: JWKS keys
    Java->>Java: Verify signature and claims
    Java-->>Browser: PASS or FAIL + claims
```

## 3) PKCE + Java flow: JWKS Nimbus

```mermaid
sequenceDiagram
    actor User
    participant Browser as NextJS Login UI
    participant NextAPI as NextJS PKCE Proxy
    participant CIAM as CIAM Keycloak
    participant Java as Spring Boot Auth API

    User->>Browser: Choose jwks-nimbus and sign in
    Browser->>NextAPI: submit-credentials(email,password,cookies)
    NextAPI->>CIAM: POST login-actions/authenticate
    CIAM-->>NextAPI: redirect with auth code
    NextAPI-->>Browser: auth code
    Browser->>Java: pkce-callback(code, verifier, jwks-nimbus)
    Java->>CIAM: POST /token
    CIAM-->>Java: access token (JWT)
    Java->>CIAM: GET /certs
    CIAM-->>Java: JWKS keys
    Java->>Java: Nimbus verify token and claims
    Java-->>Browser: PASS or FAIL + claims
```

## 4) PKCE + Java flow: Introspection Vanilla HTTP

```mermaid
sequenceDiagram
    actor User
    participant Browser as NextJS Login UI
    participant NextAPI as NextJS PKCE Proxy
    participant CIAM as CIAM Keycloak
    participant Java as Spring Boot Auth API

    User->>Browser: Choose introspection-vanilla and sign in
    Browser->>NextAPI: submit-credentials(email,password,cookies)
    NextAPI->>CIAM: POST login-actions/authenticate
    CIAM-->>NextAPI: redirect with auth code
    NextAPI-->>Browser: auth code
    Browser->>Java: pkce-callback(code, verifier, introspection-vanilla)
    Java->>CIAM: POST /token
    CIAM-->>Java: access token
    Java->>CIAM: POST /token/introspect
    CIAM-->>Java: active + claims
    Java->>Java: Check active and read claims
    Java-->>Browser: PASS or FAIL + claims
```

## 5) PKCE + Java flow: Introspection Nimbus

```mermaid
sequenceDiagram
    actor User
    participant Browser as NextJS Login UI
    participant NextAPI as NextJS PKCE Proxy
    participant CIAM as CIAM Keycloak
    participant Java as Spring Boot Auth API

    User->>Browser: Choose introspection-nimbus and sign in
    Browser->>NextAPI: submit-credentials(email,password,cookies)
    NextAPI->>CIAM: POST login-actions/authenticate
    CIAM-->>NextAPI: redirect with auth code
    NextAPI-->>Browser: auth code
    Browser->>Java: pkce-callback(code, verifier, introspection-nimbus)
    Java->>CIAM: POST /token
    CIAM-->>Java: access token
    Java->>CIAM: POST introspection by Nimbus client
    CIAM-->>Java: active + claims
    Java->>Java: Nimbus read and validate
    Java-->>Browser: PASS or FAIL + claims
```
