import { type InventoryItem } from '../db';

/**
 * Parsed CSV data structure
 */
export interface ParsedCSVData {
  headers: string[];
  rows: string[][];
  rowCount: number;
}

/**
 * Validation result structure
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Item validation result with line number
 */
export interface ItemValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  lineNumber: number;
}

/**
 * Duplicate information
 */
export interface DuplicateInfo {
  importIndex: number;
  existingItem: InventoryItem;
  matchType: 'id' | 'name' | 'barcode';
  lineNumber: number;
}

/**
 * Import validation result
 */
export interface ImportValidation {
  valid: boolean;
  items: Partial<InventoryItem>[];
  duplicates: DuplicateInfo[];
  missingCategories: string[];
  missingLocations: string[];
  errors: ValidationError[];
  warnings: string[];
}

/**
 * Validation error with context
 */
export interface ValidationError {
  message: string;
  lineNumber?: number;
  field?: string;
  value?: string;
}

/**
 * Expected CSV headers for inventory export (CSV only format)
 */
const EXPECTED_HEADERS_CSV = [
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

/**
 * Expected CSV headers for ZIP export (with photo references)
 */
const EXPECTED_HEADERS_ZIP = [
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

/**
 * Parses a quoted CSV field according to RFC 4180
 * Handles:
 * - Double quotes escaped as ""
 * - Fields wrapped in quotes
 * - Unquoted fields
 */
export function parseCSVField(field: string): string {
  const trimmed = field.trim();

  // Check if field is quoted
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    // Remove surrounding quotes
    const content = trimmed.slice(1, -1);
    // Unescape doubled quotes
    return content.replace(/""/g, '"');
  }

  return trimmed;
}

/**
 * Parses CSV content into structured data
 * Handles UTF-8 BOM, multiple line endings, quoted fields with newlines
 * RFC 4180 compliant parser
 */
export function parseCSV(csvContent: string): ParsedCSVData {
  // Remove UTF-8 BOM if present
  let content = csvContent;
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  // Normalize line endings (handle CRLF, LF, CR)
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  // Parse character by character to handle quoted fields with newlines
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote - add single quote to field
        currentField += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      // Field separator - save current field
      currentRow.push(parseCSVField(currentField));
      currentField = '';
    } else if (char === '\n' && !insideQuotes) {
      // Row separator - save current field and row
      currentRow.push(parseCSVField(currentField));
      currentField = '';

      // Only add non-empty rows
      if (currentRow.length > 0 && currentRow.some(field => field.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      // Regular character (including newlines inside quotes)
      currentField += char;
    }
  }

  // Handle last field and row if content doesn't end with newline
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(parseCSVField(currentField));
    if (currentRow.length > 0 && currentRow.some(field => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    return { headers: [], rows: [], rowCount: 0 };
  }

  // First row is headers
  const headers = rows[0];
  const dataRows = rows.slice(1);

  return {
    headers,
    rows: dataRows,
    rowCount: dataRows.length,
  };
}

/**
 * Validates CSV structure (headers and basic format)
 */
export function validateCSVStructure(data: ParsedCSVData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if CSV is empty
  if (data.rowCount === 0) {
    errors.push('CSV file is empty (no data rows)');
    return { valid: false, errors, warnings };
  }

  // Check header format
  const isCSVFormat =
    JSON.stringify(data.headers) === JSON.stringify(EXPECTED_HEADERS_CSV);
  const isZIPFormat =
    JSON.stringify(data.headers) === JSON.stringify(EXPECTED_HEADERS_ZIP);

  if (!isCSVFormat && !isZIPFormat) {
    errors.push(
      `Invalid CSV headers. Expected either:\n` +
        `  CSV format: ${EXPECTED_HEADERS_CSV.join(', ')}\n` +
        `  ZIP format: ${EXPECTED_HEADERS_ZIP.join(', ')}\n` +
        `  Got: ${data.headers.join(', ')}`
    );
    return { valid: false, errors, warnings };
  }

  // Check column count consistency
  const expectedColumnCount = data.headers.length;
  const inconsistentRows: number[] = [];

  data.rows.forEach((row, index) => {
    if (row.length !== expectedColumnCount) {
      inconsistentRows.push(index + 2); // +2 for header row and 0-based index
    }
  });

  if (inconsistentRows.length > 0) {
    errors.push(
      `Inconsistent column count on rows: ${inconsistentRows.slice(0, 5).join(', ')}` +
        (inconsistentRows.length > 5 ? ` and ${inconsistentRows.length - 5} more` : '')
    );
  }

  // Add warning about photo handling
  if (isCSVFormat) {
    warnings.push(
      'CSV format detected - photos cannot be restored from CSV-only exports (use ZIP export for photo backup)'
    );
  } else {
    warnings.push(
      'ZIP format detected - photo references found. Photos will be restored if available in ZIP file.'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a single item's data
 */
export function validateItemData(
  row: string[],
  lineNumber: number,
  isZIPFormat: boolean
): ItemValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Map CSV columns to field names
  const [id, name, barcode, quantity, minQuantity, category, location, notes] = row;

  // Required field: Name
  if (!name || name.trim().length === 0) {
    errors.push(`Line ${lineNumber}: Name is required`);
  }

  // Validate name length
  if (name && name.length > 100) {
    errors.push(`Line ${lineNumber}: Name exceeds maximum length (100 characters)`);
  }

  // Required field: Quantity
  if (!quantity || quantity.trim().length === 0) {
    errors.push(`Line ${lineNumber}: Quantity is required`);
  } else {
    const qtyNum = parseInt(quantity);
    if (isNaN(qtyNum)) {
      errors.push(`Line ${lineNumber}: Quantity must be a valid number (got: "${quantity}")`);
    } else if (qtyNum < 0) {
      errors.push(`Line ${lineNumber}: Quantity cannot be negative`);
    }
  }

  // Validate minQuantity if present
  if (minQuantity && minQuantity.trim().length > 0) {
    const minQtyNum = parseInt(minQuantity);
    if (isNaN(minQtyNum)) {
      errors.push(
        `Line ${lineNumber}: Min Quantity must be a valid number (got: "${minQuantity}")`
      );
    } else if (minQtyNum < 0) {
      errors.push(`Line ${lineNumber}: Min Quantity cannot be negative`);
    }
  }

  // Required field: Category
  if (!category || category.trim().length === 0) {
    errors.push(`Line ${lineNumber}: Category is required`);
  }

  // Required field: Location
  if (!location || location.trim().length === 0) {
    errors.push(`Line ${lineNumber}: Location is required`);
  }

  // Validate ID if present
  if (id && id.trim().length > 0) {
    const idNum = parseInt(id);
    if (isNaN(idNum)) {
      errors.push(`Line ${lineNumber}: ID must be a valid number (got: "${id}")`);
    } else if (idNum < 1) {
      errors.push(`Line ${lineNumber}: ID must be positive`);
    }
  }

  // Validate dates if present
  const createdAt = row[isZIPFormat ? 9 : 9];
  const updatedAt = row[isZIPFormat ? 10 : 10];

  if (createdAt && createdAt.trim().length > 0) {
    const date = new Date(createdAt);
    if (isNaN(date.getTime())) {
      warnings.push(`Line ${lineNumber}: Invalid Created At date, will use current time`);
    }
  }

  if (updatedAt && updatedAt.trim().length > 0) {
    const date = new Date(updatedAt);
    if (isNaN(date.getTime())) {
      warnings.push(`Line ${lineNumber}: Invalid Updated At date, will use current time`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    lineNumber,
  };
}

/**
 * Converts a CSV row to a partial InventoryItem
 */
export function csvRowToItem(
  row: string[],
  isZIPFormat: boolean
): Partial<InventoryItem> {
  // Destructure row with all fields (even if some are unused in initial parsing)
  const id = row[0];
  const name = row[1];
  const barcode = row[2];
  const quantity = row[3];
  const minQuantity = row[4];
  const category = row[5];
  const location = row[6];
  const notes = row[7];
  const photoData = row[8];
  const createdAt = row[9];
  const updatedAt = row[10];

  const item: Partial<InventoryItem> = {
    name: name.trim(),
    quantity: parseInt(quantity) || 0,
    category: category.trim(),
    location: location.trim(),
    photos: [],
    syncStatus: 'pending',
  };

  // Optional fields
  if (id && id.trim().length > 0) {
    const idNum = parseInt(id);
    if (!isNaN(idNum)) {
      item.id = idNum;
    }
  }

  if (barcode && barcode.trim().length > 0) {
    item.barcode = barcode.trim();
  }

  if (minQuantity && minQuantity.trim().length > 0) {
    const minQty = parseInt(minQuantity);
    if (!isNaN(minQty)) {
      item.minQuantity = minQty;
    }
  }

  if (notes && notes.trim().length > 0) {
    item.notes = notes.trim();
  }

  // Handle dates
  if (createdAt && createdAt.trim().length > 0) {
    const date = new Date(createdAt);
    if (!isNaN(date.getTime())) {
      item.createdAt = date;
    }
  }

  if (updatedAt && updatedAt.trim().length > 0) {
    const date = new Date(updatedAt);
    if (!isNaN(date.getTime())) {
      item.updatedAt = date;
    }
  }

  // Store photo references for ZIP imports (will be resolved later)
  if (isZIPFormat && photoData && photoData.trim().length > 0) {
    // Photos are pipe-separated paths in ZIP format
    // We'll store these temporarily and resolve them during ZIP extraction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (item as any).photoReferences = photoData.split('|').filter((p) => p.trim().length > 0);
  }

  return item;
}

/**
 * Validates import data against existing items and categories/locations
 */
export function validateImportData(
  items: Partial<InventoryItem>[],
  existingItems: InventoryItem[],
  existingCategories: string[],
  existingLocations: string[]
): ImportValidation {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];
  const duplicates: DuplicateInfo[] = [];
  const missingCategories = new Set<string>();
  const missingLocations = new Set<string>();

  // Build lookup maps for existing items
  const itemsByName = new Map<string, InventoryItem>();
  const itemsById = new Map<number, InventoryItem>();
  const itemsByBarcode = new Map<string, InventoryItem>();

  existingItems.forEach((item) => {
    itemsByName.set(item.name.toLowerCase(), item);
    if (item.id) itemsById.set(item.id, item);
    if (item.barcode) itemsByBarcode.set(item.barcode, item);
  });

  // Validate each item
  items.forEach((item, index) => {
    const lineNumber = index + 2; // +2 for header row and 0-based index

    // Check for duplicates
    if (item.id && itemsById.has(item.id)) {
      duplicates.push({
        importIndex: index,
        existingItem: itemsById.get(item.id)!,
        matchType: 'id',
        lineNumber,
      });
    } else if (item.name && itemsByName.has(item.name.toLowerCase())) {
      duplicates.push({
        importIndex: index,
        existingItem: itemsByName.get(item.name.toLowerCase())!,
        matchType: 'name',
        lineNumber,
      });
    } else if (item.barcode && item.barcode.length > 0 && itemsByBarcode.has(item.barcode)) {
      duplicates.push({
        importIndex: index,
        existingItem: itemsByBarcode.get(item.barcode)!,
        matchType: 'barcode',
        lineNumber,
      });
    }

    // Check for missing categories
    if (item.category && !existingCategories.includes(item.category)) {
      missingCategories.add(item.category);
    }

    // Check for missing locations
    if (item.location && !existingLocations.includes(item.location)) {
      missingLocations.add(item.location);
    }
  });

  // Add warnings about duplicates
  if (duplicates.length > 0) {
    warnings.push(
      `Found ${duplicates.length} duplicate item(s) that match existing inventory. ` +
        `Choose a duplicate handling strategy (skip, overwrite, or rename).`
    );
  }

  // Add warnings about missing categories/locations
  if (missingCategories.size > 0) {
    warnings.push(
      `Found ${missingCategories.size} category/categories not in your inventory: ${Array.from(missingCategories).join(', ')}. ` +
        `Enable "Create missing categories" to add them automatically.`
    );
  }

  if (missingLocations.size > 0) {
    warnings.push(
      `Found ${missingLocations.size} location(s) not in your inventory: ${Array.from(missingLocations).join(', ')}. ` +
        `Enable "Create missing locations" to add them automatically.`
    );
  }

  return {
    valid: errors.length === 0,
    items,
    duplicates,
    missingCategories: Array.from(missingCategories),
    missingLocations: Array.from(missingLocations),
    errors,
    warnings,
  };
}
