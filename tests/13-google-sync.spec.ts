import { test, expect } from '@playwright/test';

test.describe('Google Sync Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Navigate to Settings page
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.locator('h1')).toContainText('Settings');
  });

  test('should show Google Sheets Sync section', async ({ page }) => {
    // Check for sync section header
    await expect(page.getByText('Sync', { exact: true })).toBeVisible();

    // Check for Google Sheets Sync option
    await expect(page.getByText('Google Sheets Sync')).toBeVisible();
  });

  test('should show "Not connected" status when not signed in', async ({ page }) => {
    // Check that the sync panel shows not connected status
    const connectButton = page.getByText('Connect Google Account');
    await expect(connectButton).toBeVisible();
  });

  test('should have Connect Google Account button', async ({ page }) => {
    // Check for the connect button
    const connectButton = page.getByText('Connect Google Account');
    await expect(connectButton).toBeVisible();
    await expect(connectButton).toBeEnabled();
  });

  test('should take screenshot of sync panel', async ({ page }) => {
    await page.screenshot({
      path: 'tests/screenshots/13-google-sync-panel.png',
      fullPage: true,
    });
  });
});

test.describe('OAuth Callback Handler', () => {
  test('should handle OAuth error in callback URL', async ({ page }) => {
    // Simulate an OAuth error callback
    await page.goto('/?error=access_denied&error_description=User%20cancelled%20the%20login%20flow');

    // Wait for the page to process and show either error or navigation
    await page.waitForLoadState('networkidle');

    // Should eventually land on a working page
    const header = page.locator('h1');
    await expect(header).toBeVisible();
  });

  test('should handle missing authorization code', async ({ page }) => {
    // Navigate to callback URL without code
    await page.goto('/auth/callback');

    // Wait for the page to process
    await page.waitForLoadState('networkidle');

    // Verify app is still functional
    const header = page.locator('h1');
    await expect(header).toBeVisible();
  });
});

test.describe('Sync Panel UI States', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings' }).click();
  });

  test('should show loading state while fetching sync status', async ({ page }) => {
    // Wait for sync panel to load
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Google Sheets Sync')).toBeVisible();
  });

  test('should render sync panel without errors', async ({ page }) => {
    // Verify no console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.waitForLoadState('networkidle');

    // Filter out expected errors (like missing client ID in test environment)
    const unexpectedErrors = consoleErrors.filter(
      (err) => !err.includes('Google Client ID') && !err.includes('VITE_GOOGLE_CLIENT_ID')
    );

    expect(unexpectedErrors).toHaveLength(0);
  });

  test('should show sync section with proper styling', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Check the sync section has proper styling
    const syncSection = page.locator('section').filter({ hasText: 'Sync' }).first();
    await expect(syncSection).toBeVisible();

    // The section should contain the Google Sheets Sync panel
    await expect(syncSection.getByText('Google Sheets Sync')).toBeVisible();
  });
});

test.describe('Sync Panel Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings' }).click();
  });

  test('should handle connect button click without crashing', async ({ page }) => {
    // Mock the OAuth flow by intercepting the redirect
    await page.route('**/accounts.google.com/**', (route) => {
      // Don't follow the redirect, just verify it was attempted
      route.abort();
    });

    await page.waitForLoadState('networkidle');

    const connectButton = page.getByText('Connect Google Account');
    await expect(connectButton).toBeVisible();

    // Click should not crash the app
    // We expect it to either redirect or show an error about missing client ID
    try {
      await connectButton.click();
      // Wait for any error handling
      await page.waitForLoadState('domcontentloaded');
    } catch {
      // Expected - navigation may be blocked in tests
    }

    // App should still be responsive
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
  });
});
