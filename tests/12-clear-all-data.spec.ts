import { test, expect, type Page } from '@playwright/test';

/**
 * Test suite for Clear All Data functionality
 * This is a destructive operation that permanently deletes user data.
 */

// Helper to add an item directly to the database
async function addItem(
  page: Page,
  itemData: {
    name: string;
    quantity: number;
    category?: string;
    location?: string;
  }
) {
  await page.evaluate(async (data) => {
    const { db } = await import('../src/lib/db/index.ts');
    await db.items.add({
      name: data.name,
      quantity: data.quantity,
      minQuantity: 0,
      category: data.category || 'Medications',
      location: data.location || 'Shelf A',
      notes: '',
      barcode: '',
      photos: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: 'pending',
    });
  }, itemData);
}

// Helper to get item count from the database
async function getItemCount(page: Page): Promise<number> {
  return await page.evaluate(async () => {
    const { db } = await import('../src/lib/db/index.ts');
    return await db.items.count();
  });
}

// Helper to get category count from the database
async function getCategoryCount(page: Page): Promise<number> {
  return await page.evaluate(async () => {
    const { db } = await import('../src/lib/db/index.ts');
    return await db.categories.count();
  });
}

// Helper to get location count from the database
async function getLocationCount(page: Page): Promise<number> {
  return await page.evaluate(async () => {
    const { db } = await import('../src/lib/db/index.ts');
    return await db.locations.count();
  });
}

// Helper to navigate to settings page
async function goToSettings(page: Page) {
  await page.goto('/');
  await page.locator('nav').getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('h1')).toContainText('Settings');
}

// Helper to clear all items (for test setup)
async function clearAllItems(page: Page) {
  await page.evaluate(async () => {
    const { db } = await import('../src/lib/db/index.ts');
    await db.items.clear();
  });
}

// Helper to click the Clear All Data button in Settings page
async function clickClearAllDataButton(page: Page) {
  // Use a more specific selector that targets the button in the settings page
  await page.locator('button').filter({ hasText: 'Clear All Data' }).first().click();
}

test.describe('Clear All Data Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllItems(page);
  });

  test.describe('Confirmation Dialog', () => {
    test('should show confirmation dialog when clicking Clear All Data', async ({ page }) => {
      await goToSettings(page);
      await clickClearAllDataButton(page);

      // Should show the confirmation dialog
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Clear All Data?' })).toBeVisible();

      // Take screenshot
      await page.screenshot({
        path: 'tests/screenshots/12-clear-data-dialog.png',
        fullPage: true,
      });
    });

    test('should display correct warning message in dialog', async ({ page }) => {
      await goToSettings(page);
      await clickClearAllDataButton(page);

      // Should show the warning message about permanent deletion
      await expect(
        page.getByText('This will permanently delete all inventory items.')
      ).toBeVisible();
      await expect(
        page.getByText('Categories and locations will be preserved.')
      ).toBeVisible();
      await expect(page.getByText('This action cannot be undone.')).toBeVisible();
    });

    test('should display danger variant with red icon', async ({ page }) => {
      await goToSettings(page);
      await clickClearAllDataButton(page);

      // Should show the red alert icon (danger variant)
      const alertIcon = page.locator('.bg-red-100');
      await expect(alertIcon).toBeVisible();

      // Title should have danger styling
      const title = page.getByRole('heading', { name: 'Clear All Data?' });
      await expect(title).toHaveClass(/text-red-900/);
    });

    test('should show Cancel and Clear All Data buttons', async ({ page }) => {
      await goToSettings(page);
      await clickClearAllDataButton(page);

      // Should show both buttons inside the dialog
      const dialog = page.getByRole('alertdialog');
      await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Clear All Data' })).toBeVisible();
    });
  });

  test.describe('Cancel Behavior', () => {
    test('should close dialog and preserve data when clicking Cancel', async ({ page }) => {
      // Add test items
      await addItem(page, { name: 'Aspirin', quantity: 50 });
      await addItem(page, { name: 'Bandages', quantity: 100 });

      const initialCount = await getItemCount(page);
      expect(initialCount).toBe(2);

      await goToSettings(page);
      await clickClearAllDataButton(page);

      // Click Cancel
      await page.getByRole('button', { name: 'Cancel' }).click();

      // Dialog should be closed
      await expect(page.getByRole('alertdialog')).not.toBeVisible();

      // Data should be preserved
      const finalCount = await getItemCount(page);
      expect(finalCount).toBe(2);
    });

    test('should close dialog when pressing Escape key', async ({ page }) => {
      await goToSettings(page);
      await clickClearAllDataButton(page);

      // Dialog should be open
      await expect(page.getByRole('alertdialog')).toBeVisible();

      // Press Escape
      await page.keyboard.press('Escape');

      // Dialog should be closed
      await expect(page.getByRole('alertdialog')).not.toBeVisible();
    });

    test('should close dialog when clicking backdrop', async ({ page }) => {
      await goToSettings(page);
      await clickClearAllDataButton(page);

      // Dialog should be open
      await expect(page.getByRole('alertdialog')).toBeVisible();

      // Click on backdrop (outside the dialog)
      await page.click('.bg-black.bg-opacity-50', { position: { x: 10, y: 10 } });

      // Dialog should be closed
      await expect(page.getByRole('alertdialog')).not.toBeVisible();
    });

    test('should not close dialog when clicking inside dialog content', async ({ page }) => {
      await goToSettings(page);
      await clickClearAllDataButton(page);

      // Dialog should be open
      await expect(page.getByRole('alertdialog')).toBeVisible();

      // Click inside the dialog (on the message text)
      await page.getByText('This will permanently delete all inventory items.').click();

      // Dialog should still be open
      await expect(page.getByRole('alertdialog')).toBeVisible();
    });
  });

  test.describe('Confirm Behavior', () => {
    test('should clear all items when clicking Confirm', async ({ page }) => {
      // Add test items
      await addItem(page, { name: 'Aspirin', quantity: 50 });
      await addItem(page, { name: 'Bandages', quantity: 100 });
      await addItem(page, { name: 'Thermometer', quantity: 5 });

      const initialCount = await getItemCount(page);
      expect(initialCount).toBe(3);

      await goToSettings(page);
      await clickClearAllDataButton(page);

      // Click Confirm button inside the dialog
      const dialog = page.getByRole('alertdialog');
      await dialog.getByRole('button', { name: 'Clear All Data' }).click();

      // Wait for success message
      await expect(
        page.getByText('All inventory data cleared successfully!')
      ).toBeVisible();

      // Items should be cleared
      const finalCount = await getItemCount(page);
      expect(finalCount).toBe(0);

      // Take screenshot
      await page.screenshot({
        path: 'tests/screenshots/12-clear-data-success.png',
        fullPage: true,
      });
    });

    test('should preserve categories after clearing data', async ({ page }) => {
      // Add test items
      await addItem(page, { name: 'Test Item', quantity: 10, category: 'Medications' });

      const initialCategoryCount = await getCategoryCount(page);
      expect(initialCategoryCount).toBeGreaterThan(0);

      await goToSettings(page);
      await clickClearAllDataButton(page);

      // Click Confirm button inside the dialog
      const dialog = page.getByRole('alertdialog');
      await dialog.getByRole('button', { name: 'Clear All Data' }).click();

      // Wait for success message
      await expect(
        page.getByText('All inventory data cleared successfully!')
      ).toBeVisible();

      // Categories should be preserved
      const finalCategoryCount = await getCategoryCount(page);
      expect(finalCategoryCount).toBe(initialCategoryCount);
    });

    test('should preserve locations after clearing data', async ({ page }) => {
      // Add test items
      await addItem(page, { name: 'Test Item', quantity: 10, location: 'Shelf A' });

      const initialLocationCount = await getLocationCount(page);
      expect(initialLocationCount).toBeGreaterThan(0);

      await goToSettings(page);
      await clickClearAllDataButton(page);

      // Click Confirm button inside the dialog
      const dialog = page.getByRole('alertdialog');
      await dialog.getByRole('button', { name: 'Clear All Data' }).click();

      // Wait for success message
      await expect(
        page.getByText('All inventory data cleared successfully!')
      ).toBeVisible();

      // Locations should be preserved
      const finalLocationCount = await getLocationCount(page);
      expect(finalLocationCount).toBe(initialLocationCount);
    });

    test('should close dialog after successful clear', async ({ page }) => {
      await addItem(page, { name: 'Test Item', quantity: 10 });

      await goToSettings(page);
      await clickClearAllDataButton(page);

      // Click Confirm button inside the dialog
      const dialog = page.getByRole('alertdialog');
      await dialog.getByRole('button', { name: 'Clear All Data' }).click();

      // Wait for success message
      await expect(
        page.getByText('All inventory data cleared successfully!')
      ).toBeVisible();

      // Dialog should be closed
      await expect(page.getByRole('alertdialog')).not.toBeVisible();
    });

    test('should display success message that auto-clears after 3 seconds', async ({ page }) => {
      await addItem(page, { name: 'Test Item', quantity: 10 });

      await goToSettings(page);
      await clickClearAllDataButton(page);

      // Click Confirm button inside the dialog
      const dialog = page.getByRole('alertdialog');
      await dialog.getByRole('button', { name: 'Clear All Data' }).click();

      // Success message should be visible
      await expect(
        page.getByText('All inventory data cleared successfully!')
      ).toBeVisible();

      // Wait for message to auto-clear (3 seconds + buffer)
      await page.waitForTimeout(3500);

      // Success message should no longer be visible
      await expect(
        page.getByText('All inventory data cleared successfully!')
      ).not.toBeVisible();
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle clearing when no items exist', async ({ page }) => {
      // Ensure no items exist
      const initialCount = await getItemCount(page);
      expect(initialCount).toBe(0);

      await goToSettings(page);
      await clickClearAllDataButton(page);

      // Click Confirm button inside the dialog
      const dialog = page.getByRole('alertdialog');
      await dialog.getByRole('button', { name: 'Clear All Data' }).click();

      // Should still show success message (clearing empty is valid)
      await expect(
        page.getByText('All inventory data cleared successfully!')
      ).toBeVisible();
    });

    test('should update home page to show empty state after clearing', async ({ page }) => {
      // Add test items
      await addItem(page, { name: 'Aspirin', quantity: 50 });
      await addItem(page, { name: 'Bandages', quantity: 100 });

      // Navigate to home and verify items exist
      await page.goto('/');
      await expect(page.getByText('Aspirin')).toBeVisible();
      await expect(page.getByText('Bandages')).toBeVisible();

      // Clear all data
      await goToSettings(page);
      await clickClearAllDataButton(page);
      const dialog = page.getByRole('alertdialog');
      await dialog.getByRole('button', { name: 'Clear All Data' }).click();

      // Wait for success
      await expect(
        page.getByText('All inventory data cleared successfully!')
      ).toBeVisible();

      // Navigate to home
      await page.locator('nav').getByRole('button', { name: 'Home' }).click();

      // Should show empty state
      await expect(page.getByText('No items yet')).toBeVisible();

      // Take screenshot of empty state
      await page.screenshot({
        path: 'tests/screenshots/12-clear-data-empty-home.png',
        fullPage: true,
      });
    });
  });

  test.describe('UI Elements', () => {
    test('should display Clear All Data button in Data section', async ({ page }) => {
      await goToSettings(page);

      // Verify Data section exists
      await expect(page.getByRole('heading', { name: 'Data' })).toBeVisible();

      // Verify Clear All Data button exists with red styling
      const clearButton = page.locator('button').filter({ hasText: 'Clear All Data' });
      await expect(clearButton).toBeVisible();
      await expect(clearButton).toHaveClass(/text-red-600/);

      // Verify warning text
      await expect(page.getByText('This cannot be undone')).toBeVisible();
    });

    test('should show Database icon for Clear All Data button', async ({ page }) => {
      await goToSettings(page);

      // Clear button should have Database icon
      const clearButton = page.locator('button').filter({ hasText: 'Clear All Data' });
      await expect(clearButton.locator('svg')).toBeVisible();
    });
  });
});

test.describe('Clear All Data - Mobile', () => {
  test('should display confirmation dialog properly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await goToSettings(page);
    await clickClearAllDataButton(page);

    // Dialog should be visible and properly sized
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Clear All Data?' })).toBeVisible();

    // Both buttons should be visible inside the dialog
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Clear All Data' })).toBeVisible();

    // Take mobile screenshot
    await page.screenshot({
      path: 'tests/screenshots/12-clear-data-dialog-mobile.png',
      fullPage: true,
    });
  });

  test('should clear data successfully on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Add test item
    await addItem(page, { name: 'Mobile Test Item', quantity: 10 });

    await goToSettings(page);
    await clickClearAllDataButton(page);

    // Click Confirm button inside the dialog
    const dialog = page.getByRole('alertdialog');
    await dialog.getByRole('button', { name: 'Clear All Data' }).click();

    // Should show success message
    await expect(
      page.getByText('All inventory data cleared successfully!')
    ).toBeVisible();

    // Verify items are cleared
    const count = await getItemCount(page);
    expect(count).toBe(0);
  });
});
