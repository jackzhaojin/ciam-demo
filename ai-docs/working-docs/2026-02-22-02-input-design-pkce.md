---
title: "PKCE Flow - React Login with Spring Backend"
project: ciam-demo-private
sub_project: ciam-demo-private
type: working-doc
date: 2026-02-22
tags: []
why_private: "contains internal development guidance and architecture decisions"
status: stable
source_repo: https://github.com/jackzhaojin/ciam-demo-private.git
source_tool: claude-code
harvested: 2026-03-28
---

# PKCE Flow - React Login with Spring Backend

## The Core Principle

**Spring never sees the password. Ever.**

- React collects credentials and sends them directly to Keycloak
- Keycloak validates them and returns a short-lived, one-time-use **authorization code**
- React passes only that code to Spring
- Spring exchanges the code for tokens (JWT)

The authorization code is a **password proxy** — it proves the user authenticated successfully without exposing their actual credentials to your backend.

## Why This Matters

| Component | Sees Password? | Sees Auth Code? | Sees Tokens? |
|---|---|---|---|
| React | Yes (briefly) | Yes | No |
| Spring Backend | **Never** | Yes | Yes |
| Keycloak | Yes | Yes (issues it) | Yes (issues them) |

If Spring is ever compromised, attackers get tokens (which expire) but **never passwords**.

## Sequence Diagram

```mermaid
sequenceDiagram
    actor User
    participant React as React App
    participant Keycloak
    participant Spring as Spring Backend

    User->>React: Enters username + password
    User->>React: Selects validation strategy

    Note over React: React has the password here.<br/>Spring does not.

    React->>Keycloak: Sends credentials directly
    Keycloak->>Keycloak: Validates username + password
    Keycloak-->>React: Returns authorization CODE

    Note over React: Password is discarded.<br/>Only the code moves forward.

    React->>Spring: Sends auth CODE + selected strategy

    Note over Spring: Spring has NEVER seen the password.<br/>It only has a one-time-use code.

    Spring->>Keycloak: Exchanges auth CODE for tokens
    Keycloak-->>Spring: Returns JWT tokens
    Spring->>Spring: Validates tokens using selected strategy
    Spring-->>React: Session created / authenticated
```

## Open Question

Which Keycloak endpoint does the React app hit to submit credentials and get the auth code? This is the piece to confirm with the authentication architect — it's likely the Keycloak REST authentication API or a direct POST to the authorization endpoint.
