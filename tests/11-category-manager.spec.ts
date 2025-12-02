import { test, expect, type Page } from '@playwright/test';

// Helper function to navigate to Settings and open Category Manager
async function openCategoryManager(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByText('Manage Categories').click();
  await page.waitForTimeout(300);
}

// Helper function to add an item with a specific category
async function addItem(
  page: Page,
  itemData: {
    name: string;
    quantity: number;
    category?: string;
  }
) {
  await page.getByLabel('Add', { exact: true }).click();
  await page.getByPlaceholder('e.g., Bandages').fill(itemData.name);
  await page.locator('input[type="number"]').first().fill(String(itemData.quantity));

  if (itemData.category) {
    await page.locator('select').first().selectOption(itemData.category);
  }

  await page.getByRole('button', { name: 'Add Item' }).click();
  await page.waitForTimeout(500);
}

// Helper function to click the submit button in a modal
async function clickSubmitButton(page: Page, buttonName: string) {
  // Get the modal's submit button by finding the form container
  const submitButton = page.locator('form button[type="submit"]').filter({ hasText: buttonName });
  await submitButton.click();
}

test.describe('Category Manager', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should open category manager from Settings', async ({ page }) => {
    await openCategoryManager(page);

    // Should show the category manager modal
    await expect(page.getByRole('heading', { name: 'Manage Categories' })).toBeVisible();

    // Should show the default categories
    await expect(page.getByText('Medications')).toBeVisible();
    await expect(page.getByText('Supplies')).toBeVisible();
    await expect(page.getByText('Equipment')).toBeVisible();
    await expect(page.getByText('First Aid')).toBeVisible();

    // Should show the Add Category button
    await expect(page.getByRole('button', { name: 'Add Category' })).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/11-category-manager-open.png',
      fullPage: true,
    });
  });

  test('should add a new category with name and color', async ({ page }) => {
    await openCategoryManager(page);

    // Click Add Category button
    await page.getByRole('button', { name: 'Add Category' }).click();
    await page.waitForTimeout(300);

    // Should show the add category modal
    await expect(page.getByRole('heading', { name: 'Add Category' })).toBeVisible();

    // Fill in the category name
    await page.getByPlaceholder('e.g., Medications').fill('Vitamins');

    // Select a color (Purple)
    await page.getByRole('button', { name: 'Select Purple' }).click();

    // Take screenshot before submit
    await page.screenshot({
      path: 'tests/screenshots/11-add-category-form.png',
      fullPage: true,
    });

    // Submit the form
    await clickSubmitButton(page, 'Add');
    await page.waitForTimeout(500);

    // Should show success message
    await expect(page.getByText('Category added successfully')).toBeVisible();

    // New category should appear in the list
    await expect(page.getByText('Vitamins')).toBeVisible();

    // Take screenshot after adding
    await page.screenshot({
      path: 'tests/screenshots/11-category-added.png',
      fullPage: true,
    });
  });

  test('should edit an existing category', async ({ page }) => {
    // First add a category to edit
    await openCategoryManager(page);
    await page.getByRole('button', { name: 'Add Category' }).click();
    await page.waitForTimeout(300);
    await page.getByPlaceholder('e.g., Medications').fill('Test Category');
    await clickSubmitButton(page, 'Add');
    await page.waitForTimeout(500);

    // Now edit the category - find the row containing the category name
    const categoryRow = page.locator('div.border.border-gray-200').filter({ hasText: 'Test Category' });
    await categoryRow.getByRole('button', { name: 'Edit category' }).click();
    await page.waitForTimeout(300);

    // Should show the edit category modal
    await expect(page.getByRole('heading', { name: 'Edit Category' })).toBeVisible();

    // Change the name
    await page.getByPlaceholder('e.g., Medications').clear();
    await page.getByPlaceholder('e.g., Medications').fill('Edited Category');

    // Select a different color (Orange)
    await page.getByRole('button', { name: 'Select Orange' }).click();

    // Take screenshot before saving
    await page.screenshot({
      path: 'tests/screenshots/11-edit-category-form.png',
      fullPage: true,
    });

    // Save the changes
    await clickSubmitButton(page, 'Save');
    await page.waitForTimeout(500);

    // Should show success message
    await expect(page.getByText('Category renamed. Items updated automatically.')).toBeVisible();

    // Updated category should appear in the list
    await expect(page.getByText('Edited Category')).toBeVisible();
    await expect(page.getByText('Test Category')).not.toBeVisible();

    // Take screenshot after editing
    await page.screenshot({
      path: 'tests/screenshots/11-category-edited.png',
      fullPage: true,
    });
  });

  test('should show error when deleting a category that is in use', async ({ page }) => {
    // First add an item using the Medications category
    await addItem(page, {
      name: 'Test Item for Category',
      quantity: 5,
      category: 'Medications',
    });

    // Navigate back to home and then to settings
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(300);

    await openCategoryManager(page);

    // Try to delete the Medications category - find the row containing the category name
    const categoryRow = page.locator('div.border.border-gray-200').filter({ hasText: 'Medications' });
    await categoryRow.getByRole('button', { name: 'Delete category' }).click();
    await page.waitForTimeout(300);

    // Should show the delete confirmation dialog with error
    await expect(page.getByRole('heading', { name: 'Delete Category' })).toBeVisible();
    await expect(page.getByText('Cannot delete category')).toBeVisible();
    await expect(page.getByText(/item(s)? (is|are) using this category/)).toBeVisible();

    // Take screenshot of the error
    await page.screenshot({
      path: 'tests/screenshots/11-category-in-use-error.png',
      fullPage: true,
    });

    // There should be no Delete button, only Cancel
    const deleteButton = page.getByRole('button', { name: 'Delete', exact: true }).last();
    await expect(deleteButton).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('should delete an unused category', async ({ page }) => {
    // First add a new category
    await openCategoryManager(page);
    await page.getByRole('button', { name: 'Add Category' }).click();
    await page.waitForTimeout(300);
    await page.getByPlaceholder('e.g., Medications').fill('Category To Delete');
    await clickSubmitButton(page, 'Add');
    await page.waitForTimeout(500);

    // Now delete the category - find the row containing the category name
    const categoryRow = page.locator('div.border.border-gray-200').filter({ hasText: 'Category To Delete' });
    await categoryRow.getByRole('button', { name: 'Delete category' }).click();
    await page.waitForTimeout(300);

    // Should show the delete confirmation dialog
    await expect(page.getByRole('heading', { name: 'Delete Category' })).toBeVisible();
    await expect(page.getByText(/Are you sure you want to delete/)).toBeVisible();
    // The category name appears in the confirmation dialog (in a <strong> tag)
    await expect(page.getByLabel('Delete Category', { exact: true }).getByText('Category To Delete')).toBeVisible();

    // Take screenshot of delete confirmation
    await page.screenshot({
      path: 'tests/screenshots/11-delete-category-confirmation.png',
      fullPage: true,
    });

    // Click Delete button
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await page.waitForTimeout(500);

    // Should show success message
    await expect(page.getByText('Category deleted successfully')).toBeVisible();

    // Category should no longer appear in the list
    await expect(page.getByText('Category To Delete')).not.toBeVisible();

    // Take screenshot after deletion
    await page.screenshot({
      path: 'tests/screenshots/11-category-deleted.png',
      fullPage: true,
    });
  });

  test('should validate the 50-character name limit', async ({ page }) => {
    await openCategoryManager(page);
    await page.getByRole('button', { name: 'Add Category' }).click();
    await page.waitForTimeout(300);

    // Get the input element
    const nameInput = page.getByPlaceholder('e.g., Medications');

    // Type a very long name (more than 50 characters)
    const longName = 'This is a very long category name that exceeds fifty characters limit';
    await nameInput.fill(longName);

    // Check that the input is limited to 50 characters
    const inputValue = await nameInput.inputValue();
    expect(inputValue.length).toBeLessThanOrEqual(50);

    // Take screenshot showing the character limit
    await page.screenshot({
      path: 'tests/screenshots/11-category-name-limit.png',
      fullPage: true,
    });
  });

  test('should prevent duplicate category names when editing', async ({ page }) => {
    await openCategoryManager(page);

    // First, add a new category
    await page.getByRole('button', { name: 'Add Category' }).click();
    await page.waitForTimeout(300);
    await page.getByPlaceholder('e.g., Medications').fill('Unique Category');
    await clickSubmitButton(page, 'Add');
    await page.waitForTimeout(500);

    // Now try to edit it to have the same name as an existing default category
    const categoryRow = page.locator('div.border.border-gray-200').filter({ hasText: 'Unique Category' });
    await categoryRow.getByRole('button', { name: 'Edit category' }).click();
    await page.waitForTimeout(300);

    // Try to change the name to "Medications" which already exists
    await page.getByPlaceholder('e.g., Medications').clear();
    await page.getByPlaceholder('e.g., Medications').fill('Medications');
    await clickSubmitButton(page, 'Save');
    await page.waitForTimeout(500);

    // Should show an error about duplicate name
    await expect(page.getByText(/already exists/i)).toBeVisible();

    // Take screenshot of the duplicate error
    await page.screenshot({
      path: 'tests/screenshots/11-duplicate-category-error.png',
      fullPage: true,
    });
  });

  test('should cancel adding a new category', async ({ page }) => {
    await openCategoryManager(page);

    // Get the initial count of categories (only category rows with border class)
    const initialCount = await page.locator('div.border.border-gray-200').count();

    // Click Add Category button
    await page.getByRole('button', { name: 'Add Category' }).click();
    await page.waitForTimeout(300);

    // Fill in the form
    await page.getByPlaceholder('e.g., Medications').fill('Cancelled Category');

    // Click Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(300);

    // Should still be on the category manager modal
    await expect(page.getByRole('heading', { name: 'Manage Categories' })).toBeVisible();

    // Category should not have been added
    await expect(page.getByText('Cancelled Category')).not.toBeVisible();

    // Count should be the same
    const finalCount = await page.locator('div.border.border-gray-200').count();
    expect(finalCount).toBe(initialCount);
  });

  test('should cancel deleting a category', async ({ page }) => {
    // First add a new category
    await openCategoryManager(page);
    await page.getByRole('button', { name: 'Add Category' }).click();
    await page.waitForTimeout(300);
    await page.getByPlaceholder('e.g., Medications').fill('Keep This Category');
    await clickSubmitButton(page, 'Add');
    await page.waitForTimeout(500);

    // Click delete on the category - find the row containing the category name
    const categoryRow = page.locator('div.border.border-gray-200').filter({ hasText: 'Keep This Category' });
    await categoryRow.getByRole('button', { name: 'Delete category' }).click();
    await page.waitForTimeout(300);

    // Click Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(300);

    // Should still be on the category manager modal
    await expect(page.getByRole('heading', { name: 'Manage Categories' })).toBeVisible();

    // Category should still exist
    await expect(page.getByText('Keep This Category')).toBeVisible();
  });

  test('should close the category manager modal', async ({ page }) => {
    await openCategoryManager(page);

    // Verify the modal is open
    await expect(page.getByRole('heading', { name: 'Manage Categories' })).toBeVisible();

    // Close the modal by clicking the X button
    await page.getByRole('button', { name: 'Close' }).click();
    await page.waitForTimeout(300);

    // Modal should be closed, should be back on Settings page
    await expect(page.getByRole('heading', { name: 'Manage Categories' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/11-category-manager-closed.png',
      fullPage: true,
    });
  });

  test('should show color swatches with correct colors', async ({ page }) => {
    await openCategoryManager(page);
    await page.getByRole('button', { name: 'Add Category' }).click();
    await page.waitForTimeout(300);

    // Verify all color options are visible
    await expect(page.getByRole('button', { name: 'Select Blue' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Select Green' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Select Orange' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Select Red' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Select Purple' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Select Pink' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Select Yellow' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Select Gray' })).toBeVisible();

    // Take screenshot of color palette
    await page.screenshot({
      path: 'tests/screenshots/11-category-color-palette.png',
      fullPage: true,
    });
  });
});

test.describe('Category Manager - Mobile', () => {
  test('should display properly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await openCategoryManager(page);

    // Should show the category manager modal
    await expect(page.getByRole('heading', { name: 'Manage Categories' })).toBeVisible();

    // Take mobile screenshot
    await page.screenshot({
      path: 'tests/screenshots/11-category-manager-mobile.png',
      fullPage: true,
    });
  });

  test('should add category on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await openCategoryManager(page);
    await page.getByRole('button', { name: 'Add Category' }).click();
    await page.waitForTimeout(300);

    await page.getByPlaceholder('e.g., Medications').fill('Mobile Category');
    await clickSubmitButton(page, 'Add');
    await page.waitForTimeout(500);

    // Should show success message
    await expect(page.getByText('Category added successfully')).toBeVisible();
    await expect(page.getByText('Mobile Category')).toBeVisible();

    // Take mobile screenshot
    await page.screenshot({
      path: 'tests/screenshots/11-category-added-mobile.png',
      fullPage: true,
    });
  });
});
