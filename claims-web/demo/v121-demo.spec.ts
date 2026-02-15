import { test, expect } from '@playwright/test';
import { startTimestampRecording, showCaption, hideCaption, caption } from './caption-overlay';
import { pause, scenicPause, quickPause, smoothScroll } from './demo-helpers';

/**
 * v1.2.1 Release Demo: End-to-End Claims Flow
 *
 * Showcases the fixes and improvements in v1.2.1:
 * - Clean landing page and Keycloak OIDC login
 * - Dashboard with working status filter tabs (was UI-only, now hits API)
 * - Multi-org switching with proper page reload
 * - Claim detail view with audit timeline
 * - Filing a new claim (4-step form)
 * - Version reporting via health endpoint
 *
 * @demo
 */
test('CIAM Claims Portal v1.2.1 Demo @demo', async ({ page }) => {
  startTimestampRecording();

  // ============================================================
  // SCENE 1: Landing Page
  // ============================================================
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('body')).not.toContainText('Runtime Error');
  await expect(page.locator('h1')).toContainText('Claims Portal');
  await expect(page.locator('button:has-text("Sign In")')).toBeVisible();

  await caption(page, 'Claims Portal — enterprise insurance claims with CIAM security', 5000);
  await scenicPause(page);

  // ============================================================
  // SCENE 2: Keycloak OIDC Login
  // ============================================================
  await showCaption(page, 'Signing in via Keycloak OpenID Connect');
  await quickPause(page);

  await page.click('button:has-text("Sign In")');
  await page.waitForURL(/.*\/realms\/.*\/protocol\/openid-connect\/auth.*/, { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  await hideCaption(page);

  await expect(page.locator('#kc-login')).toBeVisible();

  await caption(page, 'Keycloak handles authentication — email, social login, and MFA supported', 5500);
  await scenicPause(page);

  // Fill credentials and sign in
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
  await pause(page, 2000);

  // ============================================================
  // SCENE 3: Dashboard Overview
  // ============================================================
  await expect(page.locator('body')).not.toContainText('Runtime Error');
  await expect(page.locator('h1')).toContainText('Claims Dashboard');

  // Check which org we're in
  const headerText = await page.locator('header').innerText();
  const isGlobex = headerText.includes('globex-inc');

  if (isGlobex) {
    await caption(page, 'Dashboard loaded in Globex Inc — this user has Viewer role here', 5000);
    await scenicPause(page);

    // Switch to acme-corp for admin capabilities
    await showCaption(page, 'Switching to Acme Corp where we have admin privileges');
    await quickPause(page);

    const orgTrigger = page.locator('button[role="combobox"], [class*="SelectTrigger"]').first();
    await orgTrigger.click();
    await pause(page, 600);

    const acmeOption = page.locator('[role="option"]:has-text("acme-corp")');
    if (await acmeOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await acmeOption.click();
    } else {
      await page.locator('text=acme-corp').click();
    }
    await hideCaption(page);

    await pause(page, 800);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await pause(page, 2000);
  }

  // Now we should be in acme-corp with admin role
  await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });

  await caption(page, 'Acme Corp dashboard — KPI cards, claims chart, and the full claims table', 5500);
  await scenicPause(page);

  // Scroll to see KPI cards and chart
  await smoothScroll(page, 'body');
  await pause(page, 800);

  // ============================================================
  // SCENE 4: Status Filter Tabs (v1.2.1 FIX - now functional!)
  // ============================================================
  // Scroll back up to see tabs
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await pause(page, 800);

  // Scroll down to make tabs visible
  await smoothScroll(page, '[role="tablist"]');
  await pause(page, 500);

  await caption(page, 'Status filter tabs — now fully functional in v1.2.1, filtering claims via the API', 6000);
  await scenicPause(page);

  // Click Approved tab
  const approvedTab = page.locator('a:has-text("Approved")');
  await approvedTab.click();
  await page.waitForLoadState('networkidle');
  await pause(page, 1500);

  await caption(page, 'Filtered to Approved claims — the API returns only matching results', 5000);
  await scenicPause(page);

  // Click Submitted tab
  const submittedTab = page.locator('a:has-text("Submitted")');
  await submittedTab.click();
  await page.waitForLoadState('networkidle');
  await pause(page, 1500);

  await caption(page, 'Switching to Submitted — each tab triggers a server-side query', 5000);
  await scenicPause(page);

  // Back to All
  const allTab = page.locator('a:has-text("All")');
  await allTab.click();
  await page.waitForLoadState('networkidle');
  await pause(page, 1500);

  // ============================================================
  // SCENE 5: Claim Detail + Timeline
  // ============================================================
  await showCaption(page, 'Opening a claim to view the full detail and audit trail');
  await quickPause(page);

  const firstClaimLink = page.locator('table tbody tr a').first();
  await firstClaimLink.click();
  await page.waitForLoadState('networkidle');
  await pause(page, 1500);
  await hideCaption(page);

  await expect(page.locator('body')).not.toContainText('Runtime Error');

  await caption(page, 'Claim detail — status, type, amount, and the complete event timeline', 5500);
  await scenicPause(page);

  await smoothScroll(page, 'body');
  await pause(page, 1000);

  await caption(page, 'Every state change is recorded as an immutable audit event', 5000);
  await scenicPause(page);

  // ============================================================
  // SCENE 6: File a New Claim (4-step form)
  // ============================================================
  await page.goto('/claims/new');
  await page.waitForLoadState('networkidle');
  await pause(page, 1000);

  await expect(page.locator('body')).not.toContainText('Runtime Error');

  await caption(page, 'Filing a new claim — a guided four-step form with validation', 5000);
  await scenicPause(page);

  // Step 1: Claim Type
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

  await page.click('button:has-text("Next")');
  await pause(page, 800);

  // Step 2: Incident Details
  await showCaption(page, 'Step 2 — Describe the incident');
  await quickPause(page);
  await page.fill('#description', 'Water damage to office from burst pipe. Multiple rooms affected.');
  await pause(page, 800);
  await hideCaption(page);

  await page.click('button:has-text("Next")');
  await pause(page, 800);

  // Step 3: Amount
  await showCaption(page, 'Step 3 — Enter the claim amount');
  await quickPause(page);
  await page.fill('#amount', '25000');
  await pause(page, 600);
  await hideCaption(page);

  await page.click('button:has-text("Next")');
  await pause(page, 800);

  // Step 4: Review
  await caption(page, 'Step 4 — Review all details before submission', 4500);
  await scenicPause(page);

  // Submit
  await showCaption(page, 'Submitting the claim to the Spring Boot API');
  await quickPause(page);
  await page.click('button:has-text("Submit Claim")');

  await page.waitForURL(/.*\/claims\/.*/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await pause(page, 1500);
  await hideCaption(page);

  await caption(page, 'Claim created successfully — redirected to the new claim detail', 5000);
  await scenicPause(page);

  // ============================================================
  // SCENE 7: Version Health Check (new in v1.2.1)
  // ============================================================
  await page.goto('/api/health');
  await page.waitForLoadState('networkidle');
  await pause(page, 1000);

  await caption(page, 'New in v1.2.1 — health endpoint reports the deployed version', 5000);
  await scenicPause(page);

  // ============================================================
  // SCENE 8: Closing — back to dashboard
  // ============================================================
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await pause(page, 1500);

  await caption(page, 'CIAM Claims Portal v1.2.1 — better session handling, working filters, and version tracking', 6500);
  await scenicPause(page, 2000);

  await caption(page, 'Built with Next.js, Spring Boot, Keycloak, and Supabase', 5000);
  await scenicPause(page, 2000);

  await caption(page, 'Thank you for watching', 4000);

  // Final pause for voiceover
  await page.waitForTimeout(5000);
});
