# Auth Patterns (v1.3)

Five flows for this demo. Diagram 1 gets auth code with PKCE. Diagrams 2 to 5 show the four Java validation paths.

## 1) PKCE login: password to auth code to token

```mermaid
sequenceDiagram
    actor User
    participant Browser as NextJS Login UI
    participant NextAPI as NextJS PKCE Proxy
    participant CIAM as CIAM Keycloak
    participant Java as Spring Boot Auth API

    User->>Browser: Pick strategy and enter email/password
    Browser->>Browser: Make code_verifier and code_challenge
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

| Java class | File | Lines |
|---|---|---|
| PKCE callback endpoint | `AuthController` | `claims-api/src/main/java/com/poc/claims/auth/AuthController.java:29-38` |
| Code exchange + validate dispatch | `AuthService` | `claims-api/src/main/java/com/poc/claims/auth/AuthService.java:62-108` |
| Token endpoint POST body and call | `AuthService` | `claims-api/src/main/java/com/poc/claims/auth/AuthService.java:110-150` |

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

| Java class | File | Lines |
|---|---|---|
| Strategy selected and invoked | `AuthService` | `claims-api/src/main/java/com/poc/claims/auth/AuthService.java:67-86` |
| JWT split, JWKS fetch, RSA verify | `JwksVanillaStrategy` | `claims-api/src/main/java/com/poc/claims/auth/strategy/JwksVanillaStrategy.java:42-119` |
| Claim extraction and result | `JwksVanillaStrategy` | `claims-api/src/main/java/com/poc/claims/auth/strategy/JwksVanillaStrategy.java:121-149` |

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

| Java class | File | Lines |
|---|---|---|
| Strategy selected and invoked | `AuthService` | `claims-api/src/main/java/com/poc/claims/auth/AuthService.java:67-86` |
| Nimbus JWKS source + JWT processor | `JwksNimbusStrategy` | `claims-api/src/main/java/com/poc/claims/auth/strategy/JwksNimbusStrategy.java:39-63` |
| Claim extraction and result | `JwksNimbusStrategy` | `claims-api/src/main/java/com/poc/claims/auth/strategy/JwksNimbusStrategy.java:65-100` |

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

| Java class | File | Lines |
|---|---|---|
| Strategy selected and invoked | `AuthService` | `claims-api/src/main/java/com/poc/claims/auth/AuthService.java:67-86` |
| Basic auth + introspection HTTP call | `IntrospectionVanillaStrategy` | `claims-api/src/main/java/com/poc/claims/auth/strategy/IntrospectionVanillaStrategy.java:42-72` |
| Active check, claim extraction, result | `IntrospectionVanillaStrategy` | `claims-api/src/main/java/com/poc/claims/auth/strategy/IntrospectionVanillaStrategy.java:88-121` |

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

| Java class | File | Lines |
|---|---|---|
| Strategy selected and invoked | `AuthService` | `claims-api/src/main/java/com/poc/claims/auth/AuthService.java:67-86` |
| Nimbus introspection request + parse | `IntrospectionNimbusStrategy` | `claims-api/src/main/java/com/poc/claims/auth/strategy/IntrospectionNimbusStrategy.java:42-67` |
| Active check, claim extraction, result | `IntrospectionNimbusStrategy` | `claims-api/src/main/java/com/poc/claims/auth/strategy/IntrospectionNimbusStrategy.java:68-104` |

## Key Point

Spring never sees the password. Browser and NextJS proxy send password to Keycloak. Spring gets auth code, then token.

## Quick Compare

| Mode | Keycloak call during validate | Revocation check now | Client secret |
|---|---|---|---|
| JWKS | No | No | No |
| Introspection | Yes | Yes | Yes |

| Style | Code size | Use |
|---|---|---|
| Vanilla | More | Teach protocol steps |
| Nimbus | Less | Production style |
