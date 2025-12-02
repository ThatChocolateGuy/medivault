import { test, expect, type Page } from '@playwright/test';

// Helper function to navigate to Settings and open Location Manager
async function openLocationManager(page: Page) {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(300);
  await page.getByText('Manage Locations').click();
  await page.waitForTimeout(300);
}

// Helper function to submit the add/edit location form
async function submitLocationForm(page: Page) {
  // The submit button is inside the form, we target it specifically
  await page.locator('form button[type="submit"]').click();
}

// Helper function to click edit button for a location by name
async function clickEditLocation(page: Page, locationName: string) {
  // Find the row that contains the location name in a p.font-medium element
  // and click the edit button within that row
  const locationRow = page.locator('.border.border-gray-200.rounded-lg', {
    has: page.locator('p.font-medium', { hasText: locationName }),
  });
  await locationRow.getByRole('button', { name: 'Edit location' }).click();
}

// Helper function to click delete button for a location by name
async function clickDeleteLocation(page: Page, locationName: string) {
  const locationRow = page.locator('.border.border-gray-200.rounded-lg', {
    has: page.locator('p.font-medium', { hasText: locationName }),
  });
  await locationRow.getByRole('button', { name: 'Delete location' }).click();
}

// Helper function to add an item with a specific location
async function addItem(
  page: Page,
  itemData: {
    name: string;
    quantity: number;
    location?: string;
  }
) {
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByPlaceholder('e.g., Bandages').fill(itemData.name);
  await page.locator('input[type="number"]').first().fill(String(itemData.quantity));

  if (itemData.location) {
    await page.locator('select').nth(1).selectOption(itemData.location);
  }

  await page.getByRole('button', { name: 'Add Item' }).click();
  await page.waitForTimeout(500);
}

test.describe('Location Manager', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should open location manager from Settings', async ({ page }) => {
    await openLocationManager(page);

    // Should show the location manager modal
    await expect(page.getByRole('heading', { name: 'Manage Locations' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Location' })).toBeVisible();

    // Should show default locations count
    await expect(page.getByText(/\d+ locations?/)).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/11-location-manager-open.png',
      fullPage: true,
    });
  });

  test('should display default locations', async ({ page }) => {
    await openLocationManager(page);

    // Default locations from the database
    await expect(page.getByText('Shelf A')).toBeVisible();
    await expect(page.getByText('Shelf B')).toBeVisible();
    await expect(page.getByText('Refrigerator')).toBeVisible();
    await expect(page.getByText('Storage Room')).toBeVisible();

    // Should show descriptions
    await expect(page.getByText('Top shelf')).toBeVisible();
    await expect(page.getByText('Middle shelf')).toBeVisible();
    await expect(page.getByText('Temperature controlled')).toBeVisible();
    await expect(page.getByText('Back storage')).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/11-location-manager-default-locations.png',
      fullPage: true,
    });
  });

  test('should add a new location with name and description', async ({ page }) => {
    await openLocationManager(page);

    // Click Add Location
    await page.getByRole('button', { name: 'Add Location' }).click();
    await page.waitForTimeout(300);

    // Should show add form modal
    await expect(page.getByRole('heading', { name: 'Add Location' })).toBeVisible();

    // Fill in location details
    await page.getByPlaceholder('e.g., Shelf A').fill('New Test Location');
    await page
      .getByPlaceholder('e.g., Top shelf in storage room')
      .fill('This is a test description');

    // Take screenshot of filled form
    await page.screenshot({
      path: 'tests/screenshots/11-location-add-form.png',
      fullPage: true,
    });

    // Submit the form
    await submitLocationForm(page);
    await page.waitForTimeout(500);

    // Should show success message
    await expect(page.getByText('Location added successfully')).toBeVisible();

    // New location should appear in the list
    await expect(page.getByText('New Test Location')).toBeVisible();
    await expect(page.getByText('This is a test description')).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/11-location-added.png',
      fullPage: true,
    });
  });

  test('should edit an existing location', async ({ page }) => {
    await openLocationManager(page);

    // First add a test location
    await page.getByRole('button', { name: 'Add Location' }).click();
    await page.waitForTimeout(300);
    await page.getByPlaceholder('e.g., Shelf A').fill('Location To Edit');
    await page
      .getByPlaceholder('e.g., Top shelf in storage room')
      .fill('Original description');
    await submitLocationForm(page);
    await page.waitForTimeout(500);

    // Click edit button for the new location
    await clickEditLocation(page, 'Location To Edit');
    await page.waitForTimeout(300);

    // Should show edit form modal
    await expect(page.getByRole('heading', { name: 'Edit Location' })).toBeVisible();

    // Verify current values are pre-filled
    await expect(page.getByPlaceholder('e.g., Shelf A')).toHaveValue('Location To Edit');
    await expect(page.getByPlaceholder('e.g., Top shelf in storage room')).toHaveValue(
      'Original description'
    );

    // Update the values
    await page.getByPlaceholder('e.g., Shelf A').clear();
    await page.getByPlaceholder('e.g., Shelf A').fill('Edited Location Name');
    await page.getByPlaceholder('e.g., Top shelf in storage room').clear();
    await page
      .getByPlaceholder('e.g., Top shelf in storage room')
      .fill('Updated description');

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/11-location-edit-form.png',
      fullPage: true,
    });

    // Save changes
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(500);

    // Should show success message
    await expect(page.getByText(/Location.*updated|renamed/)).toBeVisible();

    // Updated location should appear in the list
    await expect(page.getByText('Edited Location Name')).toBeVisible();
    await expect(page.getByText('Updated description')).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/11-location-edited.png',
      fullPage: true,
    });
  });

  test('should show error when trying to delete a location that is in use', async ({
    page,
  }) => {
    // First add an item with a specific location
    await addItem(page, {
      name: 'Item Using Location',
      quantity: 5,
      location: 'Shelf A',
    });

    // Navigate to home first
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(300);

    // Open location manager
    await openLocationManager(page);

    // Try to delete "Shelf A" which has an item
    await clickDeleteLocation(page, 'Shelf A');
    await page.waitForTimeout(300);

    // Should show delete modal with error
    await expect(page.getByRole('heading', { name: 'Delete Location' })).toBeVisible();
    await expect(page.getByText('Cannot delete location')).toBeVisible();
    await expect(page.getByText(/\d+ item(s)? (is|are) using this location/)).toBeVisible();

    // Delete button should not be visible
    const deleteButton = page.getByRole('button', { name: 'Delete', exact: true });
    await expect(deleteButton).not.toBeVisible();

    // Should only have Cancel button
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/11-location-delete-in-use.png',
      fullPage: true,
    });

    // Cancel the dialog
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(300);

    // Location should still exist
    await expect(page.getByText('Shelf A')).toBeVisible();
  });

  test('should delete an unused location', async ({ page }) => {
    await openLocationManager(page);

    // First add a test location
    await page.getByRole('button', { name: 'Add Location' }).click();
    await page.waitForTimeout(300);
    await page.getByPlaceholder('e.g., Shelf A').fill('Location To Delete');
    await submitLocationForm(page);
    await page.waitForTimeout(500);

    // Verify location was added
    await expect(page.getByText('Location To Delete')).toBeVisible();

    // Click delete button for the new location
    await clickDeleteLocation(page, 'Location To Delete');
    await page.waitForTimeout(300);

    // Should show delete confirmation modal
    await expect(page.getByRole('heading', { name: 'Delete Location' })).toBeVisible();
    await expect(page.getByText('Are you sure you want to delete')).toBeVisible();
    // The location name appears in bold within the modal
    await expect(
      page.getByLabel('Delete Location', { exact: true }).locator('strong')
    ).toContainText('Location To Delete');
    await expect(page.getByText('This action cannot be undone')).toBeVisible();

    // Delete button should be visible
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/11-location-delete-confirmation.png',
      fullPage: true,
    });

    // Confirm deletion
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.waitForTimeout(500);

    // Should show success message
    await expect(page.getByText('Location deleted successfully')).toBeVisible();

    // Location should no longer exist in the list
    await expect(
      page.locator('.border.border-gray-200.rounded-lg', {
        has: page.locator('p.font-medium', { hasText: 'Location To Delete' }),
      })
    ).not.toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/11-location-deleted.png',
      fullPage: true,
    });
  });

  test('should validate 50-character name limit', async ({ page }) => {
    await openLocationManager(page);

    // Click Add Location
    await page.getByRole('button', { name: 'Add Location' }).click();
    await page.waitForTimeout(300);

    // Try to enter more than 50 characters
    const longName = 'A'.repeat(60);
    const nameInput = page.getByPlaceholder('e.g., Shelf A');
    await nameInput.fill(longName);

    // The input should have maxLength attribute
    await expect(nameInput).toHaveAttribute('maxLength', '50');

    // Value should be truncated to 50 characters
    const value = await nameInput.inputValue();
    expect(value.length).toBeLessThanOrEqual(50);

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/11-location-name-limit.png',
      fullPage: true,
    });
  });

  test('should validate 200-character description limit', async ({ page }) => {
    await openLocationManager(page);

    // Click Add Location
    await page.getByRole('button', { name: 'Add Location' }).click();
    await page.waitForTimeout(300);

    // Try to enter more than 200 characters
    const longDescription = 'B'.repeat(250);
    const descriptionInput = page.getByPlaceholder('e.g., Top shelf in storage room');
    await descriptionInput.fill(longDescription);

    // The textarea should have maxLength attribute
    await expect(descriptionInput).toHaveAttribute('maxLength', '200');

    // Value should be truncated to 200 characters
    const value = await descriptionInput.inputValue();
    expect(value.length).toBeLessThanOrEqual(200);

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/11-location-description-limit.png',
      fullPage: true,
    });
  });

  test('should close location manager modal', async ({ page }) => {
    await openLocationManager(page);

    // Verify modal is open
    await expect(page.getByRole('heading', { name: 'Manage Locations' })).toBeVisible();

    // Close the modal by clicking the close button
    await page.getByRole('button', { name: 'Close' }).click();
    await page.waitForTimeout(300);

    // Modal should be closed
    await expect(page.getByRole('heading', { name: 'Manage Locations' })).not.toBeVisible();

    // Should still be on Settings page
    await expect(page.locator('h1')).toContainText('Settings');
  });

  test('should cancel add location form', async ({ page }) => {
    await openLocationManager(page);

    // Open add form
    await page.getByRole('button', { name: 'Add Location' }).click();
    await page.waitForTimeout(300);

    // Fill in some data
    await page.getByPlaceholder('e.g., Shelf A').fill('Cancelled Location');

    // Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(300);

    // Should be back to location list
    await expect(page.getByRole('heading', { name: 'Manage Locations' })).toBeVisible();

    // Cancelled location should not appear
    await expect(page.getByText('Cancelled Location')).not.toBeVisible();
  });

  test('should cancel edit location form', async ({ page }) => {
    await openLocationManager(page);

    // First add a test location
    await page.getByRole('button', { name: 'Add Location' }).click();
    await page.waitForTimeout(300);
    await page.getByPlaceholder('e.g., Shelf A').fill('Edit Cancel Test');
    await submitLocationForm(page);
    await page.waitForTimeout(500);

    // Click edit
    await clickEditLocation(page, 'Edit Cancel Test');
    await page.waitForTimeout(300);

    // Change the name
    await page.getByPlaceholder('e.g., Shelf A').clear();
    await page.getByPlaceholder('e.g., Shelf A').fill('Changed Name');

    // Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(300);

    // Original name should still be there
    await expect(page.getByText('Edit Cancel Test')).toBeVisible();
    await expect(page.getByText('Changed Name')).not.toBeVisible();
  });
});

test.describe('Location Manager - Mobile', () => {
  test('should work properly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await openLocationManager(page);

    // Should show the location manager modal
    await expect(page.getByRole('heading', { name: 'Manage Locations' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Location' })).toBeVisible();

    // Take mobile screenshot
    await page.screenshot({
      path: 'tests/screenshots/11-location-manager-mobile.png',
      fullPage: true,
    });

    // Add a location
    await page.getByRole('button', { name: 'Add Location' }).click();
    await page.waitForTimeout(300);
    await page.getByPlaceholder('e.g., Shelf A').fill('Mobile Test Location');
    await submitLocationForm(page);
    await page.waitForTimeout(500);

    // Verify it was added
    await expect(page.getByText('Mobile Test Location')).toBeVisible();

    // Take mobile screenshot
    await page.screenshot({
      path: 'tests/screenshots/11-location-manager-mobile-added.png',
      fullPage: true,
    });
  });
});
