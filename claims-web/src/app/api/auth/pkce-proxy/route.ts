import { NextRequest, NextResponse } from "next/server";

/**
 * Server-to-server proxy for Keycloak's auth/login-actions endpoints.
 * Keycloak doesn't support CORS for browser fetch() calls to its auth endpoints,
 * so this proxy handles the headless OIDC flow server-side.
 *
 * Two actions:
 *   - get-login-form: fetches the Keycloak auth page and returns the form action URL + cookies
 *   - submit-credentials: POSTs credentials to Keycloak's login-actions endpoint, returns auth code
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const keycloakIssuer = process.env.KEYCLOAK_ISSUER_URI;
    if (!keycloakIssuer) {
      return NextResponse.json(
        { error: "KEYCLOAK_ISSUER_URI not configured" },
        { status: 500 },
      );
    }

    if (action === "get-login-form") {
      return handleGetLoginForm(body, keycloakIssuer);
    } else if (action === "submit-credentials") {
      return handleSubmitCredentials(body, keycloakIssuer);
    } else {
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 },
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown proxy error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleGetLoginForm(
  body: {
    authUrl: string;
  },
  keycloakIssuer: string,
) {
  const { authUrl } = body;

  // Security: validate that the URL targets our known Keycloak instance
  if (!authUrl || !authUrl.startsWith(keycloakIssuer.replace("/realms/", "/"))) {
    // Also allow the base URL pattern (auth endpoints use /realms/ path)
    const baseUrl = new URL(keycloakIssuer).origin;
    if (!authUrl || !authUrl.startsWith(baseUrl)) {
      return NextResponse.json(
        { error: "authUrl must point to the configured Keycloak instance" },
        { status: 400 },
      );
    }
  }

  // Fetch the Keycloak auth page (which renders the login form)
  const response = await fetch(authUrl, {
    method: "GET",
    redirect: "follow",
    headers: {
      Accept: "text/html",
    },
  });

  const html = await response.text();

  // Extract the form action URL from the HTML
  const formActionMatch = html.match(
    /action="([^"]*login-actions\/authenticate[^"]*)"/,
  );
  if (!formActionMatch) {
    return NextResponse.json(
      {
        error: "Could not find login form action URL in Keycloak response",
      },
      { status: 502 },
    );
  }

  // Decode HTML entities in the URL
  const formActionUrl = formActionMatch[1]
    .replace(/&amp;/g, "&")
    .replace(/&#x3d;/gi, "=");

  // Collect all Set-Cookie headers from Keycloak
  const cookies: string[] = [];
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      cookies.push(value);
    }
  });

  return NextResponse.json({
    formActionUrl,
    cookies,
  });
}

async function handleSubmitCredentials(
  body: {
    formActionUrl: string;
    username: string;
    password: string;
    cookies: string[];
  },
  keycloakIssuer: string,
) {
  const { formActionUrl, username, password, cookies } = body;

  // Security: validate the form action URL targets our Keycloak
  const baseUrl = new URL(keycloakIssuer).origin;
  if (!formActionUrl || !formActionUrl.startsWith(baseUrl)) {
    return NextResponse.json(
      {
        error:
          "formActionUrl must point to the configured Keycloak instance",
      },
      { status: 400 },
    );
  }

  // Build form data
  const formData = new URLSearchParams();
  formData.set("username", username);
  formData.set("password", password);

  // Forward cookies from the login form step
  const cookieHeader = (cookies || [])
    .map((c: string) => c.split(";")[0])
    .join("; ");

  // POST credentials to Keycloak — do NOT follow redirects
  const response = await fetch(formActionUrl, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader,
    },
    body: formData.toString(),
  });

  // Keycloak should redirect with the auth code in the Location header
  const location = response.headers.get("location");

  if (!location) {
    // No redirect — probably bad credentials
    const html = await response.text();
    const errorMatch = html.match(
      /class="[^"]*kc-feedback-text[^"]*"[^>]*>([\s\S]*?)<\//,
    );
    const errorMsg = errorMatch
      ? errorMatch[1].trim()
      : "Authentication failed (no redirect from Keycloak)";
    return NextResponse.json({ error: errorMsg }, { status: 401 });
  }

  // Extract the authorization code from the redirect URL
  try {
    const redirectUrl = new URL(location);
    const code = redirectUrl.searchParams.get("code");

    if (!code) {
      const error = redirectUrl.searchParams.get("error_description") ||
        redirectUrl.searchParams.get("error") ||
        "No authorization code in redirect";
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ code });
  } catch {
    return NextResponse.json(
      { error: "Invalid redirect URL from Keycloak: " + location },
      { status: 502 },
    );
  }
}
