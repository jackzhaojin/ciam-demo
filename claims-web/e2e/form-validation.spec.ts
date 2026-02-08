import { test, expect } from "@playwright/test";

test.describe("Form Validation", () => {
  test("prevents empty description on step 2", async ({ page }) => {
    await page.goto("/claims/new");

    // Step 1: proceed past type selection
    await page.click("text=Next");

    // Step 2: Try to proceed without filling description
    await page.fill("#incidentDate", new Date().toISOString().split("T")[0]);
    // Leave description empty
    await page.click("text=Next");

    // Should show validation error and stay on step 2
    await expect(
      page.locator("text=Description must be at least 10 characters"),
    ).toBeVisible();
  });

  test("prevents zero amount on step 3", async ({ page }) => {
    await page.goto("/claims/new");

    // Step 1: proceed
    await page.click("text=Next");

    // Step 2: fill valid data
    await page.fill("#incidentDate", new Date().toISOString().split("T")[0]);
    await page.fill("#description", "Valid description for testing purposes");
    await page.click("text=Next");

    // Step 3: Try to proceed with zero amount
    await page.fill("#amount", "0");
    await page.click("text=Next");

    // Should show validation error
    await expect(
      page.locator("text=Amount must be greater than zero"),
    ).toBeVisible();
  });

  test("prevents future incident date", async ({ page }) => {
    await page.goto("/claims/new");
    await page.click("text=Next");

    // Step 2: Set future date
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    await page.fill(
      "#incidentDate",
      futureDate.toISOString().split("T")[0],
    );
    await page.fill("#description", "Valid description for testing purposes");
    await page.click("text=Next");

    // Should show validation error
    await expect(
      page.locator("text=Incident date cannot be in the future"),
    ).toBeVisible();
  });
});
