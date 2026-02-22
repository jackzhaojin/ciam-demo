import { test, expect } from '@playwright/test';
import { startTimestampRecording, showCaption, hideCaption, caption } from './caption-overlay';
import { pause, scenicPause, quickPause } from './demo-helpers';

/**
 * v1.3 Auth Strategies Demo
 *
 * Demonstrates 5 ways to authenticate in the CIAM Claims Portal:
 *   Flow 1: Standard BFF Login (Auth.js + Keycloak OIDC)
 *   Flow 2: PKCE + JWKS Vanilla Java (offline, manual crypto)
 *   Flow 3: PKCE + JWKS Nimbus JOSE+JWT (offline, library-based)
 *   Flow 4: PKCE + Introspection Vanilla Java (online, manual HTTP)
 *   Flow 5: PKCE + Introspection Nimbus OAuth2 SDK (online, library SDK)
 *
 * Each flow authenticates the same user, showing the technical differences
 * between each token validation approach.
 *
 * @demo
 */
test('Five Authentication Strategies Demo @demo', async ({ page }) => {
  startTimestampRecording();

  // ================================================================
  // INTRO
  // ================================================================
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1')).toContainText('Claims Portal');

  await caption(page, 'CIAM Claims Portal — Five ways to authenticate and validate tokens', 5000);
  await scenicPause(page);

  await caption(page, 'We will demonstrate the standard BFF login, then four PKCE strategies that show what happens under the hood', 6500);
  await scenicPause(page);

  // ================================================================
  // FLOW 1: Standard BFF Login
  // ================================================================
  await showCaption(page, 'Flow 1 — Standard BFF Login via Auth.js and Keycloak OIDC');
  await pause(page, 4000);

  await caption(page, 'The production approach — tokens never reach the browser. Auth.js handles OIDC invisibly', 6000);
  await scenicPause(page);

  // Click Sign In
  await showCaption(page, 'Clicking Sign In redirects to Keycloak for authentication');
  await quickPause(page);
  await page.click('button:has-text("Sign In")');
  await page.waitForURL(/.*\/realms\/.*\/protocol\/openid-connect\/auth.*/, { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  await hideCaption(page);

  await expect(page.locator('#kc-login')).toBeVisible();
  await caption(page, 'Keycloak handles the login form — supports email, social providers, and MFA', 5500);
  await scenicPause(page);

  // Fill credentials
  await showCaption(page, 'Signing in as admin@test.com');
  await quickPause(page);
  await page.fill('#username', 'admin@test.com');
  await pause(page, 400);
  await page.fill('#password', 'Test1234');
  await pause(page, 600);
  await page.click('#kc-login');
  await hideCaption(page);

  // Wait for dashboard
  await page.waitForURL('**/dashboard**', { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  await pause(page, 2000);

  await expect(page.locator('h1')).toContainText('Claims Dashboard');
  await caption(page, 'Authenticated — redirected to the dashboard. Tokens stored in encrypted server-side cookies', 6000);
  await scenicPause(page);

  await caption(page, 'The browser never sees the access token. This is the BFF pattern — the gold standard for web apps', 6000);
  await scenicPause(page);

  // Sign out by navigating to sign-out and back
  // Navigate to the PKCE login page for the next 4 flows
  await showCaption(page, 'Now let us explore the four PKCE strategies on the Advanced Login page');
  await pause(page, 4000);
  await hideCaption(page);

  // ================================================================
  // Navigate to /login for PKCE flows
  // ================================================================
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await pause(page, 1000);

  await expect(page.locator('body')).not.toContainText('Runtime Error');
  await expect(page.getByText('Authentication Strategy Demo')).toBeVisible();

  await caption(page, 'The Advanced Login page — two cards: Standard BFF on top and the PKCE Strategy Demo below', 6000);
  await scenicPause(page);

  await caption(page, 'PKCE lets us choose exactly how the backend validates the token — four different approaches', 6000);
  await scenicPause(page);

  // ================================================================
  // Helper: run a PKCE flow with a given strategy
  // ================================================================
  async function runPkceFlow(
    strategyKey: string,
    flowNumber: number,
    flowTitle: string,
    narration: string[],
  ) {
    // Show flow title
    await showCaption(page, `Flow ${flowNumber} — ${flowTitle}`);
    await pause(page, 4000);
    await hideCaption(page);

    // Narrate the strategy explanation
    for (const text of narration) {
      await caption(page, text, Math.max(text.length * 80, 4000));
      await quickPause(page);
    }

    // Fill credentials
    await page.fill('#username', 'admin@test.com');
    await pause(page, 300);
    await page.fill('#password', 'Test1234');
    await pause(page, 300);

    // Select strategy from dropdown
    // Labels include the offline/online badge text in the option's accessible name
    const labelMap: Record<string, string> = {
      'jwks-vanilla': 'JWKS — Vanilla Java offline',
      'jwks-nimbus': 'JWKS — Nimbus JOSE\\+JWT offline',
      'introspection-vanilla': 'Introspection — Vanilla Java online',
      'introspection-nimbus': 'Introspection — Nimbus OAuth2 SDK online',
    };
    const optionName = labelMap[strategyKey];
    await showCaption(page, `Selecting ${flowTitle}`);
    await quickPause(page);
    await page.locator('#strategy').click();
    await pause(page, 500);
    await page.getByRole('option', { name: new RegExp(optionName) }).click();
    await pause(page, 500);
    await hideCaption(page);

    // Click Sign In with PKCE
    const pkceButton = page.getByRole('button', { name: /sign in with pkce/i });
    await expect(pkceButton).toBeEnabled({ timeout: 5000 });
    await showCaption(page, 'Authenticating with PKCE...');
    await pkceButton.click();

    // Wait for authenticating state to pass
    await expect(page.getByRole('button', { name: /authenticating/i })).toBeVisible();
    await hideCaption(page);

    // Wait for PASS badge
    await expect(page.getByText('PASS')).toBeVisible({ timeout: 30000 });

    // Narrate result
    await caption(page, `PASS — ${flowTitle} validated the token successfully`, 5000);
    await quickPause(page);

    // Highlight validation steps
    await expect(page.getByText(/Validation Steps/)).toBeVisible();
    await caption(page, `The validation steps show exactly what happened inside the ${strategyKey.includes('nimbus') ? 'library' : 'manual code'}`, 5500);
    await scenicPause(page);

    // Scroll to see token claims
    const tokenClaimsCard = page.getByText('Token Claims');
    if (await tokenClaimsCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tokenClaimsCard.scrollIntoViewIfNeeded();
      await pause(page, 800);
      await caption(page, 'The extracted token claims include user identity, organization memberships, and custom attributes', 5500);
      await scenicPause(page);
    }

    // Scroll back to top and clear for next flow
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await pause(page, 800);
  }

  // ================================================================
  // FLOW 2: JWKS — Vanilla Java
  // ================================================================
  await runPkceFlow('jwks-vanilla', 2, 'JWKS — Vanilla Java', [
    'JWKS validation fetches the public key from Keycloak and verifies the token signature locally',
    'The Vanilla approach does this manually — reconstructing the RSA key from modulus and exponent using only the JDK',
    'This is offline validation — no network call to Keycloak after the initial key fetch',
  ]);

  // ================================================================
  // FLOW 3: JWKS — Nimbus JOSE+JWT
  // ================================================================
  await runPkceFlow('jwks-nimbus', 3, 'JWKS — Nimbus JOSE+JWT', [
    'Same JWKS approach but using the Nimbus JOSE+JWT library instead of manual crypto',
    'The library handles key caching, rotation, and signature verification in one call',
    'Far less code than vanilla — this is what you would use in production',
  ]);

  // ================================================================
  // FLOW 4: Introspection — Vanilla Java
  // ================================================================
  await runPkceFlow('introspection-vanilla', 4, 'Introspection — Vanilla Java', [
    'Introspection is the opposite approach — instead of verifying locally, we ask Keycloak directly',
    'The backend POSTs the token to the introspection endpoint with client credentials',
    'Online validation — slower but always current. Catches revoked tokens immediately',
  ]);

  // ================================================================
  // FLOW 5: Introspection — Nimbus OAuth2 SDK
  // ================================================================
  await runPkceFlow('introspection-nimbus', 5, 'Introspection — Nimbus OAuth2 SDK', [
    'Same introspection approach but using the Nimbus OAuth2 SDK for cleaner code',
    'The SDK handles HTTP requests, credential encoding, and response parsing automatically',
    'Library versus manual — same result, much less boilerplate',
  ]);

  // ================================================================
  // CLOSING
  // ================================================================
  await caption(page, 'Five authentication strategies — from invisible BFF to transparent PKCE with four validation approaches', 6500);
  await scenicPause(page, 2000);

  await caption(page, 'JWKS validates offline with public keys. Introspection validates online by asking the identity provider', 6500);
  await scenicPause(page, 2000);

  await caption(page, 'Vanilla shows the raw mechanics. Library shows the production path. Both arrive at the same result', 6000);
  await scenicPause(page, 2000);

  await caption(page, 'Built with Next.js, Spring Boot, Keycloak, and Phase Two — thank you for watching', 5000);

  // Final pause
  await page.waitForTimeout(5000);
});
