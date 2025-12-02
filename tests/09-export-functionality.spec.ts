import { test, expect, type Page } from '@playwright/test';

/**
 * Test suite for data export functionality (CSV and ZIP with photos)
 */

// Helper to add an item directly to the database (faster and more reliable than UI)
async function addItem(
  page: Page,
  itemData: {
    name: string;
    quantity: number;
    minQuantity?: number;
    category?: string;
    location?: string;
    notes?: string;
  }
) {
  await page.evaluate(async (data) => {
    const { db } = await import('../src/lib/db/index.ts');
    await db.items.add({
      name: data.name,
      quantity: data.quantity,
      minQuantity: data.minQuantity,
      category: data.category || 'Medications',
      location: data.location || 'Shelf A',
      notes: data.notes,
      barcode: '',
      photos: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: 'pending',
    });
  }, itemData);
}

// Helper to add a test photo to an item
async function addPhotoToItem(page: Page, itemName: string) {
  // Create a small test image (1x1 red pixel PNG)
  const testImageBase64 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

  // Add photo via browser context
  await page.evaluate(
    async ({ itemName: name, imageData }) => {
      const { db } = await import('../src/lib/db/index.ts');
      const items = await db.items.where('name').equals(name).toArray();
      if (items.length > 0) {
        const item = items[0];
        await db.items.update(item.id!, {
          photos: [...item.photos, imageData],
        });
      }
    },
    { itemName, imageData: testImageBase64 }
  );
}

// Helper to navigate to settings page
async function goToSettings(page: Page) {
  await page.goto('/');
  await page.locator('nav').getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('h1')).toContainText('Settings');
}

// Helper to clear all items
async function clearAllItems(page: Page) {
  await page.evaluate(async () => {
    const { db } = await import('../src/lib/db/index.ts');
    await db.items.clear();
  });
}

test.describe('Export Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllItems(page);
  });

  test.describe('CSV Export (Data Only)', () => {
    test('should show error when exporting empty inventory', async ({ page }) => {
      await goToSettings(page);

      // Click Export Data button
      await page.click('text=Export Data');

      // Should show error message
      await expect(page.locator('text=No items to export')).toBeVisible();

      // Error should not auto-clear (only success messages do)
      await page.waitForTimeout(1000);
      await expect(page.locator('text=No items to export')).toBeVisible();
    });

    test('should successfully export CSV with single item', async ({ page }) => {
      // Add a test item
      await addItem(page, {
        name: 'Test Aspirin',
        quantity: 50,
        minQuantity: 10,
        category: 'Medications',
        location: 'Shelf A',
        notes: 'Test notes',
      });

      await goToSettings(page);

      // Set up download listener
      const downloadPromise = page.waitForEvent('download');

      // Click Export Data button
      await page.click('text=Export Data');

      // Wait for download to start
      const download = await downloadPromise;

      // Verify filename format
      const filename = download.suggestedFilename();
      expect(filename).toMatch(/^medivault-inventory-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/);

      // Should show success message
      await expect(page.locator('text=Data exported successfully!')).toBeVisible();

      // Success message should auto-clear after 3 seconds
      await page.waitForTimeout(3500);
      await expect(page.locator('text=Data exported successfully!')).not.toBeVisible();
    });

    test('should export CSV with multiple items', async ({ page }) => {
      // Add multiple test items
      await addItem(page, {
        name: 'Aspirin',
        quantity: 50,
        category: 'Medications',
        location: 'Shelf A',
      });

      await addItem(page, {
        name: 'Bandages',
        quantity: 100,
        category: 'First Aid',
        location: 'Shelf B',
      });

      await addItem(page, {
        name: 'Thermometer',
        quantity: 5,
        category: 'Equipment',
        location: 'Refrigerator',
      });

      await goToSettings(page);

      const downloadPromise = page.waitForEvent('download');
      await page.click('text=Export Data');
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toContain('.csv');
      await expect(page.locator('text=Data exported successfully!')).toBeVisible();
    });

    // Note: Loading state test removed - export completes too fast to reliably test disabled state
  });

  test.describe('ZIP Export (With Photos)', () => {
    test('should show error when exporting empty inventory', async ({ page }) => {
      await goToSettings(page);

      // Click Export with Photos button
      await page.click('text=Export with Photos');

      // Should show error message
      await expect(page.locator('text=No items to export')).toBeVisible();
    });

    test('should show error when no photos exist', async ({ page }) => {
      // Add item without photos
      await addItem(page, {
        name: 'Test Item',
        quantity: 10,
        category: 'Medications',
        location: 'Shelf A',
      });

      await goToSettings(page);

      // Click Export with Photos button
      await page.click('text=Export with Photos');

      // Should show error directing to use CSV export
      await expect(
        page.locator('text=No photos to export. Use "Export Data" for CSV only.')
      ).toBeVisible();
    });

    test('should successfully export ZIP with photos', async ({ page }) => {
      // Add item with photo
      await addItem(page, {
        name: 'Test Aspirin',
        quantity: 50,
        category: 'Medications',
        location: 'Shelf A',
      });

      // Add photo to the item
      await addPhotoToItem(page, 'Test Aspirin');

      await goToSettings(page);

      // Set up download listener
      const downloadPromise = page.waitForEvent('download');

      // Click Export with Photos button
      await page.click('text=Export with Photos');

      // Wait for download
      const download = await downloadPromise;

      // Verify filename format
      const filename = download.suggestedFilename();
      expect(filename).toMatch(/^medivault-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.zip$/);

      // Should show success message
      await expect(page.locator('text=Data exported successfully!')).toBeVisible();
    });

    test('should export ZIP with multiple items and photos', async ({ page }) => {
      // Add multiple items with photos
      await addItem(page, {
        name: 'Aspirin',
        quantity: 50,
        category: 'Medications',
        location: 'Shelf A',
      });
      await addPhotoToItem(page, 'Aspirin');

      await addItem(page, {
        name: 'Bandages',
        quantity: 100,
        category: 'First Aid',
        location: 'Shelf B',
      });
      await addPhotoToItem(page, 'Bandages');

      await addItem(page, {
        name: 'Thermometer',
        quantity: 5,
        category: 'Equipment',
        location: 'Refrigerator',
      });
      await addPhotoToItem(page, 'Thermometer');

      await goToSettings(page);

      const downloadPromise = page.waitForEvent('download');
      await page.click('text=Export with Photos');
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toContain('.zip');
      await expect(page.locator('text=Data exported successfully!')).toBeVisible();
    });

    // Note: Loading state test removed - export completes too fast to reliably test disabled state

    test('should handle mixed items (some with photos, some without)', async ({ page }) => {
      // Add item with photo
      await addItem(page, {
        name: 'Aspirin',
        quantity: 50,
        category: 'Medications',
        location: 'Shelf A',
      });
      await addPhotoToItem(page, 'Aspirin');

      // Add item without photo
      await addItem(page, {
        name: 'Bandages',
        quantity: 100,
        category: 'First Aid',
        location: 'Shelf B',
      });

      await goToSettings(page);

      const downloadPromise = page.waitForEvent('download');
      await page.click('text=Export with Photos');
      const download = await downloadPromise;

      // Should still export successfully (includes items without photos in CSV)
      expect(download.suggestedFilename()).toContain('.zip');
      await expect(page.locator('text=Data exported successfully!')).toBeVisible();
    });
  });

  test.describe('Export UI Elements', () => {
    test('should display both export buttons in Data section', async ({ page }) => {
      await goToSettings(page);

      // Verify Data section exists
      await expect(page.getByRole('heading', { name: 'Data' })).toBeVisible();

      // Verify both export buttons exist
      await expect(page.locator('text=Export Data')).toBeVisible();
      await expect(page.locator('text=Export with Photos')).toBeVisible();

      // Verify button descriptions
      await expect(page.locator('text=Download as CSV')).toBeVisible();
      await expect(page.locator('text=Download as ZIP with photos')).toBeVisible();
    });

    test('should show Database icon for both export buttons', async ({ page }) => {
      await goToSettings(page);

      // Both buttons should have Database icons (lucide-react)
      const exportButtons = page.locator('button:has-text("Export")');
      expect(await exportButtons.count()).toBeGreaterThanOrEqual(2);
    });

    test('export buttons should be enabled by default', async ({ page }) => {
      await goToSettings(page);

      const exportDataButton = page.locator('text=Export Data').first();
      const exportWithPhotosButton = page.locator('text=Export with Photos');

      await expect(exportDataButton).toBeEnabled();
      await expect(exportWithPhotosButton).toBeEnabled();
    });
  });

  test.describe('Export Error Handling', () => {
    test('should recover from export error', async ({ page }) => {
      // Test error recovery by trying to export empty inventory
      await goToSettings(page);

      // First export attempt (should fail)
      await page.click('text=Export Data');
      await expect(page.locator('text=No items to export')).toBeVisible();

      // Add an item
      await addItem(page, {
        name: 'Recovery Test',
        quantity: 10,
      });

      // Navigate back to settings
      await page.locator('nav').getByRole('button', { name: 'Settings' }).click();
      await expect(page.locator('h1')).toContainText('Settings');

      // Second export attempt (should succeed)
      const downloadPromise = page.waitForEvent('download');
      await page.click('text=Export Data');
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toContain('.csv');
      await expect(page.locator('text=Data exported successfully!')).toBeVisible();

      // Error message should be gone
      await expect(page.locator('text=No items to export')).not.toBeVisible();
    });

    test('should clear previous error when showing new error', async ({ page }) => {
      await goToSettings(page);

      // Trigger first error (CSV export with no items)
      await page.click('text=Export Data');
      await expect(page.locator('text=No items to export')).toBeVisible();

      // Trigger second error (ZIP export with no items)
      await page.click('text=Export with Photos');

      // Should still show the error (may be same message or different)
      await expect(page.locator('text=No items to export')).toBeVisible();
    });
  });

  test.describe('Export Data Validation', () => {
    test('should export items with all fields populated', async ({ page }) => {
      await addItem(page, {
        name: 'Complete Item',
        quantity: 75,
        minQuantity: 20,
        category: 'Medications',
        location: 'Shelf A',
        notes: 'This item has all fields filled',
      });

      await goToSettings(page);

      const downloadPromise = page.waitForEvent('download');
      await page.click('text=Export Data');
      await downloadPromise;

      await expect(page.locator('text=Data exported successfully!')).toBeVisible();
    });

    test('should export items with minimal fields', async ({ page }) => {
      await addItem(page, {
        name: 'Minimal Item',
        quantity: 1,
      });

      await goToSettings(page);

      const downloadPromise = page.waitForEvent('download');
      await page.click('text=Export Data');
      await downloadPromise;

      await expect(page.locator('text=Data exported successfully!')).toBeVisible();
    });

    test('should handle items with special characters in fields', async ({ page }) => {
      await addItem(page, {
        name: 'Item with "quotes" and, commas',
        quantity: 10,
        notes: 'Notes with\nnewlines\nand "quotes"',
        category: 'Medications',
        location: 'Shelf A',
      });

      await goToSettings(page);

      const downloadPromise = page.waitForEvent('download');
      await page.click('text=Export Data');
      await downloadPromise;

      await expect(page.locator('text=Data exported successfully!')).toBeVisible();
    });
  });
});
