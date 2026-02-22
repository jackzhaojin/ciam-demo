import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // No auth state

  test("renders both login sections", async ({ page }) => {
    await page.goto("/login");

    // Should show the page title
    await expect(
      page.getByRole("heading", { name: /authentication strategy demo/i }),
    ).toBeVisible();

    // Section A: Standard BFF login
    await expect(
      page.getByRole("heading", { name: /standard login/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign in with keycloak/i }),
    ).toBeVisible();

    // Section B: PKCE strategy demo
    await expect(
      page.getByRole("heading", { name: /pkce login/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/username/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign in with pkce/i }),
    ).toBeVisible();
  });

  test("PKCE submit button is disabled without credentials", async ({
    page,
  }) => {
    await page.goto("/login");
    const pkceButton = page.getByRole("button", {
      name: /sign in with pkce/i,
    });
    await expect(pkceButton).toBeDisabled();
  });

  test("landing page has link to login", async ({ page }) => {
    await page.goto("/");
    const advancedLink = page.getByRole("link", {
      name: /advanced login/i,
    });
    await expect(advancedLink).toBeVisible();
    await advancedLink.click();
    await expect(page).toHaveURL(/\/login/);
  });
});
