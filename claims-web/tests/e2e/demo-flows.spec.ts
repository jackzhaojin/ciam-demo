import { test, expect } from "@playwright/test";

/**
 * 5 comprehensive Playwright E2E demo flows covering the full user journey.
 * These flows walk through every demoable feature headlessly.
 *
 * Flows 1 & 5: empty auth state (manual login / public page)
 * Flows 2-4: stored auth state from auth.setup.ts (admin@test.com / acme-corp)
 */

// ---------------------------------------------------------------------------
// Flow 1: Login & Dashboard Tour
// ---------------------------------------------------------------------------
test.describe("Flow 1: Login & Dashboard Tour", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("landing → Keycloak login → dashboard tour", async ({ page }) => {
    // 1. Navigate to landing page
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Claims Portal" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign In" }),
    ).toBeVisible();

    // 2. Verify Advanced Login link
    const advancedLink = page.getByRole("link", {
      name: /advanced login/i,
    });
    await expect(advancedLink).toBeVisible();

    // 3. Click "Sign In" → Keycloak login page
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL(
      /.*\/realms\/.*\/protocol\/openid-connect\/auth.*/,
      { timeout: 15000 },
    );

    // 4. Fill credentials and submit
    await page.fill("#username", "admin@test.com");
    await page.fill("#password", "Test1234");
    await page.click("#kc-login");

    // 5. Wait for redirect to dashboard
    await page.waitForURL("**/dashboard**", { timeout: 15000 });

    // 6. Verify dashboard heading
    await expect(
      page.getByRole("heading", { name: "Claims Dashboard" }),
    ).toBeVisible();

    // Switch to acme-corp (default may be globex-inc where user is viewer).
    // Dashboard is server-rendered so a reload is needed after switching.
    const orgSwitcher = page.locator('button[role="combobox"]');
    await expect(orgSwitcher).toBeVisible();
    await orgSwitcher.click();
    await page.getByRole("option", { name: /acme/i }).click();
    await page.waitForTimeout(500);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Claims Dashboard" }),
    ).toBeVisible();

    // KPI cards (rendered from /api/claims/stats)
    await expect(page.getByText("Total Claims")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Open Claims")).toBeVisible();
    await expect(page.getByText("Total Exposure")).toBeVisible();
    await expect(page.getByText("Approval Rate")).toBeVisible();

    // Claims table headers
    await expect(page.getByText("Claim Number")).toBeVisible();
    await expect(page.getByText("Filed Date")).toBeVisible();

    // 7. Click "Draft" status filter tab — verify URL updates
    await page.getByRole("tab", { name: "Draft" }).click();
    await expect(page).toHaveURL(/status=DRAFT/);

    // 8. Toggle dark mode on
    const themeButton = page.locator('button[aria-label="Toggle theme"]');
    await expect(themeButton).toBeVisible();
    await themeButton.click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    // Toggle dark mode back off
    await themeButton.click();
    const htmlClass = await page.locator("html").getAttribute("class");
    expect(htmlClass ?? "").not.toContain("dark");
  });
});

// ---------------------------------------------------------------------------
// Flow 2: Claims Create & Full Lifecycle
// ---------------------------------------------------------------------------
test.describe("Flow 2: Claims Create & Full Lifecycle", () => {
  test("create claim → submit → review → approve → verify on dashboard", async ({
    page,
  }) => {
    // 1. Navigate to dashboard, click "File New Claim"
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Claims Dashboard" }),
    ).toBeVisible();
    // The "File New Claim" is a <Button> inside a <Link>
    await page.getByText("File New Claim").click();
    await page.waitForURL("**/claims/new");

    // 2. 4-step wizard
    // Step 1: Claim Type — select AUTO (default), click Next
    await expect(
      page.getByText("Claim Type", { exact: true }),
    ).toBeVisible();
    await page.click("text=Next");

    // Step 2: Incident Details
    await expect(page.getByText("Incident Details")).toBeVisible();
    const today = new Date().toISOString().split("T")[0];
    await page.fill("#incidentDate", today);
    await page.fill(
      "#description",
      "Demo flow e2e test — vehicle collision at intersection",
    );
    await page.click("text=Next");

    // Step 3: Amount
    await expect(page.getByText("Claim Amount", { exact: true })).toBeVisible();
    await page.fill("#amount", "7500");
    await page.click("text=Next");

    // 3. Review step — verify summary
    await expect(page.getByText("Review your claim")).toBeVisible();
    await expect(page.getByText("AUTO")).toBeVisible();
    await expect(page.getByText("$7,500")).toBeVisible();

    // Click "Submit Claim"
    await page.click("text=Submit Claim");

    // 4. Verify claim detail page
    await page.waitForURL(/\/claims\/[a-f0-9-]+/);
    await expect(page.getByText(/CLM-/)).toBeVisible();
    // StatusBadge renders title-case labels; use data-slot="badge" to avoid
    // matching the identical timeline step labels.
    const statusBadge = page.locator('[data-slot="badge"]').first();
    await expect(statusBadge).toHaveText("Draft");

    // 5. Submit → verify SUBMITTED
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("submitted successfully")).toBeVisible();
    await expect(statusBadge).toHaveText("Submitted");

    // 6. Begin Review → verify UNDER_REVIEW
    await page.getByRole("button", { name: "Begin Review" }).click();
    await expect(
      page.getByText("moved to review successfully"),
    ).toBeVisible();
    await expect(statusBadge).toHaveText("Under Review");

    // 7. Approve → verify APPROVED
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("approved successfully")).toBeVisible();
    await expect(statusBadge).toHaveText("Approved");

    // 8. Navigate to dashboard, filter Approved tab, verify claim
    await page.goto("/dashboard?status=APPROVED");
    await expect(
      page.getByRole("heading", { name: "Claims Dashboard" }),
    ).toBeVisible();
    // There should be at least one claim link in the table
    const claimLinks = page.locator('a[href^="/claims/"]');
    await expect(claimLinks.first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Flow 3: Multi-Org & Role-Based Access
// ---------------------------------------------------------------------------
test.describe("Flow 3: Multi-Org & Role-Based Access", () => {
  test("admin features in acme-corp → switch to globex-inc (viewer) → switch back", async ({
    page,
  }) => {
    // 1. Navigate to dashboard — verify admin features
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Claims Dashboard" }),
    ).toBeVisible();

    // Dashboard "File New Claim" button visible for admin
    await expect(page.getByText("File New Claim")).toBeVisible();

    // Sidebar "Admin Review" link visible for admin
    await expect(
      page.getByRole("link", { name: "Admin Review" }),
    ).toBeVisible();

    // 2. Navigate to admin review page — verify heading
    await page.goto("/admin/review");
    await expect(page.getByText("Review Queue")).toBeVisible();

    // 3. Go back to dashboard, switch org to globex-inc via OrgSwitcher
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Claims Dashboard" }),
    ).toBeVisible();

    // Click the org switcher
    const orgSwitcher = page.locator('button[role="combobox"]');
    await orgSwitcher.click();

    // Select globex-inc
    await page.getByRole("option", { name: /globex/i }).click();

    // Dashboard is server-rendered — reload to pick up new org cookie
    await page.waitForTimeout(500);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Claims Dashboard" }),
    ).toBeVisible();

    // 4. Verify "File New Claim" button disappears (viewer role)
    await expect(page.getByText("File New Claim")).not.toBeVisible();

    // 5. Verify "Admin Review" link disappears (viewer role)
    await expect(
      page.getByRole("link", { name: "Admin Review" }),
    ).not.toBeVisible();

    // 6. Switch back to acme-corp
    const switcherAgain = page.locator('button[role="combobox"]');
    await switcherAgain.click();
    await page.getByRole("option", { name: /acme/i }).click();

    // Reload again for server-side re-render
    await page.waitForTimeout(500);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Claims Dashboard" }),
    ).toBeVisible();

    // 7. Verify admin features return
    await expect(page.getByText("File New Claim")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Admin Review" }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Flow 4: Profile & Token Debug
// ---------------------------------------------------------------------------
test.describe("Flow 4: Profile & Token Debug", () => {
  test("profile page → token debugger page", async ({ page }) => {
    // 1. Navigate to profile
    await page.goto("/profile");
    await expect(
      page.getByRole("heading", { name: "Profile" }),
    ).toBeVisible();

    // 2. Verify email in User Information card
    await expect(page.getByText("User Information")).toBeVisible();
    await expect(page.getByText("admin@test.com")).toBeVisible();

    // 3. Verify loyalty tier badge shows "gold"
    await expect(page.getByText("gold")).toBeVisible();

    // 4. Verify Organizations card lists memberships with role badges
    await expect(
      page.getByText("Organizations", { exact: true }),
    ).toBeVisible();
    // Should show at least one org with role badges
    await expect(page.getByText("admin").first()).toBeVisible();

    // 5. Navigate to token debugger
    await page.goto("/dev/token");
    await expect(
      page.getByRole("heading", { name: "Token Debugger" }),
    ).toBeVisible();

    // 6. Verify Session Data card has JSON content
    await expect(page.getByText("Session Data")).toBeVisible();
    const sessionPre = page.locator("pre").first();
    await expect(sessionPre).toBeVisible();
    const sessionText = await sessionPre.textContent();
    expect(sessionText).toContain("{");

    // 7. Verify Organization Context card shows org ID
    await expect(
      page.getByText("Organization Context", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Selected Org ID (cookie)")).toBeVisible();

    // 8. Verify Organization Memberships card has JSON content
    await expect(page.getByText("Organization Memberships")).toBeVisible();
    const membershipPre = page.locator("pre").nth(1);
    await expect(membershipPre).toBeVisible();
    const membershipText = await membershipPre.textContent();
    expect(membershipText).toContain("{");
  });
});

// ---------------------------------------------------------------------------
// Flow 5: PKCE Login & Strategy Demo (v1.3)
// ---------------------------------------------------------------------------
test.describe("Flow 5: PKCE Login & Strategy Demo", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("landing → /login → PKCE flow with strategy selection → result", async ({
    page,
  }) => {
    // 1. Navigate to landing, click "Advanced Login (Strategy Demo)"
    await page.goto("/");
    const advancedLink = page.getByRole("link", {
      name: /advanced login/i,
    });
    await expect(advancedLink).toBeVisible();
    await advancedLink.click();

    // 2. Verify /login URL and heading
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: /authentication strategy demo/i }),
    ).toBeVisible();

    // 3. Verify both cards (CardTitle renders as <div>, not <h*>)
    await expect(page.getByText("Standard Login (BFF Pattern)")).toBeVisible();
    await expect(page.getByText("PKCE Login (Strategy Demo)")).toBeVisible();

    // 4. Verify "Sign In with PKCE" button is disabled (no credentials yet)
    const pkceButton = page.getByRole("button", {
      name: /sign in with pkce/i,
    });
    await expect(pkceButton).toBeDisabled();

    // 5. Fill username and password
    await page.fill("#username", "admin@test.com");
    await page.fill("#password", "Test1234");

    // 6. Wait for strategies to load (auto-selects first), verify dropdown
    await expect(page.locator("#strategy")).toBeVisible();
    // Wait for strategies to be populated (auto-select makes button enabled)
    await expect(pkceButton).toBeEnabled({ timeout: 10000 });

    // Open strategy dropdown to verify strategies are listed
    await page.locator("#strategy").click();
    const options = page.getByRole("option");
    await expect(options.first()).toBeVisible();
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThanOrEqual(4);

    // Select the first strategy (close dropdown)
    await options.first().click();

    // 7. Button should be enabled now
    await expect(pkceButton).toBeEnabled();

    // 8. Click "Sign In with PKCE" — wait for result
    await pkceButton.click();

    // Wait for authenticating state to pass
    await expect(
      page.getByRole("button", { name: /authenticating/i }),
    ).toBeVisible();

    // 9. Verify PASS badge appears (generous timeout for PKCE flow)
    await expect(page.getByText("PASS")).toBeVisible({ timeout: 30000 });

    // 10. Verify "Validation Steps" card with numbered steps
    await expect(page.getByText(/Validation Steps/)).toBeVisible();
    // Should have numbered steps (at least step 1)
    await expect(page.getByText("1.").first()).toBeVisible();

    // 11. Verify "Token Claims" card with JSON content
    await expect(page.getByText("Token Claims")).toBeVisible();
    const tokenPre = page.locator("pre").last();
    await expect(tokenPre).toBeVisible();
    const tokenText = await tokenPre.textContent();
    expect(tokenText).toContain("{");
  });
});
