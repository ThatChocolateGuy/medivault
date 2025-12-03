import JSZip from 'jszip';
import { type InventoryItem } from '../db';
import { escapeCSVField, generateTimestamp } from './csv';

/**
 * Allowed MIME types for image export
 */
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

/**
 * Gets file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  };
  return extensions[mimeType] || 'jpg';
}

/**
 * Converts a base64 data URL to a Blob
 * Validates that the MIME type is an expected image format
 */
function base64ToBlob(base64: string): Blob {
  // Extract the base64 data and MIME type
  const matches = base64.match(/^data:([^;]+);base64,(.+)$/);

  if (!matches) {
    throw new Error('Invalid base64 data URL');
  }

  const mimeType = matches[1];
  const base64Data = matches[2];

  // Validate MIME type is an expected image format
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    throw new Error(`Unsupported MIME type: ${mimeType}`);
  }

  // Decode base64 to binary
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new Blob([bytes], { type: mimeType });
}

/**
 * Converts inventory items to CSV with photo filename references
 */
function convertItemsToCSVWithPhotos(items: InventoryItem[]): string {
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
    'Photos',
    'Created At',
    'Updated At',
  ];

  // Build CSV rows
  const rows = items.map((item) => {
    // Generate photo filenames with correct extensions based on MIME type
    const photoFilenames = item.photos.map((photo, index) => {
      const matches = photo.match(/^data:([^;]+);base64,/);
      const mimeType = matches ? matches[1] : 'image/jpeg';
      const extension = getExtensionFromMimeType(mimeType);
      return `photos/item-${item.id}-photo-${index + 1}.${extension}`;
    });

    return [
      escapeCSVField(item.id),
      escapeCSVField(item.name),
      escapeCSVField(item.barcode),
      escapeCSVField(item.quantity),
      escapeCSVField(item.minQuantity),
      escapeCSVField(item.category),
      escapeCSVField(item.location),
      escapeCSVField(item.notes),
      escapeCSVField(photoFilenames.join('|')), // Pipe-separated photo paths
      escapeCSVField(item.createdAt.toISOString()),
      escapeCSVField(item.updatedAt.toISOString()),
    ];
  });

  // Combine header and rows
  const csvLines = [headers.join(','), ...rows.map((row) => row.join(','))];

  return csvLines.join('\n');
}

/**
 * Creates and downloads a ZIP file containing inventory data and photos
 */
export async function exportInventoryWithPhotos(
  items: InventoryItem[]
): Promise<void> {
  const zip = new JSZip();

  // Add CSV file
  const csvContent = convertItemsToCSVWithPhotos(items);
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  zip.file('inventory.csv', BOM + csvContent);

  // Create photos folder
  const photosFolder = zip.folder('photos');
  if (!photosFolder) {
    throw new Error('Failed to create photos folder in ZIP');
  }

  // Add all photos
  for (const item of items) {
    for (let i = 0; i < item.photos.length; i++) {
      const photoBase64 = item.photos[i];

      try {
        // Convert base64 to Blob
        const blob = base64ToBlob(photoBase64);

        // Get proper extension from MIME type
        const matches = photoBase64.match(/^data:([^;]+);base64,/);
        const mimeType = matches ? matches[1] : 'image/jpeg';
        const extension = getExtensionFromMimeType(mimeType);

        // Add to ZIP with descriptive filename
        const filename = `item-${item.id}-photo-${i + 1}.${extension}`;
        photosFolder.file(filename, blob);
      } catch (err) {
        console.error(`Failed to process photo ${i + 1} for item ${item.id}:`, err);
        // Continue processing other photos even if one fails
      }
    }
  }

  // Generate ZIP file
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 6, // Balance between speed and compression
    },
  });

  // Generate filename with timestamp
  const filename = `medivault-backup-${generateTimestamp()}.zip`;

  // Trigger download
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Estimates the size of the export in MB
 */
export function estimateExportSize(items: InventoryItem[]): number {
  let totalBytes = 0;

  // Estimate CSV size (very rough)
  totalBytes += items.length * 200; // ~200 bytes per item in CSV

  // Count photo data
  for (const item of items) {
    for (const photo of item.photos) {
      // Base64 is ~33% larger than binary, so divide by 1.33 to get original size
      totalBytes += photo.length / 1.33;
    }
  }

  // Convert to MB
  return totalBytes / (1024 * 1024);
}
