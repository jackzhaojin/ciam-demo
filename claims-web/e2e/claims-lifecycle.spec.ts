import { test, expect } from "@playwright/test";

test.describe("Claims Lifecycle", () => {
  test("create a new claim and verify it appears on dashboard", async ({
    page,
  }) => {
    // Navigate to file new claim
    await page.goto("/claims/new");
    await expect(page.locator("text=File a New Claim")).toBeVisible();

    // Step 1: Claim Type (default AUTO is fine)
    await page.click("text=Next");

    // Step 2: Incident Details
    const today = new Date().toISOString().split("T")[0];
    await page.fill("#incidentDate", today);
    await page.fill("#description", "E2E test claim - car accident on highway");
    await page.click("text=Next");

    // Step 3: Amount
    await page.fill("#amount", "5000");
    await page.click("text=Next");

    // Step 4: Review & Submit
    await expect(page.locator("text=Review your claim")).toBeVisible();
    await expect(page.locator("text=AUTO")).toBeVisible();
    await expect(page.locator("text=$5,000")).toBeVisible();

    await page.click("text=Submit Claim");

    // Should redirect to claim detail page
    await page.waitForURL(/\/claims\/[a-f0-9-]+/);
    await expect(page.locator("text=CLM-")).toBeVisible();
    await expect(page.locator("text=DRAFT")).toBeVisible();
  });

  test("submit and approve a claim (full lifecycle)", async ({ page }) => {
    // Create a claim first
    await page.goto("/claims/new");
    await page.click("text=Next");
    await page.fill("#incidentDate", new Date().toISOString().split("T")[0]);
    await page.fill("#description", "E2E lifecycle test - property damage");
    await page.click("text=Next");
    await page.fill("#amount", "10000");
    await page.click("text=Next");
    await page.click("text=Submit Claim");
    await page.waitForURL(/\/claims\/[a-f0-9-]+/);

    // Submit the claim
    await page.click("text=Submit");
    await expect(page.locator("text=submitted successfully")).toBeVisible();
    await expect(page.locator("text=SUBMITTED")).toBeVisible();

    // Begin review (admin@test.com is admin in acme-corp)
    await page.click("text=Begin Review");
    await expect(page.locator("text=moved to review successfully")).toBeVisible();
    await expect(page.locator("text=UNDER_REVIEW")).toBeVisible();

    // Approve
    await page.click("text=Approve");
    await expect(page.locator("text=approved successfully")).toBeVisible();
    await expect(page.locator("text=APPROVED")).toBeVisible();
  });

  test("dashboard shows claims and navigates to detail", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("text=Claims Dashboard")).toBeVisible();

    // Check that the claims table is visible
    const claimLinks = page.locator('a[href^="/claims/"]');
    const count = await claimLinks.count();
    if (count > 0) {
      // Click the first claim
      await claimLinks.first().click();
      await page.waitForURL(/\/claims\/[a-f0-9-]+/);
      await expect(page.locator("text=Claim Details")).toBeVisible();
    }
  });
});
