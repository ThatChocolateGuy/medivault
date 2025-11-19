import { test, expect } from '@playwright/test';

test.describe('Barcode Scanner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Scan' }).click();
    await expect(page.locator('h1')).toContainText('Scan Barcode');
  });

  test('should display scanner interface', async ({ page }) => {
    // Check scanner UI elements
    await expect(page.getByText('Barcode Scanner')).toBeVisible();
    await expect(page.getByText('Scan product barcodes to quickly find or add items')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Scanning' })).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/04-scanner-initial.png', fullPage: true });
  });

  test('should show camera requirements message', async ({ page }) => {
    // Check for camera requirements text
    await expect(page.getByText('Camera access required')).toBeVisible();
    await expect(page.getByText('Works best in good lighting')).toBeVisible();
  });

  test('should have prominent scan button', async ({ page }) => {
    const scanButton = page.getByRole('button', { name: 'Start Scanning' });

    // Check button is visible and styled correctly
    await expect(scanButton).toBeVisible();

    // Take screenshot of button
    await page.screenshot({ path: 'tests/screenshots/04-scan-button.png' });
  });

  test('scanner button should be interactive', async ({ page }) => {
    const scanButton = page.getByRole('button', { name: 'Start Scanning' });

    // Check button is enabled
    await expect(scanButton).toBeEnabled();

    // Note: We can't actually test camera access in automated tests
    // without mocking, but we can verify the UI flow
  });

  test('should display scanner icon', async ({ page }) => {
    // Check for scanner-related visual elements
    const scannerIcon = page.locator('svg').first();
    await expect(scannerIcon).toBeVisible();

    // Take full screenshot
    await page.screenshot({ path: 'tests/screenshots/04-scanner-layout.png', fullPage: true });
  });
});
