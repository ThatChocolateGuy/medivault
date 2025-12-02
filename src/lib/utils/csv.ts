import { type InventoryItem } from '../db';

/**
 * Escapes a CSV field value
 * - Wraps in quotes if contains comma, quote, or newline
 * - Doubles any quotes inside the value
 */
export function escapeCSVField(value: string | number | undefined): string {
  if (value === undefined || value === null) {
    return '';
  }

  const stringValue = String(value);

  // Check if field needs quoting
  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n')
  ) {
    // Escape quotes by doubling them
    const escaped = stringValue.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return stringValue;
}

/**
 * Converts inventory items to CSV format
 */
export function convertItemsToCSV(items: InventoryItem[]): string {
  // CSV Header
  const headers = [
    'ID',
    'Name',
    'Barcode',
    'Quantity',
    'Min Quantity',
    'Category',
    'Location',
    'Notes',
    'Photo Count',
    'Created At',
    'Updated At',
  ];

  // Build CSV rows
  const rows = items.map((item) => [
    escapeCSVField(item.id),
    escapeCSVField(item.name),
    escapeCSVField(item.barcode),
    escapeCSVField(item.quantity),
    escapeCSVField(item.minQuantity),
    escapeCSVField(item.category),
    escapeCSVField(item.location),
    escapeCSVField(item.notes),
    escapeCSVField(item.photos.length),
    escapeCSVField(item.createdAt.toISOString()),
    escapeCSVField(item.updatedAt.toISOString()),
  ]);

  // Combine header and rows
  const csvLines = [headers.join(','), ...rows.map((row) => row.join(','))];

  return csvLines.join('\n');
}

/**
 * Triggers browser download of CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  // Create Blob with UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates filename with timestamp
 */
export function generateExportFilename(): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, -5);
  return `medivault-inventory-${timestamp}.csv`;
}
