import { test as setup, expect } from "@playwright/test";

const authFile = "tests/e2e/.auth/user.json";

/**
 * Authenticate as admin@test.com via Keycloak OIDC flow.
 * This runs once before all tests and stores the session cookie.
 */
setup("authenticate", async ({ page }) => {
  // Navigate to landing page and click Sign In to trigger Keycloak redirect
  await page.goto("/");
  await page.getByRole("button", { name: "Sign In" }).click();

  // Wait for Keycloak login page
  await page.waitForURL(/.*\/realms\/.*\/protocol\/openid-connect\/auth.*/, {
    timeout: 15000,
  });

  // Fill in credentials
  await page.fill("#username", "admin@test.com");
  await page.fill("#password", "Test1234");
  await page.click("#kc-login");

  // Wait for redirect back to the app
  await page.waitForURL("**/dashboard**", { timeout: 15000 });

  // Verify we're logged in
  await expect(page.locator("text=Claims Dashboard")).toBeVisible();

  // Find acme-corp's org UUID from the session and set the selectedOrgId
  // cookie directly. The OrgSwitcher dropdown approach is fragile because
  // the OrgContext auto-selects the first org (globex-inc) on render.
  // Instead, we read the session's organizations map and find acme-corp's ID.
  const acmeOrgId = await page.evaluate(async () => {
    const res = await fetch("/api/auth/session");
    const session = await res.json();
    const orgs = session?.user?.organizations ?? {};
    for (const [id, org] of Object.entries(orgs)) {
      if ((org as { name: string }).name.toLowerCase().includes("acme")) {
        return id;
      }
    }
    return null;
  });

  if (acmeOrgId) {
    // Set cookie via document.cookie (same as OrgSwitcher)
    await page.evaluate((orgId) => {
      document.cookie = `selectedOrgId=${encodeURIComponent(orgId)};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    }, acmeOrgId);

    // Also add via Playwright context API to ensure storageState captures it
    await page.context().addCookies([
      {
        name: "selectedOrgId",
        value: acmeOrgId,
        domain: "localhost",
        path: "/",
        sameSite: "Lax",
        expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
      },
    ]);

    // Reload to confirm acme-corp dashboard (server-rendered)
    await page.reload();
    await expect(page.locator("text=Claims Dashboard")).toBeVisible();
  }

  // Save the authenticated state
  await page.context().storageState({ path: authFile });
});
