import { test as setup, expect } from "@playwright/test";

const authFile = "tests/e2e/.auth/user.json";

/**
 * Authenticate as admin@test.com via Keycloak OIDC flow.
 * This runs once before all tests and stores the session cookie.
 */
setup("authenticate", async ({ page }) => {
  // Navigate to a protected page to trigger Keycloak redirect
  await page.goto("/dashboard");

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

  // Save the authenticated state
  await page.context().storageState({ path: authFile });
});
