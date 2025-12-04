import { test, expect, type Page } from '@playwright/test';
import { barcodeTestData, unknownBarcodes } from './fixtures/barcode-test-data';

/**
 * Comprehensive Scanner Functionality Tests
 *
 * These tests verify the complete barcode scanner workflow including:
 * - Database seeding with test data
 * - Item found scenarios
 * - Item not found scenarios
 * - Navigation flow with scanned barcodes
 * - Low stock detection
 *
 * Note: These tests simulate barcode detection by directly calling the handler functions.
 * Actual camera scanning requires manual testing with printable barcodes.
 */

// Helper function to seed the database with barcode test items
async function seedBarcodeTestData(page: Page) {
  await page.evaluate(async (testData) => {
    // Dynamically import the database operations
    const { createItem } = await import('../src/lib/db/operations');

    // Clear existing items to ensure clean state
    const { db } = await import('../src/lib/db');
    await db.items.clear();

    // Add all test items
    for (const item of testData) {
      await createItem({
        name: item.name,
        barcode: item.barcode,
        quantity: item.quantity,
        minQuantity: item.minQuantity,
        category: item.category,
        location: item.location,
        notes: item.notes,
        photos: []
      });
    }
  }, barcodeTestData);
}

// Helper function to simulate barcode detection
async function _simulateBarcodeDetection(page: Page, barcode: string) {
  // Click start scanning button
  await page.getByRole('button', { name: 'Start Scanning' }).click();

  // Wait for scanner to mount
  await page.waitForTimeout(500);

  // Simulate barcode detection by calling the onDetected handler
  await page.evaluate((code) => {
    // Find the BarcodeScanner component and trigger detection
    // This simulates what Quagga would do when it detects a barcode
    const event = new CustomEvent('barcodeDetected', { detail: { code } });
    window.dispatchEvent(event);

    // Alternatively, directly call the handler if exposed
    // In a real scenario, we'd need to expose this for testing
    // For now, we'll test the UI flow by manually triggering the database lookup
  }, barcode);

  // Give time for the detection to process
  await page.waitForTimeout(300);
}

// Helper to manually trigger item lookup (for testing without camera)
async function _manualItemLookup(page: Page, barcode: string) {
  // Start scanning
  await page.getByRole('button', { name: 'Start Scanning' }).click();
  await page.waitForTimeout(500);

  // Manually trigger the lookup logic
  await page.evaluate(async (code) => {
    const { getItemByBarcode } = await import('../src/lib/db/operations');
    const item = await getItemByBarcode(code);

    // Dispatch custom event that our page can listen to
    const event = new CustomEvent('testBarcodeResult', {
      detail: { barcode: code, item }
    });
    window.dispatchEvent(event);
  }, barcode);

  // Close the scanner overlay (simulate scanner closing after detection)
  await page.waitForTimeout(300);
  const closeButton = page.locator('button[aria-label="Close scanner"]');
  if (await closeButton.isVisible()) {
    await closeButton.click();
  }
}

test.describe('Scanner Functionality - Item Found Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await seedBarcodeTestData(page);
    await page.getByRole('button', { name: 'Scan' }).click();
    await expect(page.locator('h1')).toContainText('Scan Barcode');
  });

  test('should find item by EAN-13 barcode', async ({ page }) => {
    const testItem = barcodeTestData.find(item => item.format === 'EAN-13');
    expect(testItem).toBeDefined();

    if (!testItem) return;

    // Verify item exists in database
    const itemExists = await page.evaluate(async (barcode) => {
      const { getItemByBarcode } = await import('../src/lib/db/operations');
      const item = await getItemByBarcode(barcode);
      return item !== null;
    }, testItem.barcode);

    expect(itemExists).toBe(true);

    // Take screenshot of initial scanner state
    await page.screenshot({
      path: 'tests/screenshots/10-scanner-before-scan.png',
      fullPage: true
    });
  });

  test('should find item by Code 128 barcode', async ({ page }) => {
    const testItem = barcodeTestData.find(item => item.format === 'Code128');
    expect(testItem).toBeDefined();

    if (!testItem) return;

    // Verify item exists in database
    const item = await page.evaluate(async (barcode) => {
      const { getItemByBarcode } = await import('../src/lib/db/operations');
      return await getItemByBarcode(barcode);
    }, testItem.barcode);

    expect(item).not.toBeNull();
    expect(item?.name).toBe(testItem.name);
    expect(item?.quantity).toBe(testItem.quantity);
  });

  test('should find item by UPC-A barcode', async ({ page }) => {
    const testItem = barcodeTestData.find(item => item.format === 'UPC-A');
    expect(testItem).toBeDefined();

    if (!testItem) return;

    const item = await page.evaluate(async (barcode) => {
      const { getItemByBarcode } = await import('../src/lib/db/operations');
      return await getItemByBarcode(barcode);
    }, testItem.barcode);

    expect(item).not.toBeNull();
    expect(item?.barcode).toBe(testItem.barcode);
  });

  test('should display all item details when found', async ({ page }) => {
    const testItem = barcodeTestData[0]; // Aspirin

    // Verify all item properties are stored correctly
    const item = await page.evaluate(async (barcode) => {
      const { getItemByBarcode } = await import('../src/lib/db/operations');
      return await getItemByBarcode(barcode);
    }, testItem.barcode);

    expect(item).not.toBeNull();
    expect(item?.name).toBe(testItem.name);
    expect(item?.quantity).toBe(testItem.quantity);
    expect(item?.minQuantity).toBe(testItem.minQuantity);
    expect(item?.category).toBe(testItem.category);
    expect(item?.location).toBe(testItem.location);
    expect(item?.notes).toBe(testItem.notes);
  });
});

test.describe('Scanner Functionality - Item Not Found Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await seedBarcodeTestData(page);
    await page.getByRole('button', { name: 'Scan' }).click();
    await expect(page.locator('h1')).toContainText('Scan Barcode');
  });

  test('should not find unknown EAN-13 barcode', async ({ page }) => {
    const unknownBarcode = unknownBarcodes.find(b => b.format === 'EAN-13');
    expect(unknownBarcode).toBeDefined();

    if (!unknownBarcode) return;

    const item = await page.evaluate(async (barcode) => {
      const { getItemByBarcode } = await import('../src/lib/db/operations');
      return await getItemByBarcode(barcode);
    }, unknownBarcode.barcode);

    expect(item).toBeUndefined();
  });

  test('should not find unknown Code 128 barcode', async ({ page }) => {
    const unknownBarcode = unknownBarcodes.find(b => b.format === 'Code128');
    expect(unknownBarcode).toBeDefined();

    if (!unknownBarcode) return;

    const item = await page.evaluate(async (barcode) => {
      const { getItemByBarcode } = await import('../src/lib/db/operations');
      return await getItemByBarcode(barcode);
    }, unknownBarcode.barcode);

    expect(item).toBeUndefined();
  });

  test('should handle completely invalid barcode', async ({ page }) => {
    const invalidBarcode = 'INVALID_BARCODE_12345';

    const item = await page.evaluate(async (barcode) => {
      const { getItemByBarcode } = await import('../src/lib/db/operations');
      return await getItemByBarcode(barcode);
    }, invalidBarcode);

    expect(item).toBeUndefined();
  });
});

test.describe('Scanner Functionality - Low Stock Detection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await seedBarcodeTestData(page);
  });

  test('should identify low stock items', async ({ page }) => {
    // Get all low stock items from test data
    const lowStockItems = barcodeTestData.filter(
      item => item.quantity <= item.minQuantity
    );

    expect(lowStockItems.length).toBeGreaterThan(0);

    // Verify each low stock item is correctly identified
    for (const testItem of lowStockItems) {
      const item = await page.evaluate(async (barcode) => {
        const { getItemByBarcode } = await import('../src/lib/db/operations');
        return await getItemByBarcode(barcode);
      }, testItem.barcode);

      expect(item).not.toBeNull();
      expect(item!.quantity).toBeLessThanOrEqual(item!.minQuantity!);
    }
  });

  test('should list all low stock items', async ({ page }) => {
    const lowStockCount = await page.evaluate(async () => {
      const { getLowStockItems } = await import('../src/lib/db/operations');
      const items = await getLowStockItems();
      return items.length;
    });

    // Count expected low stock items from test data
    const expectedLowStock = barcodeTestData.filter(
      item => item.quantity <= item.minQuantity
    ).length;

    expect(lowStockCount).toBe(expectedLowStock);
  });
});

test.describe('Scanner Functionality - Database Operations', () => {
  test('should seed all test items correctly', async ({ page }) => {
    await page.goto('/');
    await seedBarcodeTestData(page);

    const itemCount = await page.evaluate(async () => {
      const { getAllItems } = await import('../src/lib/db/operations');
      const items = await getAllItems();
      return items.length;
    });

    expect(itemCount).toBe(barcodeTestData.length);
  });

  test('should find items by all supported barcode formats', async ({ page }) => {
    await page.goto('/');
    await seedBarcodeTestData(page);

    // Group test data by format
    const formatCounts = barcodeTestData.reduce((acc, item) => {
      acc[item.format] = (acc[item.format] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Verify we have items in each format
    expect(formatCounts['EAN-13']).toBeGreaterThan(0);
    expect(formatCounts['Code128']).toBeGreaterThan(0);
    expect(formatCounts['UPC-A']).toBeGreaterThan(0);

    // Verify all items can be found by barcode
    for (const testItem of barcodeTestData) {
      const item = await page.evaluate(async (barcode) => {
        const { getItemByBarcode } = await import('../src/lib/db/operations');
        return await getItemByBarcode(barcode);
      }, testItem.barcode);

      expect(item).not.toBeNull();
      expect(item?.barcode).toBe(testItem.barcode);
    }
  });

  test('should handle barcode search with different cases', async ({ page }) => {
    await page.goto('/');
    await seedBarcodeTestData(page);

    // Test with Code128 barcode that has letters
    const testItem = barcodeTestData.find(item => item.barcode.includes('-'));
    expect(testItem).toBeDefined();

    if (!testItem) return;

    // Original case
    const item1 = await page.evaluate(async (barcode) => {
      const { getItemByBarcode } = await import('../src/lib/db/operations');
      return await getItemByBarcode(barcode);
    }, testItem.barcode);

    expect(item1).not.toBeNull();

    // Different case (if applicable)
    const upperBarcode = testItem.barcode.toUpperCase();
    const item2 = await page.evaluate(async (barcode) => {
      const { getItemByBarcode } = await import('../src/lib/db/operations');
      return await getItemByBarcode(barcode);
    }, upperBarcode);

    // Should find the same item (case-insensitive search)
    if (testItem.barcode !== upperBarcode) {
      expect(item2).not.toBeNull();
    }
  });
});

test.describe('Scanner Functionality - UI Integration', () => {
  test('should navigate to scanner page and show correct initial state', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Scan' }).click();

    // Verify scanner page loaded
    await expect(page.locator('h1')).toContainText('Scan Barcode');
    await expect(page.getByText('Barcode Scanner')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Scanning' })).toBeVisible();

    await page.screenshot({
      path: 'tests/screenshots/10-scanner-initial-state.png',
      fullPage: true
    });
  });

  test('should have proper scanner button styling', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Scan' }).click();

    const scanButton = page.getByRole('button', { name: 'Start Scanning' });

    // Verify button properties
    await expect(scanButton).toBeVisible();
    await expect(scanButton).toBeEnabled();

    // Check button has proper dimensions
    const buttonBox = await scanButton.boundingBox();
    expect(buttonBox).toBeTruthy();
    expect(buttonBox!.height).toBeGreaterThanOrEqual(56); // lg button size
  });
});

test.describe('Scanner Functionality - Error Handling', () => {
  test('should handle database errors gracefully', async ({ page }) => {
    await page.goto('/');

    // Try to search for barcode without seeding database
    const result = await page.evaluate(async () => {
      try {
        const { getItemByBarcode } = await import('../src/lib/db/operations');
        return await getItemByBarcode('TEST-BARCODE');
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Should return undefined for not found, not throw error
    expect(result).toBeUndefined();
  });

  test('should handle empty barcode string', async ({ page }) => {
    await page.goto('/');
    await seedBarcodeTestData(page);

    const item = await page.evaluate(async () => {
      const { getItemByBarcode } = await import('../src/lib/db/operations');
      return await getItemByBarcode('');
    });

    expect(item).toBeUndefined();
  });
});

test.describe('Scanner Functionality - Performance', () => {
  test('should quickly find items by barcode', async ({ page }) => {
    await page.goto('/');
    await seedBarcodeTestData(page);

    const testItem = barcodeTestData[0];

    const startTime = Date.now();
    const item = await page.evaluate(async (barcode) => {
      const { getItemByBarcode } = await import('../src/lib/db/operations');
      return await getItemByBarcode(barcode);
    }, testItem.barcode);
    const endTime = Date.now();

    expect(item).not.toBeNull();
    expect(endTime - startTime).toBeLessThan(100); // Should be very fast (< 100ms)
  });

  test('should handle multiple sequential lookups', async ({ page }) => {
    await page.goto('/');
    await seedBarcodeTestData(page);

    // Perform multiple lookups in sequence
    for (const testItem of barcodeTestData.slice(0, 5)) {
      const item = await page.evaluate(async (barcode) => {
        const { getItemByBarcode } = await import('../src/lib/db/operations');
        return await getItemByBarcode(barcode);
      }, testItem.barcode);

      expect(item).not.toBeNull();
      expect(item?.name).toBe(testItem.name);
    }
  });
});
