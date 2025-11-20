# Barcode Testing Guide

This guide explains how to test the barcode scanner functionality with the provided test data.

## Test Data Overview

The file `barcode-test-data.ts` contains:

- **10 test items** with valid barcodes in different formats
- **4 unknown barcodes** for testing "Item Not Found" flow
- Helper functions for seeding test data and generating barcode images

## Barcode Formats Supported

The scanner supports the following barcode formats:

- **EAN-13** (13 digits) - Most common for retail products
- **EAN-8** (8 digits) - For small products
- **UPC-A** (12 digits) - North American standard
- **Code 128** (alphanumeric) - Common in healthcare
- **Code 39** (alphanumeric) - Common in logistics

## Quick Start: Manual Testing with Real Camera

### Method 1: Generate Printable Barcodes Online

1. Visit <https://barcode.tec-it.com/en>
2. Use the test barcodes from `barcode-test-data.ts`:
   - `5901234123457` (Aspirin 500mg - EAN-13)
   - `5901234567890` (Bandages Box - EAN-13)
   - `MED-001-2024` (Antibiotic Cream - Code 128)
   - `EQP-THERM-100` (Digital Thermometer - Code 128)
   - `012345678905` (Hand Sanitizer - UPC-A)

3. Select the appropriate barcode type for each
4. Generate and print the barcodes
5. Scan them with the app camera

### Method 2: Use Pre-Generated Image URLs

The `getBarcodeImageUrl()` function in `barcode-test-data.ts` generates direct image URLs:

```typescript
import { barcodeTestData, getBarcodeImageUrl } from './fixtures/barcode-test-data';

// Get barcode image URL
const imageUrl = getBarcodeImageUrl('5901234123457', 'EAN-13');
// https://barcode.tec-it.com/barcode.ashx?data=5901234123457&code=EAN13&translate-esc=on
```

Open these URLs in a browser, display on a screen, and scan with the app.

## Test Scenarios

### Scenario 1: Item Found

**Steps:**

1. Seed the database with test items
2. Navigate to Scanner page
3. Click "Start Scanning"
4. Scan barcode `5901234123457`
5. Expect: "Item Found!" message with "Aspirin 500mg" details

### Scenario 2: Item Not Found

**Steps:**

1. Navigate to Scanner page
2. Click "Start Scanning"
3. Scan barcode `9999999999999` (unknown)
4. Expect: "Item Not Found" message with "Add New Item" button

### Scenario 3: Low Stock Item

**Steps:**

1. Seed the database with test items
2. Navigate to Scanner page
3. Scan barcode `5901234111111` (Surgical Gloves)
4. Expect: Item found with low stock indicator (quantity 15 <= minQuantity 25)

### Scenario 4: Add Item with Pre-filled Barcode

**Steps:**

1. Navigate to Scanner page
2. Scan unknown barcode `9999999999999`
3. Click "Add New Item"
4. Expect: Add Item page with barcode field pre-filled with `9999999999999`

## Seeding Test Data

### For Playwright Tests

```typescript
import { test, expect } from '@playwright/test';
import { barcodeTestData, seedBarcodeTestItems } from './fixtures/barcode-test-data';

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Seed test data
  await page.evaluate(async () => {
    const { createItem } = await import('../src/lib/db/operations');
    const { barcodeTestData } = await import('./fixtures/barcode-test-data');

    for (const item of barcodeTestData) {
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
  });
});
```

### For Manual Testing

1. Start the dev server: `npm run dev`
2. Open browser console
3. Run the following script:

```javascript
// Import and seed test data
import('./src/lib/db/operations.js').then(async ({ createItem }) => {
  const testData = [
    {
      name: 'Aspirin 500mg',
      barcode: '5901234123457',
      quantity: 100,
      minQuantity: 20,
      category: 'Medications',
      location: 'Shelf A',
      notes: 'Pain reliever and fever reducer',
      photos: []
    },
    {
      name: 'Bandages Box',
      barcode: '5901234567890',
      quantity: 50,
      minQuantity: 10,
      category: 'First Aid',
      location: 'Shelf B',
      notes: 'Assorted adhesive bandages',
      photos: []
    }
    // Add more items as needed
  ];

  for (const item of testData) {
    await createItem(item);
  }

  console.log('Test data seeded successfully!');
});
```

## Test Barcode Reference

### Items in Inventory (Should Find)

| Barcode | Format | Item Name | Stock Status |
|---------|--------|-----------|--------------|
| `5901234123457` | EAN-13 | Aspirin 500mg | Normal |
| `5901234567890` | EAN-13 | Bandages Box | Normal |
| `5901234111111` | EAN-13 | Surgical Gloves | LOW STOCK |
| `MED-001-2024` | Code128 | Antibiotic Cream | Normal |
| `EQP-THERM-100` | Code128 | Digital Thermometer | Normal |
| `012345678905` | UPC-A | Hand Sanitizer 500ml | Normal |
| `036000291452` | UPC-A | Ibuprofen 200mg | LOW STOCK |
| `96385074` | EAN-8 | Alcohol Swabs | Normal |
| `GAUZE-2024` | Code39 | Sterile Gauze Pads | Normal |
| `MASK-N95-500` | Code39 | N95 Respirator Masks | CRITICAL LOW |

### Items NOT in Inventory (Should NOT Find)

| Barcode | Format | Description |
|---------|--------|-------------|
| `9999999999999` | EAN-13 | Unknown item |
| `UNKNOWN-123` | Code128 | Unknown item |
| `999999999999` | UPC-A | Unknown item |
| `NOT-FOUND` | Code39 | Unknown item |

## Troubleshooting

### Camera Not Initializing

- Ensure HTTPS is used (required for camera access in browsers)
- Check camera permissions in browser settings
- Try in good lighting conditions
- Clear browser cache and reload

### Barcode Not Detected

- Ensure barcode is in focus and well-lit
- Hold camera steady for 1-2 seconds
- Try adjusting distance (6-12 inches from barcode)
- Verify barcode format is supported
- Check console for Quagga errors

### Console Errors

If you see "Cannot read properties of null (reading 'x')" errors:

- This may indicate React StrictMode double-initialization
- The latest fix should prevent this (commit pending)
- Check that `quaggaStarted.current` guard is working

## Generating Custom Test Barcodes

### Using Online Tools

1. **barcode.tec-it.com** (free, no registration)
   - Supports all formats we use
   - High-quality output
   - Direct image URLs

2. **barcodesinc.com/generator** (free)
   - Simple interface
   - Downloadable images
   - Multiple formats

3. **barcode-generator.org** (free)
   - Open source
   - Quick generation
   - SVG and PNG output

### Using Code Libraries (Future Enhancement)

For automated barcode generation in tests, consider:

- `bwip-js` - Barcode writer in pure JavaScript
- `jsbarcode` - Barcode generation library
- `node-bwipjs` - Node.js barcode generator

## Next Steps

After verifying manual camera scanning works:

1. Create automated E2E tests that mock camera input
2. Add visual regression tests for scanner UI states
3. Test scanner behavior with rapid consecutive scans
4. Test error handling (camera denied, no camera available)
5. Performance testing (time to detect, memory usage)

## Resources

- [Quagga2 Documentation](https://github.com/ericblade/quagga2)
- [Barcode Formats Reference](https://en.wikipedia.org/wiki/Barcode)
- [MediaStream API](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_API)
- [Camera Permissions](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
