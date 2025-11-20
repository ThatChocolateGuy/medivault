/**
 * Barcode Test Data for Scanner Testing
 *
 * This file contains valid barcode values for testing the scanner functionality.
 * These barcodes can be generated as images using online tools for manual testing.
 */

export interface BarcodeTestItem {
  barcode: string;
  name: string;
  quantity: number;
  minQuantity: number;
  category: string;
  location: string;
  notes: string;
  format: string; // Barcode format (EAN-13, Code128, etc.)
}

/**
 * Test barcodes with their expected item data
 * These use valid barcode formats that Quagga2 can recognize
 */
export const barcodeTestData: BarcodeTestItem[] = [
  // EAN-13 barcodes (13 digits, most common for retail products)
  {
    barcode: '5901234123457',
    name: 'Aspirin 500mg',
    quantity: 100,
    minQuantity: 20,
    category: 'Medications',
    location: 'Shelf A',
    notes: 'Pain reliever and fever reducer',
    format: 'EAN-13'
  },
  {
    barcode: '5901234567890',
    name: 'Bandages Box',
    quantity: 50,
    minQuantity: 10,
    category: 'First Aid',
    location: 'Shelf B',
    notes: 'Assorted adhesive bandages',
    format: 'EAN-13'
  },
  {
    barcode: '5901234111111',
    name: 'Surgical Gloves',
    quantity: 15,
    minQuantity: 25,
    category: 'Supplies',
    location: 'Storage Room',
    notes: 'Size M, latex-free - LOW STOCK',
    format: 'EAN-13'
  },

  // Code 128 barcodes (alphanumeric, common in healthcare)
  {
    barcode: 'MED-001-2024',
    name: 'Antibiotic Cream',
    quantity: 30,
    minQuantity: 10,
    category: 'Medications',
    location: 'Refrigerator',
    notes: 'Keep refrigerated',
    format: 'Code128'
  },
  {
    barcode: 'EQP-THERM-100',
    name: 'Digital Thermometer',
    quantity: 12,
    minQuantity: 5,
    category: 'Equipment',
    location: 'Shelf A',
    notes: 'Infrared, contactless',
    format: 'Code128'
  },

  // UPC-A barcodes (12 digits, North American standard)
  {
    barcode: '012345678905',
    name: 'Hand Sanitizer 500ml',
    quantity: 45,
    minQuantity: 15,
    category: 'Supplies',
    location: 'Shelf B',
    notes: '70% alcohol',
    format: 'UPC-A'
  },
  {
    barcode: '036000291452',
    name: 'Ibuprofen 200mg',
    quantity: 8,
    minQuantity: 20,
    category: 'Medications',
    location: 'Shelf A',
    notes: 'Pain reliever - LOW STOCK',
    format: 'UPC-A'
  },

  // EAN-8 barcodes (8 digits, for small products)
  {
    barcode: '96385074',
    name: 'Alcohol Swabs',
    quantity: 200,
    minQuantity: 50,
    category: 'Supplies',
    location: 'Storage Room',
    notes: 'Individual packets',
    format: 'EAN-8'
  },

  // Code 39 barcodes (alphanumeric, common in logistics)
  {
    barcode: 'GAUZE-2024',
    name: 'Sterile Gauze Pads',
    quantity: 75,
    minQuantity: 25,
    category: 'First Aid',
    location: 'Shelf B',
    notes: '4x4 inch, individually wrapped',
    format: 'Code39'
  },
  {
    barcode: 'MASK-N95-500',
    name: 'N95 Respirator Masks',
    quantity: 3,
    minQuantity: 50,
    category: 'Supplies',
    location: 'Storage Room',
    notes: 'NIOSH approved - CRITICAL LOW STOCK',
    format: 'Code39'
  }
];

/**
 * Barcodes that should NOT be found in the inventory
 * Used for testing "Item Not Found" flow
 */
export const unknownBarcodes = [
  { barcode: '9999999999999', format: 'EAN-13', description: 'Unknown EAN-13' },
  { barcode: 'UNKNOWN-123', format: 'Code128', description: 'Unknown Code128' },
  { barcode: '999999999999', format: 'UPC-A', description: 'Unknown UPC-A' },
  { barcode: 'NOT-FOUND', format: 'Code39', description: 'Unknown Code39' }
];

/**
 * Helper function to seed the database with test items
 */
export async function seedBarcodeTestItems(createItemFn: (item: any) => Promise<void>) {
  for (const item of barcodeTestData) {
    await createItemFn({
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
}

/**
 * Generate barcode image URLs using a free online generator
 * These can be used for manual testing with actual camera scanning
 */
export function getBarcodeImageUrl(barcode: string, format: string): string {
  // Using barcode.tec-it.com free generator
  const formatMap: Record<string, string> = {
    'EAN-13': 'EAN13',
    'EAN-8': 'EAN8',
    'UPC-A': 'UPCA',
    'Code128': 'Code128',
    'Code39': 'Code39'
  };

  const barcodeType = formatMap[format] || 'Code128';
  return `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(barcode)}&code=${barcodeType}&translate-esc=on`;
}

/**
 * Get all test barcodes as an array of strings
 */
export function getAllTestBarcodes(): string[] {
  return barcodeTestData.map(item => item.barcode);
}

/**
 * Get low stock items from test data
 */
export function getLowStockTestItems(): BarcodeTestItem[] {
  return barcodeTestData.filter(item => item.quantity <= item.minQuantity);
}
