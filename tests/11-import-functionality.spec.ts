import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to navigate to Settings and open Import modal
async function openImportModal(page: Page) {
  await page.goto('http://localhost:5173');

  // Wait for app to load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Navigate to Settings
  await page.getByRole('button', { name: /settings/i }).click();
  await page.waitForTimeout(300); // Wait for state-based routing
  await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();

  // Scroll page to bottom to reveal Import button
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500); // Wait for scroll to complete

  // Find Import button by text (simpler and more direct)
  const importButton = page.getByText('Import Data', { exact: true });
  await expect(importButton).toBeVisible({ timeout: 10000 });
  await importButton.click();
  await page.waitForTimeout(300); // Wait for modal animation
  await expect(page.getByText(/import inventory data/i)).toBeVisible();
}

// Helper to add a test item (for duplicate testing)
async function addTestItem(page: Page, name: string, barcode: string) {
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Click the bottom nav Add button (not the "Add Item" form button)
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  // Wait for the Add Item page to render (state-based routing, no URL change)
  await page.waitForTimeout(300);
  await expect(page.getByRole('heading', { name: /add item/i })).toBeVisible();

  // Wait for categories and locations to load
  await page.waitForSelector('select[name="category"]:not([disabled])', { timeout: 5000 });
  await page.waitForSelector('select[name="location"]:not([disabled])', { timeout: 5000 });

  await page.fill('input[name="name"]', name);
  await page.fill('input[name="barcode"]', barcode);
  await page.fill('input[name="quantity"]', '50');
  await page.fill('input[name="minQuantity"]', '10');
  await page.selectOption('select[name="category"]', 'Medications');
  await page.selectOption('select[name="location"]', 'Shelf A');

  await page.getByRole('button', { name: /add item/i }).click();
  await page.waitForTimeout(500); // Wait for database write + navigation
}

test.describe('Import Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Clear database before each test
    await page.goto('http://localhost:5173');
    await page.evaluate(() => {
      return new Promise((resolve) => {
        const request = indexedDB.deleteDatabase('MedicalInventoryDB');
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      });
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    // Wait for database re-initialization
    await page.waitForTimeout(500);
  });

  test.describe('Valid CSV Import', () => {
    test('should import valid CSV file successfully', async ({ page }) => {
      await openImportModal(page);

      // Upload valid CSV
      const filePath = path.join(__dirname, 'fixtures', 'valid-import.csv');
      await page.setInputFiles('input[type="file"]', filePath);

      // Wait for file to be recognized
      await expect(page.getByText(/valid-import.csv/i)).toBeVisible();

      // Proceed to options
      await page.getByRole('button', { name: /next/i }).click();

      // Configure options (defaults should be fine)
      // Skip duplicates, create missing categories/locations
      await page.getByRole('button', { name: 'Import', exact: true }).click({ force: true });

      // Wait for import to complete
      await expect(page.getByText(/import complete/i)).toBeVisible({ timeout: 10000 });

      // Check results
      await expect(page.getByText(/3 items? imported/i)).toBeVisible();
      await expect(page.getByText(/0 items? skipped/i)).toBeVisible();

      // Close modal
      await page.getByRole('button', { name: /close/i }).click();

      // Navigate to home and verify items exist
      await page.goto('http://localhost:5173');
      await expect(page.getByText('Test Aspirin')).toBeVisible();
      await expect(page.getByText('Test Bandages')).toBeVisible();
      await expect(page.getByText('Test Thermometer')).toBeVisible();
    });

    test('should display progress during import', async ({ page }) => {
      await openImportModal(page);

      const filePath = path.join(__dirname, 'fixtures', 'valid-import.csv');
      await page.setInputFiles('input[type="file"]', filePath);
      await page.getByRole('button', { name: /next/i }).click();
      await page.getByRole('button', { name: 'Import', exact: true }).click({ force: true });

      // Check for progress phases
      await expect(page.getByText(/parsing/i)).toBeVisible({ timeout: 5000 });
      // Wait for completion
      await expect(page.getByText(/import complete/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Validation Errors', () => {
    test('should reject CSV with invalid headers', async ({ page }) => {
      await openImportModal(page);

      const filePath = path.join(__dirname, 'fixtures', 'invalid-headers.csv');
      await page.setInputFiles('input[type="file"]', filePath);
      await page.getByRole('button', { name: /next/i }).click();
      await page.getByRole('button', { name: 'Import', exact: true }).click({ force: true });

      // Should show error
      await expect(page.getByText(/invalid csv headers/i)).toBeVisible({ timeout: 10000 });
    });

    test('should reject CSV with missing required fields', async ({ page }) => {
      await openImportModal(page);

      const filePath = path.join(__dirname, 'fixtures', 'missing-fields.csv');
      await page.setInputFiles('input[type="file"]', filePath);
      await page.getByRole('button', { name: /next/i }).click();
      await page.getByRole('button', { name: 'Import', exact: true }).click({ force: true });

      // Should show validation error
      await expect(page.getByText(/validation failed/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Duplicate Handling - Skip', () => {
    test('should skip duplicate items', async ({ page }) => {
      // First, add an item that will be a duplicate
      await addTestItem(page, 'Aspirin', '111111111111');

      // Now try to import a file with the same item
      await openImportModal(page);

      const filePath = path.join(__dirname, 'fixtures', 'with-duplicates.csv');
      await page.setInputFiles('input[type="file"]', filePath);
      await page.getByRole('button', { name: /next/i }).click();

      // Select "Skip" duplicate strategy (should be default)
      await page.getByLabel(/skip/i).check();
      await page.getByRole('button', { name: 'Import', exact: true }).click({ force: true });

      // Wait for completion
      await expect(page.getByText(/import complete/i)).toBeVisible({ timeout: 10000 });

      // Should show 1 skipped (Aspirin) and 1 imported (New Test Item)
      await expect(page.getByText(/1 items? skipped/i)).toBeVisible();
      await expect(page.getByText(/1 items? imported/i)).toBeVisible();

      // Verify Aspirin quantity didn't change (still 50, not 75)
      await page.getByRole('button', { name: /close/i }).click();
      await page.goto('http://localhost:5173');
      await page.getByText('Aspirin').click();
      await expect(page.getByText(/quantity.*50/i)).toBeVisible();
    });
  });

  test.describe('Duplicate Handling - Overwrite', () => {
    test('should overwrite duplicate items', async ({ page }) => {
      // Add an item that will be overwritten
      await addTestItem(page, 'Aspirin', '111111111111');

      await openImportModal(page);

      const filePath = path.join(__dirname, 'fixtures', 'with-duplicates.csv');
      await page.setInputFiles('input[type="file"]', filePath);
      await page.getByRole('button', { name: /next/i }).click();

      // Select "Overwrite" strategy
      await page.getByLabel(/overwrite/i).check();
      await page.getByRole('button', { name: 'Import', exact: true }).click({ force: true });

      await expect(page.getByText(/import complete/i)).toBeVisible({ timeout: 10000 });

      // Should show 1 overwritten
      await expect(page.getByText(/1 items? overwritten/i)).toBeVisible();

      // Verify Aspirin quantity changed to 75
      await page.getByRole('button', { name: /close/i }).click();
      await page.goto('http://localhost:5173');
      await page.getByText('Aspirin').click();
      await expect(page.getByText(/quantity.*75/i)).toBeVisible();
    });
  });

  test.describe('Duplicate Handling - Rename', () => {
    test('should rename duplicate items', async ({ page }) => {
      // Add an item that will cause rename
      await addTestItem(page, 'Aspirin', '111111111111');

      await openImportModal(page);

      const filePath = path.join(__dirname, 'fixtures', 'with-duplicates.csv');
      await page.setInputFiles('input[type="file"]', filePath);
      await page.getByRole('button', { name: /next/i }).click();

      // Select "Rename" strategy
      await page.getByLabel(/rename/i).check();
      await page.getByRole('button', { name: 'Import', exact: true }).click({ force: true });

      await expect(page.getByText(/import complete/i)).toBeVisible({ timeout: 10000 });

      // Should show 1 renamed
      await expect(page.getByText(/1 items? renamed/i)).toBeVisible();

      // Verify renamed item exists
      await page.getByRole('button', { name: /close/i }).click();
      await page.goto('http://localhost:5173');
      await expect(page.getByText(/Aspirin \(2\)/i)).toBeVisible();
    });
  });

  test.describe('Categories and Locations', () => {
    test('should create missing categories and locations', async ({ page }) => {
      await openImportModal(page);

      const filePath = path.join(__dirname, 'fixtures', 'new-categories-locations.csv');
      await page.setInputFiles('input[type="file"]', filePath);
      await page.getByRole('button', { name: /next/i }).click();

      // Enable auto-creation
      await page.getByLabel(/create missing categories/i).check();
      await page.getByLabel(/create missing locations/i).check();

      await page.getByRole('button', { name: 'Import', exact: true }).click({ force: true });

      await expect(page.getByText(/import complete/i)).toBeVisible({ timeout: 10000 });

      // Should show created categories and locations
      await expect(page.getByText(/2 categor(?:y|ies) created/i)).toBeVisible();
      await expect(page.getByText(/2 locations? created/i)).toBeVisible();

      await page.getByRole('button', { name: /close/i }).click();

      // Verify items were imported
      await page.goto('http://localhost:5173');
      await expect(page.getByText('Test Surgical Tools')).toBeVisible();
      await expect(page.getByText('Test Lab Equipment')).toBeVisible();
    });

    test('should reject import when categories/locations missing and auto-create disabled', async ({ page }) => {
      await openImportModal(page);

      const filePath = path.join(__dirname, 'fixtures', 'new-categories-locations.csv');
      await page.setInputFiles('input[type="file"]', filePath);
      await page.getByRole('button', { name: /next/i }).click();

      // Make sure auto-create is disabled
      await page.getByLabel(/create missing categories/i).uncheck();
      await page.getByLabel(/create missing locations/i).uncheck();

      await page.getByRole('button', { name: 'Import', exact: true }).click({ force: true });

      // Should show error about missing categories/locations
      await expect(page.getByText(/missing categor(?:y|ies)/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('UI Elements', () => {
    test('should show file details after selection', async ({ page }) => {
      await openImportModal(page);

      const filePath = path.join(__dirname, 'fixtures', 'valid-import.csv');
      await page.setInputFiles('input[type="file"]', filePath);

      // File name should be visible
      await expect(page.getByText(/valid-import.csv/i)).toBeVisible();

      // File type indicator
      await expect(page.getByText(/csv/i)).toBeVisible();
    });

    test('should allow canceling import', async ({ page }) => {
      await openImportModal(page);

      const filePath = path.join(__dirname, 'fixtures', 'valid-import.csv');
      await page.setInputFiles('input[type="file"]', filePath);

      // Cancel before options
      await page.getByRole('button', { name: /cancel/i }).click();

      // Modal should close
      await expect(page.getByText(/import inventory data/i)).not.toBeVisible();
    });

    test('should support keyboard navigation', async ({ page }) => {
      await openImportModal(page);

      // Escape should close modal
      await page.keyboard.press('Escape');
      await expect(page.getByText(/import inventory data/i)).not.toBeVisible();
    });
  });

  test.describe('Results Display', () => {
    test('should display detailed import results', async ({ page }) => {
      await openImportModal(page);

      const filePath = path.join(__dirname, 'fixtures', 'valid-import.csv');
      await page.setInputFiles('input[type="file"]', filePath);
      await page.getByRole('button', { name: /next/i }).click();
      await page.getByRole('button', { name: 'Import', exact: true }).click({ force: true });

      await expect(page.getByText(/import complete/i)).toBeVisible({ timeout: 10000 });

      // Check all result statistics are present
      await expect(page.getByText(/items imported/i)).toBeVisible();
      await expect(page.getByText(/items skipped/i)).toBeVisible();
      await expect(page.getByText(/items overwritten/i)).toBeVisible();
      await expect(page.getByText(/categor(?:y|ies) created/i)).toBeVisible();
      await expect(page.getByText(/locations created/i)).toBeVisible();
    });
  });
});
