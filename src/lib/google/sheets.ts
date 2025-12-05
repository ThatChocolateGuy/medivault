/**
 * Google Sheets API Service
 *
 * Provides two-way sync functionality between the local IndexedDB
 * and a Google Sheets spreadsheet.
 *
 * Features:
 * - Spreadsheet creation and detection
 * - Bidirectional sync with conflict resolution
 * - Batch operations for efficient API usage
 * - Exponential backoff for rate limiting
 */

import { getValidAccessToken } from './oauth';
import { type InventoryItem, type Category, type Location } from '../db';

// Google Sheets API base URL
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

// Spreadsheet configuration
const SPREADSHEET_TITLE = 'MediVault Inventory';
const ITEMS_SHEET = 'Items';
const CATEGORIES_SHEET = 'Categories';
const LOCATIONS_SHEET = 'Locations';
const METADATA_SHEET = 'Metadata';

// Column headers for each sheet
const ITEMS_HEADERS = [
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
  'Sync Status',
  'Photo IDs',
];

const CATEGORIES_HEADERS = ['ID', 'Name', 'Color', 'Created At'];

const LOCATIONS_HEADERS = ['ID', 'Name', 'Description', 'Created At'];

const METADATA_HEADERS = ['Key', 'Value', 'Updated At'];

/**
 * Error type for Sheets API operations
 */
export type SheetsApiErrorCode =
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'CONFLICT';

export class SheetsApiError extends Error {
  code: SheetsApiErrorCode;

  constructor(message: string, code: SheetsApiErrorCode) {
    super(message);
    this.name = 'SheetsApiError';
    this.code = code;
  }
}

/**
 * Spreadsheet metadata stored locally
 */
export interface SpreadsheetInfo {
  spreadsheetId: string;
  spreadsheetUrl: string;
  lastSyncAt?: Date;
}

/**
 * Sync result structure
 */
export interface SyncResult {
  success: boolean;
  itemsSynced: number;
  categoriesSynced: number;
  locationsSynced: number;
  conflicts: SyncConflict[];
  errors: string[];
  duration: number;
}

/**
 * Conflict information for manual resolution
 */
export interface SyncConflict {
  entityType: 'item' | 'category' | 'location';
  entityId: number;
  localData: unknown;
  remoteData: unknown;
  conflictType: 'both_modified' | 'deleted_remotely' | 'deleted_locally';
}

/**
 * Make an authenticated request to Google Sheets API with retry logic
 */
async function sheetsRequest<T>(
  url: string,
  options: RequestInit = {},
  retries = 3
): Promise<T> {
  const accessToken = await getValidAccessToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    // Handle rate limiting with exponential backoff
    if (response.status === 429 && retries > 0) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
      console.log(`⚠️ Rate limited, retrying after ${retryAfter}s...`);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      return sheetsRequest<T>(url, options, retries - 1);
    }

    // Handle specific error codes
    if (response.status === 404) {
      throw new SheetsApiError('Spreadsheet not found', 'NOT_FOUND');
    }
    if (response.status === 403) {
      throw new SheetsApiError('Permission denied', 'PERMISSION_DENIED');
    }

    const errorData = await response.json().catch(() => ({}));
    throw new SheetsApiError(
      `API request failed: ${errorData.error?.message || response.statusText}`,
      'INVALID_RESPONSE'
    );
  }

  return response.json();
}

/**
 * Search for an existing MediVault spreadsheet in Google Drive
 */
export async function findExistingSpreadsheet(): Promise<SpreadsheetInfo | null> {
  const accessToken = await getValidAccessToken();

  const query = encodeURIComponent(
    `name='${SPREADSHEET_TITLE}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
  );

  const response = await fetch(
    `${DRIVE_API_BASE}/files?q=${query}&fields=files(id,name,webViewLink)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new SheetsApiError('Failed to search for spreadsheet', 'NETWORK_ERROR');
  }

  const data = await response.json();

  if (data.files && data.files.length > 0) {
    const file = data.files[0];
    return {
      spreadsheetId: file.id,
      spreadsheetUrl: file.webViewLink,
    };
  }

  return null;
}

/**
 * Create a new MediVault spreadsheet with proper structure
 */
export async function createSpreadsheet(): Promise<SpreadsheetInfo> {
  const accessToken = await getValidAccessToken();

  const spreadsheetBody = {
    properties: {
      title: SPREADSHEET_TITLE,
    },
    sheets: [
      {
        properties: { title: ITEMS_SHEET, index: 0 },
        data: [
          {
            rowData: [
              {
                values: ITEMS_HEADERS.map((header) => ({
                  userEnteredValue: { stringValue: header },
                  userEnteredFormat: { textFormat: { bold: true } },
                })),
              },
            ],
          },
        ],
      },
      {
        properties: { title: CATEGORIES_SHEET, index: 1 },
        data: [
          {
            rowData: [
              {
                values: CATEGORIES_HEADERS.map((header) => ({
                  userEnteredValue: { stringValue: header },
                  userEnteredFormat: { textFormat: { bold: true } },
                })),
              },
            ],
          },
        ],
      },
      {
        properties: { title: LOCATIONS_SHEET, index: 2 },
        data: [
          {
            rowData: [
              {
                values: LOCATIONS_HEADERS.map((header) => ({
                  userEnteredValue: { stringValue: header },
                  userEnteredFormat: { textFormat: { bold: true } },
                })),
              },
            ],
          },
        ],
      },
      {
        properties: { title: METADATA_SHEET, index: 3 },
        data: [
          {
            rowData: [
              {
                values: METADATA_HEADERS.map((header) => ({
                  userEnteredValue: { stringValue: header },
                  userEnteredFormat: { textFormat: { bold: true } },
                })),
              },
            ],
          },
        ],
      },
    ],
  };

  const response = await fetch(SHEETS_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(spreadsheetBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new SheetsApiError(
      `Failed to create spreadsheet: ${errorData.error?.message || 'Unknown error'}`,
      'INVALID_RESPONSE'
    );
  }

  const data = await response.json();

  console.log('✅ Created new MediVault spreadsheet');

  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl,
  };
}

/**
 * Get or create the MediVault spreadsheet
 */
export async function getOrCreateSpreadsheet(): Promise<SpreadsheetInfo> {
  // First, try to find an existing spreadsheet
  const existing = await findExistingSpreadsheet();
  if (existing) {
    console.log('📊 Found existing MediVault spreadsheet');
    return existing;
  }

  // Create a new one if not found
  return createSpreadsheet();
}

/**
 * Convert an inventory item to spreadsheet row values
 */
function itemToRowValues(item: InventoryItem): string[] {
  return [
    String(item.id || ''),
    item.name,
    item.barcode || '',
    String(item.quantity),
    String(item.minQuantity ?? ''),
    item.category,
    item.location,
    item.notes || '',
    String(item.photos?.length || 0),
    item.createdAt.toISOString(),
    item.updatedAt.toISOString(),
    item.syncStatus,
    '', // Photo IDs placeholder - will be updated after Drive upload
  ];
}

/**
 * Convert a spreadsheet row to an inventory item
 */
function rowToItem(row: string[]): Partial<InventoryItem> {
  return {
    id: row[0] ? parseInt(row[0]) : undefined,
    name: row[1],
    barcode: row[2] || undefined,
    quantity: parseInt(row[3]) || 0,
    minQuantity: row[4] ? parseInt(row[4]) : undefined,
    category: row[5],
    location: row[6],
    notes: row[7] || undefined,
    photos: [], // Photos loaded separately from Drive
    createdAt: new Date(row[9]),
    updatedAt: new Date(row[10]),
    syncStatus: (row[11] as 'synced' | 'pending' | 'error') || 'synced',
  };
}

/**
 * Convert a category to spreadsheet row values
 */
function categoryToRowValues(category: Category): string[] {
  return [
    String(category.id || ''),
    category.name,
    category.color || '',
    category.createdAt.toISOString(),
  ];
}

/**
 * Convert a spreadsheet row to a category
 */
function rowToCategory(row: string[]): Partial<Category> {
  return {
    id: row[0] ? parseInt(row[0]) : undefined,
    name: row[1],
    color: row[2] || undefined,
    createdAt: new Date(row[3]),
  };
}

/**
 * Convert a location to spreadsheet row values
 */
function locationToRowValues(location: Location): string[] {
  return [
    String(location.id || ''),
    location.name,
    location.description || '',
    location.createdAt.toISOString(),
  ];
}

/**
 * Convert a spreadsheet row to a location
 */
function rowToLocation(row: string[]): Partial<Location> {
  return {
    id: row[0] ? parseInt(row[0]) : undefined,
    name: row[1],
    description: row[2] || undefined,
    createdAt: new Date(row[3]),
  };
}

/**
 * Read all data from a specific sheet
 */
export async function readSheetData<T>(
  spreadsheetId: string,
  sheetName: string,
  parser: (row: string[]) => T
): Promise<T[]> {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A2:Z1000`;

  const data = await sheetsRequest<{ values?: string[][] }>(url);

  if (!data.values || data.values.length === 0) {
    return [];
  }

  return data.values.map(parser);
}

/**
 * Write data to a specific sheet (replaces all existing data except header)
 */
export async function writeSheetData<T>(
  spreadsheetId: string,
  sheetName: string,
  items: T[],
  converter: (item: T) => string[]
): Promise<void> {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A2:Z1000?valueInputOption=RAW`;

  const values = items.map(converter);

  await sheetsRequest(url, {
    method: 'PUT',
    body: JSON.stringify({ values }),
  });
}

/**
 * Append a single row to a sheet
 */
export async function appendRow(
  spreadsheetId: string,
  sheetName: string,
  values: string[]
): Promise<void> {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

  await sheetsRequest(url, {
    method: 'POST',
    body: JSON.stringify({ values: [values] }),
  });
}

/**
 * Clear all data from a sheet except the header row
 */
export async function clearSheetData(spreadsheetId: string, sheetName: string): Promise<void> {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A2:Z1000:clear`;

  await sheetsRequest(url, {
    method: 'POST',
  });
}

/**
 * Get all items from the spreadsheet
 */
export async function getRemoteItems(spreadsheetId: string): Promise<Partial<InventoryItem>[]> {
  return readSheetData(spreadsheetId, ITEMS_SHEET, rowToItem);
}

/**
 * Get all categories from the spreadsheet
 */
export async function getRemoteCategories(spreadsheetId: string): Promise<Partial<Category>[]> {
  return readSheetData(spreadsheetId, CATEGORIES_SHEET, rowToCategory);
}

/**
 * Get all locations from the spreadsheet
 */
export async function getRemoteLocations(spreadsheetId: string): Promise<Partial<Location>[]> {
  return readSheetData(spreadsheetId, LOCATIONS_SHEET, rowToLocation);
}

/**
 * Sync all items to the spreadsheet (full overwrite)
 */
export async function syncItemsToSheet(
  spreadsheetId: string,
  items: InventoryItem[]
): Promise<void> {
  await writeSheetData(spreadsheetId, ITEMS_SHEET, items, itemToRowValues);
}

/**
 * Sync all categories to the spreadsheet (full overwrite)
 */
export async function syncCategoriesToSheet(
  spreadsheetId: string,
  categories: Category[]
): Promise<void> {
  await writeSheetData(spreadsheetId, CATEGORIES_SHEET, categories, categoryToRowValues);
}

/**
 * Sync all locations to the spreadsheet (full overwrite)
 */
export async function syncLocationsToSheet(
  spreadsheetId: string,
  locations: Location[]
): Promise<void> {
  await writeSheetData(spreadsheetId, LOCATIONS_SHEET, locations, locationToRowValues);
}

/**
 * Update metadata in the spreadsheet
 */
export async function updateMetadata(
  spreadsheetId: string,
  key: string,
  value: string
): Promise<void> {
  // Read current metadata
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(METADATA_SHEET)}!A2:C100`;
  const data = await sheetsRequest<{ values?: string[][] }>(url);

  const now = new Date().toISOString();
  const existingRows = data.values || [];
  const keyIndex = existingRows.findIndex((row) => row[0] === key);

  if (keyIndex >= 0) {
    // Update existing row
    const rowNumber = keyIndex + 2; // Account for header row and 1-based indexing
    const updateUrl = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(METADATA_SHEET)}!A${rowNumber}:C${rowNumber}?valueInputOption=RAW`;
    await sheetsRequest(updateUrl, {
      method: 'PUT',
      body: JSON.stringify({ values: [[key, value, now]] }),
    });
  } else {
    // Append new row
    await appendRow(spreadsheetId, METADATA_SHEET, [key, value, now]);
  }
}

/**
 * Get metadata value from the spreadsheet
 */
export async function getMetadata(spreadsheetId: string, key: string): Promise<string | null> {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(METADATA_SHEET)}!A2:B100`;
  const data = await sheetsRequest<{ values?: string[][] }>(url);

  if (!data.values) return null;

  const row = data.values.find((r) => r[0] === key);
  return row ? row[1] : null;
}
