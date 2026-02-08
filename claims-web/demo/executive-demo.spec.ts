import { test, expect } from '@playwright/test';
import { showCaption, hideCaption, caption } from './caption-overlay';
import { pause, scenicPause, quickPause, smoothScroll } from './demo-helpers';

/**
 * Executive Demo: CIAM Claims Portal
 *
 * Showcases the full enterprise CIAM pattern:
 * - Keycloak OIDC authentication (BFF pattern)
 * - Multi-tenant organization-scoped access control
 * - Role-based UI gating (admin vs viewer)
 * - Claims lifecycle management
 * - Dark mode, profile, token introspection
 *
 * @demo
 */
test('CIAM Claims Portal Executive Demo @demo', async ({ page }) => {
  // ============================================================
  // SCENE 1: Landing Page
  // ============================================================
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Assert landing page is rendered
  await expect(page.locator('h1')).toContainText('Claims Portal');
  await expect(page.locator('button:has-text("Sign In")')).toBeVisible();

  await caption(page, 'Claims Portal — Enterprise insurance claims management with CIAM security', 5000);
  await scenicPause(page);

  await caption(page, 'Built with Next.js, Spring Boot, and Keycloak using the BFF pattern — tokens never reach the browser', 6000);
  await scenicPause(page);

  // ============================================================
  // SCENE 2: Keycloak OIDC Login
  // ============================================================
  await showCaption(page, 'Authentication is handled by Keycloak via OpenID Connect');
  await quickPause(page);

  // Click Sign In to trigger OIDC redirect
  await page.click('button:has-text("Sign In")');
  await page.waitForURL(/.*\/realms\/.*\/protocol\/openid-connect\/auth.*/, { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  await hideCaption(page);

  // Assert Keycloak login page loaded
  await expect(page.locator('#kc-login')).toBeVisible();

  await caption(page, 'The Keycloak identity provider handles authentication — supporting email, social login, and MFA', 6000);
  await scenicPause(page);

  // Fill credentials
  await showCaption(page, 'Signing in as an enterprise admin user');
  await quickPause(page);
  await page.fill('#username', 'admin@test.com');
  await pause(page, 400);
  await page.fill('#password', 'Test1234');
  await pause(page, 600);
  await page.click('#kc-login');
  await hideCaption(page);

  // Wait for dashboard redirect
  await page.waitForURL('**/dashboard**', { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  // Wait for initial data to load
  await pause(page, 2000);

  // ============================================================
  // SCENE 3: Dashboard — Viewer Org (globex-inc)
  // ============================================================
  // The default org may be globex-inc (viewer role)
  await expect(page.locator('h1')).toContainText('Claims Dashboard');

  // Check which org we landed in by looking at the header
  const headerText = await page.locator('header').innerText();
  const isGlobex = headerText.includes('globex-inc');

  if (isGlobex) {
    await caption(page, 'Dashboard loaded — currently viewing Globex Inc where this user has Viewer role only', 5500);
    await scenicPause(page);

    // Point out limited sidebar — only Dashboard visible
    await caption(page, 'Notice the sidebar — as a viewer, no File Claim or Admin Review options are available', 5500);
    await scenicPause(page);
  }

  // ============================================================
  // SCENE 4: Org Switching — Switch to acme-corp (admin)
  // ============================================================
  await showCaption(page, 'Users can belong to multiple organizations — switching to Acme Corp with admin privileges');
  await quickPause(page);

  // Click the org switcher dropdown
  const orgTrigger = page.locator('button[role="combobox"], [class*="SelectTrigger"]').first();
  await orgTrigger.click();
  await pause(page, 600);

  // Select acme-corp
  const acmeOption = page.locator('[role="option"]:has-text("acme-corp")');
  if (await acmeOption.isVisible({ timeout: 3000 }).catch(() => false)) {
    await acmeOption.click();
  } else {
    // Fallback: try selecting via text
    await page.locator('text=acme-corp').click();
  }
  await hideCaption(page);

  // OrgSwitcher sets cookie client-side, but dashboard is a server component
  // that reads the cookie server-side — need a full navigation to pick it up
  await pause(page, 800);
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await pause(page, 2000);

  // ============================================================
  // SCENE 5: Dashboard — Admin View (acme-corp)
  // ============================================================
  // Verify claims data is visible
  await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
  const claimRows = page.locator('table tbody tr');
  await expect(claimRows.first()).toBeVisible({ timeout: 10000 });

  await caption(page, 'Now in Acme Corp — the admin sees the full claims dashboard with six claims across all statuses', 6000);
  await scenicPause(page);

  // Highlight the sidebar now shows admin options
  await caption(page, 'As admin, the sidebar expands — File Claim and Admin Review are now accessible', 5500);
  await scenicPause(page);

  // Highlight the File New Claim button
  const fileNewClaimBtn = page.locator('a:has-text("File New Claim"), button:has-text("File New Claim")');
  if (await fileNewClaimBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await caption(page, 'The File New Claim button appears for users with create permissions', 4500);
    await scenicPause(page);
  }

  // Show status tabs
  await caption(page, 'Status filters let you drill into claims by lifecycle state', 4500);
  await quickPause(page);

  // Click Approved tab to filter
  const approvedTab = page.locator('a:has-text("Approved")');
  await approvedTab.click();
  await page.waitForLoadState('networkidle');
  await pause(page, 1500);

  await caption(page, 'Filtering to Approved claims — three claims have been approved in this organization', 5500);
  await scenicPause(page);

  // Back to All
  const allTab = page.locator('a:has-text("All")');
  await allTab.click();
  await page.waitForLoadState('networkidle');
  await pause(page, 1500);

  // ============================================================
  // SCENE 6: Claim Detail + Timeline
  // ============================================================
  await showCaption(page, 'Clicking a claim opens the detail view with the full audit trail');
  await quickPause(page);

  // Click first claim link in table
  const firstClaimLink = page.locator('table tbody tr a').first();
  await firstClaimLink.click();
  await page.waitForLoadState('networkidle');
  await pause(page, 1500);
  await hideCaption(page);

  // Assert we're on a claim detail page
  await expect(page.locator('body')).not.toContainText('Runtime Error');

  await caption(page, 'The claim detail shows status, type, amount, and the complete event timeline', 5500);
  await scenicPause(page);

  // Scroll to see timeline
  await smoothScroll(page, 'body');
  await pause(page, 1000);

  await caption(page, 'Every state change is recorded as an immutable audit event — essential for compliance', 5500);
  await scenicPause(page);

  // ============================================================
  // SCENE 7: File a New Claim (4-step form)
  // ============================================================
  await page.goto('/claims/new');
  await page.waitForLoadState('networkidle');
  await pause(page, 1000);

  // Assert form is visible
  await expect(page.locator('body')).not.toContainText('Runtime Error');

  await caption(page, 'Filing a new claim — a guided four-step form with client-side validation', 5500);
  await scenicPause(page);

  // Step 1: Claim Type (default is AUTO, let's select PROPERTY)
  await showCaption(page, 'Step 1 — Select the claim type');
  await quickPause(page);

  const typeSelect = page.locator('#claimType, [id="claimType"]').first();
  if (await typeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await typeSelect.click();
    await pause(page, 500);
    const propertyOption = page.locator('[role="option"]:has-text("Property")');
    if (await propertyOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await propertyOption.click();
    }
    await pause(page, 500);
  }
  await hideCaption(page);

  // Click Next
  await page.click('button:has-text("Next")');
  await pause(page, 800);

  // Step 2: Incident Details
  await showCaption(page, 'Step 2 — Incident date and description with Zod schema validation');
  await quickPause(page);

  await page.fill('#description', 'Water damage to office building from burst pipe on second floor. Multiple rooms affected including server room and conference area.');
  await pause(page, 800);
  await hideCaption(page);

  // Click Next
  await page.click('button:has-text("Next")');
  await pause(page, 800);

  // Step 3: Amount
  await showCaption(page, 'Step 3 — Enter the claim amount');
  await quickPause(page);

  await page.fill('#amount', '25000');
  await pause(page, 600);
  await hideCaption(page);

  // Click Next
  await page.click('button:has-text("Next")');
  await pause(page, 800);

  // Step 4: Review
  await caption(page, 'Step 4 — Review all details before submission. The form validates every field with Zod', 5500);
  await scenicPause(page);

  // Submit the claim
  await showCaption(page, 'Submitting the claim to the Spring Boot API');
  await quickPause(page);
  await page.click('button:has-text("Submit Claim")');

  // Wait for redirect to claim detail
  await page.waitForURL(/.*\/claims\/.*/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await pause(page, 1500);
  await hideCaption(page);

  await caption(page, 'Claim created successfully — redirected to the new claim detail with Draft status', 5500);
  await scenicPause(page);

  // ============================================================
  // SCENE 8: Admin Review Queue
  // ============================================================
  await page.goto('/admin/review');
  await page.waitForLoadState('networkidle');
  await pause(page, 1500);

  await expect(page.locator('body')).not.toContainText('Runtime Error');

  await caption(page, 'The Admin Review queue shows claims pending action — Submitted and Under Review statuses', 5500);
  await scenicPause(page);

  await caption(page, 'Admins can approve, deny, or begin review directly from this queue', 5000);
  await scenicPause(page);

  // ============================================================
  // SCENE 9: Profile & Multi-Org Membership
  // ============================================================
  await page.goto('/profile');
  await page.waitForLoadState('networkidle');
  await pause(page, 1000);

  await expect(page.locator('body')).not.toContainText('Runtime Error');

  await caption(page, 'The profile page shows user identity, loyalty tier, and all organization memberships', 5500);
  await scenicPause(page);

  await caption(page, 'Each organization shows assigned roles — admin and billing for Acme, viewer for Globex', 5500);
  await scenicPause(page);

  // ============================================================
  // SCENE 10: Dark Mode Toggle
  // ============================================================
  await showCaption(page, 'Dark mode support with a single toggle — built on next-themes and Tailwind CSS');
  await quickPause(page);

  // Click the theme toggle button
  const themeToggle = page.locator('button[aria-label="Toggle theme"]');
  await themeToggle.click();
  await pause(page, 1500);
  await hideCaption(page);

  await caption(page, 'The entire application switches to dark mode instantly — all components respect the theme', 5000);
  await scenicPause(page);

  // Navigate to dashboard in dark mode to show it off
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await pause(page, 1500);

  await caption(page, 'Dark mode carries through every page — dashboard, forms, detail views', 4500);
  await scenicPause(page);

  // Switch back to light mode
  await themeToggle.click();
  await pause(page, 1000);

  // ============================================================
  // SCENE 11: Token Debugger
  // ============================================================
  await page.goto('/dev/token');
  await page.waitForLoadState('networkidle');
  await pause(page, 1000);

  await expect(page.locator('body')).not.toContainText('Runtime Error');

  await caption(page, 'The token debugger reveals the session internals — organization claims, roles, and user identity', 5500);
  await scenicPause(page);

  await caption(page, 'Tokens carry custom Phase Two claims including organization memberships and attributes', 5500);
  await scenicPause(page);

  // ============================================================
  // SCENE 12: Closing
  // ============================================================
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await pause(page, 1500);

  await caption(page, 'CIAM Claims Portal — enterprise-grade identity, multi-tenancy, and claims management', 6000);
  await scenicPause(page, 2000);

  await caption(page, 'Built with Next.js 16, Spring Boot 3, Keycloak, Auth.js v5, and Supabase PostgreSQL', 6000);
  await scenicPause(page, 2000);

  await caption(page, 'Thank you for watching', 4000);

  // Final pause to ensure voiceover finishes
  await page.waitForTimeout(5000);
});
