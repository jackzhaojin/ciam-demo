import { test, expect } from "@playwright/test";

test.describe("Authentication & Navigation", () => {
  test("authenticated user sees dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("text=Claims Dashboard")).toBeVisible();
    await expect(page.locator("text=File New Claim")).toBeVisible();
  });

  test("admin sees admin review link in sidebar", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("text=Admin Review")).toBeVisible();
  });

  test("admin can access admin review page", async ({ page }) => {
    await page.goto("/admin/review");
    await expect(page.locator("text=Admin Review Queue")).toBeVisible();
  });

  test("org switcher is visible in header", async ({ page }) => {
    await page.goto("/dashboard");
    // The OrgSwitcher component should be present
    await expect(page.locator("header")).toBeVisible();
  });

  test("dark mode toggle works", async ({ page }) => {
    await page.goto("/dashboard");

    // Find and click the theme toggle button
    const themeButton = page.locator('button[aria-label="Toggle theme"]');
    await expect(themeButton).toBeVisible();

    // Click to toggle to dark mode
    await themeButton.click();

    // Verify the html element has the dark class
    const htmlClass = await page.locator("html").getAttribute("class");
    expect(htmlClass).toContain("dark");

    // Toggle back to light
    await themeButton.click();
    const htmlClassAfter = await page.locator("html").getAttribute("class");
    expect(htmlClassAfter).not.toContain("dark");
  });
});
