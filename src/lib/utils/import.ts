import JSZip from 'jszip';
import { importItems, type ImportOptions, type ImportResult } from '../db/operations';
import { getAllCategories, getAllLocations, getAllItems } from '../db/operations';
import {
  parseCSV,
  validateCSVStructure,
  validateItemData,
  csvRowToItem,
  validateImportData,
} from './csvParser';

/**
 * Import progress phases
 */
export type ImportPhase = 'parsing' | 'validating' | 'importing' | 'photos' | 'complete' | 'error';

/**
 * Progress callback structure
 */
export interface ImportProgress {
  phase: ImportPhase;
  itemsProcessed: number;
  itemsTotal: number;
  percentComplete: number;
  currentItem?: string;
  message?: string;
}

/**
 * Import error with context
 */
export interface ImportError {
  message: string;
  phase: ImportPhase;
  details?: string;
}

/**
 * Extended import result with photos
 */
export interface ExtendedImportResult extends ImportResult {
  photosRestored: number;
}

/**
 * Options for import with progress callback
 */
export interface ExtendedImportOptions extends ImportOptions {
  onProgress?: (progress: ImportProgress) => void;
}

/**
 * Validates ZIP structure (must contain inventory.csv and optionally photos/)
 */
async function validateZIPStructure(zip: JSZip): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Check for inventory.csv
  const csvFile = zip.file('inventory.csv');
  if (!csvFile) {
    errors.push('ZIP file must contain inventory.csv');
  }

  // Validate file size (prevent denial of service)
  const fileCount = Object.keys(zip.files).length;
  if (fileCount > 10000) {
    errors.push('ZIP file contains too many files (maximum: 10000)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Extracts CSV content from ZIP file
 */
async function extractCSVFromZIP(zip: JSZip): Promise<string> {
  const csvFile = zip.file('inventory.csv');
  if (!csvFile) {
    throw new Error('inventory.csv not found in ZIP file');
  }

  try {
    const content = await csvFile.async('string');
    return content;
  } catch (error) {
    throw new Error(
      `Failed to read inventory.csv: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Converts a Blob to base64 data URL
 */
async function photoToBase64(blob: Blob, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };

    reader.onerror = () => {
      reject(new Error('Failed to read photo blob'));
    };

    // Set proper MIME type
    const properBlob = new Blob([blob], { type: mimeType });
    reader.readAsDataURL(properBlob);
  });
}

/**
 * Gets MIME type from file extension
 */
function getMimeTypeFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };

  return mimeTypes[ext || 'jpg'] || 'image/jpeg';
}

/**
 * Extracts photos from ZIP and maps them to items by ID
 * Returns a map of item IDs to photo base64 arrays
 */
async function extractPhotosFromZIP(
  zip: JSZip,
  onProgress?: (progress: ImportProgress) => void
): Promise<Map<number, string[]>> {
  const photoMap = new Map<number, string[]>();
  const photosFolder = zip.folder('photos');

  if (!photosFolder) {
    // No photos folder - return empty map
    return photoMap;
  }

  // Build list of all photo files
  const photoFiles: { filename: string; file: JSZip.JSZipObject }[] = [];
  photosFolder.forEach((relativePath, file) => {
    if (!file.dir) {
      photoFiles.push({ filename: relativePath, file });
    }
  });

  // Process each photo file
  let processed = 0;
  for (const { filename, file } of photoFiles) {
    try {
      // Parse filename to extract item ID and photo index
      // Expected format: item-{id}-photo-{index}.{ext}
      const match = filename.match(/^item-(\d+)-photo-\d+\.(jpg|jpeg|png|gif|webp)$/i);

      if (!match) {
        if (import.meta.env.DEV) {
          console.warn(`Skipping invalid photo filename: ${filename}`);
        }
        continue;
      }

      const itemId = parseInt(match[1]);

      // Extract photo blob
      const blob = await file.async('blob');

      // Convert to base64 with proper MIME type
      const mimeType = getMimeTypeFromExtension(filename);
      const base64 = await photoToBase64(blob, mimeType);

      // Add to map
      if (!photoMap.has(itemId)) {
        photoMap.set(itemId, []);
      }
      photoMap.get(itemId)!.push(base64);

      processed++;

      // Report progress
      if (onProgress) {
        onProgress({
          phase: 'photos',
          itemsProcessed: processed,
          itemsTotal: photoFiles.length,
          percentComplete: 70 + (processed / photoFiles.length) * 30, // Photos are 30% of total progress
          message: `Restoring photos (${processed}/${photoFiles.length})`,
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`Failed to process photo ${filename}:`, error);
      }
      // Continue processing other photos
    }
  }

  return photoMap;
}

/**
 * Import inventory from CSV content (no photos)
 */
export async function importInventoryFromCSV(
  csvContent: string,
  options: ExtendedImportOptions
): Promise<ExtendedImportResult> {
  const { onProgress, ...dbOptions } = options;
  const startTime = Date.now();

  try {
    // Phase 1: Parsing (0-20%)
    if (onProgress) {
      onProgress({
        phase: 'parsing',
        itemsProcessed: 0,
        itemsTotal: 0,
        percentComplete: 0,
        message: 'Parsing CSV file...',
      });
    }

    const parsedData = parseCSV(csvContent);

    if (onProgress) {
      onProgress({
        phase: 'parsing',
        itemsProcessed: parsedData.rowCount,
        itemsTotal: parsedData.rowCount,
        percentComplete: 10,
        message: `Parsed ${parsedData.rowCount} items`,
      });
    }

    // Phase 2: Validation (20-40%)
    if (onProgress) {
      onProgress({
        phase: 'validating',
        itemsProcessed: 0,
        itemsTotal: parsedData.rowCount,
        percentComplete: 20,
        message: 'Validating data...',
      });
    }

    // Validate CSV structure
    const structureValidation = validateCSVStructure(parsedData);
    if (!structureValidation.valid) {
      throw new Error(structureValidation.errors.join('\n'));
    }

    // Detect format (CSV vs ZIP)
    const isZIPFormat = parsedData.headers.includes('Photos');

    // Validate each item
    const validationErrors: string[] = [];
    for (let i = 0; i < parsedData.rows.length; i++) {
      const row = parsedData.rows[i];
      const validation = validateItemData(row, i + 2, isZIPFormat);
      if (!validation.valid) {
        validationErrors.push(...validation.errors);
      }
    }

    if (validationErrors.length > 0) {
      throw new Error(`Validation failed:\n${validationErrors.slice(0, 5).join('\n')}`);
    }

    // Convert rows to items
    const items = parsedData.rows.map((row) => csvRowToItem(row, isZIPFormat));

    // Get existing data for duplicate detection
    const existingItems = await getAllItems();
    const existingCategories = (await getAllCategories()).map((c) => c.name);
    const existingLocations = (await getAllLocations()).map((l) => l.name);

    // Validate against existing data
    const importValidation = validateImportData(
      items,
      existingItems,
      existingCategories,
      existingLocations
    );

    if (!importValidation.valid) {
      throw new Error(importValidation.errors.map((e) => e.message).join('\n'));
    }

    if (onProgress) {
      onProgress({
        phase: 'validating',
        itemsProcessed: items.length,
        itemsTotal: items.length,
        percentComplete: 40,
        message: 'Validation complete',
      });
    }

    // Phase 3: Importing (40-100%)
    if (onProgress) {
      onProgress({
        phase: 'importing',
        itemsProcessed: 0,
        itemsTotal: items.length,
        percentComplete: 40,
        message: 'Importing items...',
      });
    }

    // Import items to database
    const dbResult = await importItems(items, dbOptions);

    if (onProgress) {
      onProgress({
        phase: 'complete',
        itemsProcessed: items.length,
        itemsTotal: items.length,
        percentComplete: 100,
        message: 'Import complete',
      });
    }

    // Return extended result
    return {
      ...dbResult,
      photosRestored: 0, // CSV import has no photos
      duration: Date.now() - startTime,
    };
  } catch (error) {
    if (onProgress) {
      onProgress({
        phase: 'error',
        itemsProcessed: 0,
        itemsTotal: 0,
        percentComplete: 0,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      success: false,
      itemsImported: 0,
      itemsSkipped: 0,
      itemsOverwritten: 0,
      itemsRenamed: 0,
      categoriesCreated: 0,
      locationsCreated: 0,
      photosRestored: 0,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [],
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Import inventory from ZIP file (with photos)
 */
export async function importInventoryFromZIP(
  zipFile: File,
  options: ExtendedImportOptions
): Promise<ExtendedImportResult> {
  const { onProgress, ...dbOptions } = options;
  const startTime = Date.now();

  try {
    // Phase 1: Parsing ZIP (0-10%)
    if (onProgress) {
      onProgress({
        phase: 'parsing',
        itemsProcessed: 0,
        itemsTotal: 0,
        percentComplete: 0,
        message: 'Reading ZIP file...',
      });
    }

    // Load ZIP file
    const zip = await JSZip.loadAsync(zipFile);

    if (onProgress) {
      onProgress({
        phase: 'parsing',
        itemsProcessed: 0,
        itemsTotal: 0,
        percentComplete: 5,
        message: 'Validating ZIP structure...',
      });
    }

    // Validate ZIP structure
    const zipValidation = await validateZIPStructure(zip);
    if (!zipValidation.valid) {
      throw new Error(zipValidation.errors.join('\n'));
    }

    // Extract CSV
    const csvContent = await extractCSVFromZIP(zip);

    if (onProgress) {
      onProgress({
        phase: 'parsing',
        itemsProcessed: 0,
        itemsTotal: 0,
        percentComplete: 10,
        message: 'Parsing CSV data...',
      });
    }

    // Parse CSV
    const parsedData = parseCSV(csvContent);

    if (onProgress) {
      onProgress({
        phase: 'parsing',
        itemsProcessed: parsedData.rowCount,
        itemsTotal: parsedData.rowCount,
        percentComplete: 15,
        message: `Parsed ${parsedData.rowCount} items`,
      });
    }

    // Phase 2: Validation (15-30%)
    if (onProgress) {
      onProgress({
        phase: 'validating',
        itemsProcessed: 0,
        itemsTotal: parsedData.rowCount,
        percentComplete: 20,
        message: 'Validating data...',
      });
    }

    // Validate CSV structure
    const structureValidation = validateCSVStructure(parsedData);
    if (!structureValidation.valid) {
      throw new Error(structureValidation.errors.join('\n'));
    }

    // Detect format
    const isZIPFormat = parsedData.headers.includes('Photos');

    // Validate each item
    const validationErrors: string[] = [];
    for (let i = 0; i < parsedData.rows.length; i++) {
      const row = parsedData.rows[i];
      const validation = validateItemData(row, i + 2, isZIPFormat);
      if (!validation.valid) {
        validationErrors.push(...validation.errors);
      }
    }

    if (validationErrors.length > 0) {
      throw new Error(`Validation failed:\n${validationErrors.slice(0, 5).join('\n')}`);
    }

    // Convert rows to items
    const items = parsedData.rows.map((row) => csvRowToItem(row, isZIPFormat));

    // Get existing data
    const existingItems = await getAllItems();
    const existingCategories = (await getAllCategories()).map((c) => c.name);
    const existingLocations = (await getAllLocations()).map((l) => l.name);

    // Validate against existing data
    const importValidation = validateImportData(
      items,
      existingItems,
      existingCategories,
      existingLocations
    );

    if (!importValidation.valid) {
      throw new Error(importValidation.errors.map((e) => e.message).join('\n'));
    }

    if (onProgress) {
      onProgress({
        phase: 'validating',
        itemsProcessed: items.length,
        itemsTotal: items.length,
        percentComplete: 30,
        message: 'Validation complete',
      });
    }

    // Phase 3: Extract photos (30-70%)
    if (onProgress) {
      onProgress({
        phase: 'photos',
        itemsProcessed: 0,
        itemsTotal: items.length,
        percentComplete: 40,
        message: 'Extracting photos...',
      });
    }

    // Extract photos from ZIP
    const photoMap = await extractPhotosFromZIP(zip, onProgress);

    // Attach photos to items
    let photosRestored = 0;
    for (const item of items) {
      if (item.id && photoMap.has(item.id)) {
        item.photos = photoMap.get(item.id)!;
        photosRestored += item.photos.length;
      }
    }

    if (onProgress) {
      onProgress({
        phase: 'photos',
        itemsProcessed: items.length,
        itemsTotal: items.length,
        percentComplete: 70,
        message: `Restored ${photosRestored} photos`,
      });
    }

    // Phase 4: Importing (70-100%)
    if (onProgress) {
      onProgress({
        phase: 'importing',
        itemsProcessed: 0,
        itemsTotal: items.length,
        percentComplete: 70,
        message: 'Importing items...',
      });
    }

    // Import items to database
    const dbResult = await importItems(items, dbOptions);

    if (onProgress) {
      onProgress({
        phase: 'complete',
        itemsProcessed: items.length,
        itemsTotal: items.length,
        percentComplete: 100,
        message: 'Import complete',
      });
    }

    // Return extended result with photos
    return {
      ...dbResult,
      photosRestored,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    if (onProgress) {
      onProgress({
        phase: 'error',
        itemsProcessed: 0,
        itemsTotal: 0,
        percentComplete: 0,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      success: false,
      itemsImported: 0,
      itemsSkipped: 0,
      itemsOverwritten: 0,
      itemsRenamed: 0,
      categoriesCreated: 0,
      locationsCreated: 0,
      photosRestored: 0,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [],
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Auto-detect file type and import accordingly
 */
export async function autoImport(
  file: File,
  options: ExtendedImportOptions
): Promise<ExtendedImportResult> {
  const fileType = file.name.toLowerCase().endsWith('.zip') ? 'zip' : 'csv';

  if (fileType === 'zip') {
    return await importInventoryFromZIP(file, options);
  } else {
    // Read CSV file content
    const content = await file.text();
    return await importInventoryFromCSV(content, options);
  }
}
