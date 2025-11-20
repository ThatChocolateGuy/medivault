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

  test('button should be properly aligned and centered', async ({ page }) => {
    const scanButton = page.getByRole('button', { name: 'Start Scanning' });

    // Button should be visible and enabled
    await expect(scanButton).toBeVisible();
    await expect(scanButton).toBeEnabled();

    // Get the button's bounding box
    const buttonBox = await scanButton.boundingBox();
    expect(buttonBox).toBeTruthy();

    if (buttonBox) {
      // Get viewport width
      const viewport = page.viewportSize();
      expect(viewport).toBeTruthy();

      if (viewport) {
        // Button should be reasonably centered (within 20% tolerance for auto-width buttons)
        const buttonCenter = buttonBox.x + buttonBox.width / 2;
        const viewportCenter = viewport.width / 2;
        const tolerance = viewport.width * 0.2;

        expect(Math.abs(buttonCenter - viewportCenter)).toBeLessThan(tolerance);
      }

      // Button should have proper height (lg size = 56px minimum)
      expect(buttonBox.height).toBeGreaterThanOrEqual(56);
    }

    // Verify the button's icon and text are properly aligned within the button
    const buttonStyles = await scanButton.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        display: styles.display,
        alignItems: styles.alignItems,
        justifyContent: styles.justifyContent,
      };
    });

    // Button should use flex layout with proper alignment
    expect(buttonStyles.display).toBe('flex');
    expect(buttonStyles.alignItems).toBe('center');
    expect(buttonStyles.justifyContent).toBe('center');

    // Take screenshot showing button alignment
    await page.screenshot({ path: 'tests/screenshots/04-button-alignment.png', fullPage: true });
  });

  test('button should be aligned on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Scan' }).click();

    const scanButton = page.getByRole('button', { name: 'Start Scanning' });
    await expect(scanButton).toBeVisible();

    // Get the button's bounding box
    const buttonBox = await scanButton.boundingBox();
    expect(buttonBox).toBeTruthy();

    if (buttonBox) {
      // Get viewport width
      const viewport = page.viewportSize();
      expect(viewport).toBeTruthy();

      if (viewport) {
        // Button should be reasonably centered on mobile (within 20% tolerance)
        const buttonCenter = buttonBox.x + buttonBox.width / 2;
        const viewportCenter = viewport.width / 2;
        const tolerance = viewport.width * 0.2;

        expect(Math.abs(buttonCenter - viewportCenter)).toBeLessThan(tolerance);
      }
    }

    // Verify the button's internal alignment on mobile
    const buttonStyles = await scanButton.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        display: styles.display,
        alignItems: styles.alignItems,
        justifyContent: styles.justifyContent,
      };
    });

    expect(buttonStyles.display).toBe('flex');
    expect(buttonStyles.alignItems).toBe('center');
    expect(buttonStyles.justifyContent).toBe('center');

    // Take mobile screenshot
    await page.screenshot({ path: 'tests/screenshots/04-mobile-button-alignment.png', fullPage: true });
  });
});
