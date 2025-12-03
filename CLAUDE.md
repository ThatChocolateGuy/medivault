# CLAUDE.md

This file provides guidance to Claude Code when working with the MediVault codebase.

## Project Overview

**MediVault** is a modern, mobile-first medical inventory management app with barcode scanning, offline support, and planned cloud sync. It's built with React 19, TypeScript, ZXing-JS for barcode scanning, and uses IndexedDB for local-first data storage.

**Current Status**: MVP Phase (v0.2.0) - Core CRUD operations complete, optimized barcode scanning fully implemented with ZXing-JS, sync features in development.

**Project Location**: `C:\Users\nemx1\medical-inventory-tracker`

## Tech Stack

### Core Technologies
- **Frontend Framework**: React 19.2.0 + TypeScript 5.9.3
- **Build Tool**: Vite 7.2.2
- **Styling**: Tailwind CSS 3.4.18 with custom utility classes
- **Database**: IndexedDB via Dexie.js 4.2.1 (offline-first storage)
- **Icons**: Lucide React 0.554.0
- **Date Utilities**: date-fns 4.1.0
- **State Management**: React Query (TanStack Query 5.90.10)

### Development Tools
- **Testing**: Playwright 1.56.1 (E2E tests with screenshots)
- **Linting**: ESLint 9.39.1 with TypeScript ESLint
- **Code Formatting**: Prettier 3.6.2
- **Package Manager**: npm (or bun)

### Data Export
- **CSV Export**: Native browser Blob API with UTF-8 BOM
- **ZIP Creation**: JSZip 3.10.1 (compression level 6)
- **Photo Export**: Base64 to Blob conversion with MIME type preservation

### Barcode Scanning
- **Library**: ZXing-JS (@zxing/library 0.21+, @zxing/browser 0.1+)
- **Status**: ✅ **FULLY IMPLEMENTED** (2025-01-21)
- **Performance**: Optimized for mobile devices with adaptive FPS, ROI processing, battery awareness
- **Documentation**: See `docs/BARCODE_SCANNER.md` for complete implementation details

### Planned/Installed Features
- **PWA**: vite-plugin-pwa 1.1.0 + Workbox 7.3.0 (installed, configuration pending)
- **Routing**: react-router-dom 7.9.6 (installed, not yet implemented)

## Project Structure

```
medical-inventory-tracker/
├── src/
│   ├── App.tsx                 # Main app component with page routing
│   ├── main.tsx                # React entry point
│   │
│   ├── components/
│   │   ├── common/             # Reusable UI components
│   │   │   ├── Button.tsx      # Primary/secondary button with loading state
│   │   │   ├── EmptyState.tsx  # Empty state messaging
│   │   │   ├── Input.tsx       # Form input with label
│   │   │   ├── SearchBar.tsx   # Search input with icon
│   │   │   └── Modal.tsx       # Reusable modal with animations
│   │   │
│   │   ├── items/
│   │   │   └── ItemCard.tsx    # Inventory item card with photo, category, location
│   │   │
│   │   ├── layout/
│   │   │   ├── BottomNav.tsx   # Mobile bottom navigation (Home, Scan, Add, Settings)
│   │   │   ├── Header.tsx      # Page header with back button and title
│   │   │   └── Layout.tsx      # Page layout wrapper with header and nav
│   │   │
│   │   ├── scanner/
│   │   │   └── BarcodeScanner.tsx  # ZXing-JS barcode scanner (FULLY FUNCTIONAL)
│   │   │
│   │   └── settings/
│   │       ├── CategoryManager.tsx  # Category CRUD UI with color picker
│   │       └── LocationManager.tsx  # Location CRUD UI with descriptions
│   │
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts        # Dexie database schema and initialization
│   │   │   └── operations.ts   # CRUD operations for items, categories, locations
│   │   │
│   │   └── utils/
│   │       └── index.ts        # Helper functions (image compression, etc.)
│   │
│   └── pages/
│       ├── HomePage.tsx        # Inventory list with search and low stock alerts
│       ├── AddItemPage.tsx     # Add new item form with photo capture
│       ├── ScannerPage.tsx     # Barcode scanner page (fully functional)
│       └── SettingsPage.tsx    # Settings page (sync, notifications, data management)
│
├── tests/                      # Playwright E2E tests
│   ├── 01-navigation.spec.ts   # Bottom nav tests
│   ├── 02-add-item.spec.ts     # Add item form tests
│   ├── 03-search.spec.ts       # Search functionality tests
│   ├── 04-scanner.spec.ts      # Scanner page tests
│   ├── 10-scanner-functionality.spec.ts  # Scanner detection tests
│   ├── 05-mobile-responsive.spec.ts  # Mobile viewport tests
│   ├── 06-visual-consistency.spec.ts # Visual styling tests
│   ├── 07-inventory-page.spec.ts     # Home page item display tests
│   └── 08-add-item-page.spec.ts      # Detailed add item tests
│
├── public/                     # Static assets
├── package.json                # Dependencies and scripts
├── vite.config.ts              # Vite configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── playwright.config.ts        # Playwright test configuration
└── tsconfig.json               # TypeScript configuration
```

## Database Schema

The app uses IndexedDB via Dexie.js with the following tables:

### `items` (InventoryItem)
- `id?: number` - Auto-increment primary key
- `name: string` - Item name (required)
- `barcode?: string` - Barcode/QR code
- `quantity: number` - Current quantity (required)
- `minQuantity?: number` - Minimum quantity for low stock alerts
- `category: string` - Category name (required)
- `location: string` - Storage location (required)
- `notes?: string` - Additional notes
- `photos: string[]` - Array of base64-encoded images
- `createdAt: Date` - Creation timestamp
- `updatedAt: Date` - Last update timestamp
- `syncStatus: 'synced' | 'pending' | 'error'` - Sync status with Google Sheets
- `syncedAt?: Date` - Last sync timestamp

**Indexes**: id, name, barcode, category, location, quantity, syncStatus, createdAt, updatedAt

### `categories` (Category)
- `id?: number` - Auto-increment primary key
- `name: string` - Category name (unique)
- `color?: string` - Hex color for badges
- `createdAt: Date` - Creation timestamp

**Default Categories**:
- Medications (#3b82f6 - blue)
- Supplies (#10b981 - green)
- Equipment (#f59e0b - orange)
- First Aid (#ef4444 - red)

### `locations` (Location)
- `id?: number` - Auto-increment primary key
- `name: string` - Location name (unique)
- `description?: string` - Location description
- `createdAt: Date` - Creation timestamp

**Default Locations**:
- Shelf A (Top shelf)
- Shelf B (Middle shelf)
- Refrigerator (Temperature controlled)
- Storage Room (Back storage)

### `syncQueue` (SyncOperation)
Tracks pending sync operations for Google Sheets integration.

- `id?: number` - Auto-increment primary key
- `entityType: 'item' | 'category' | 'location'` - Entity type
- `entityId: number` - ID of the entity
- `operation: 'create' | 'update' | 'delete'` - Operation type
- `data: Record<string, unknown>` - Operation data
- `status: 'pending' | 'processing' | 'completed' | 'failed'` - Operation status
- `error?: string` - Error message if failed
- `createdAt: Date` - Queue entry creation time
- `attemptedAt?: Date` - Last attempt timestamp

### `settings` (AppSettings)
- `id?: number` - Auto-increment primary key (should only have one record)
- `googleAccessToken?: string` - Google OAuth access token
- `googleRefreshToken?: string` - Google OAuth refresh token
- `spreadsheetId?: string` - Google Sheets spreadsheet ID
- `lastSyncAt?: Date` - Last successful sync timestamp
- `syncEnabled: boolean` - Enable/disable auto sync
- `lowStockAlerts: boolean` - Enable/disable low stock notifications

## Available Database Operations

All operations are in `src/lib/db/operations.ts`:

### Item Operations
- `getAllItems()` - Get all items ordered by updatedAt (newest first)
- `getItemById(id)` - Get single item by ID
- `getItemByBarcode(barcode)` - Find item by barcode
- `searchItems(query)` - Search items by name, barcode, category, location, notes
- `createItem(item)` - Create new item (adds to sync queue)
- `updateItem(id, updates)` - Update item (adds to sync queue)
- `deleteItem(id)` - Delete item (adds to sync queue)
- `adjustQuantity(id, delta)` - Adjust quantity by +/- amount
- `getLowStockItems()` - Get items where quantity <= minQuantity
- `getInventoryStats()` - Get totalItems, lowStockCount, totalQuantity

### Category Operations
- `getAllCategories()` - Get all categories ordered by name
- `getCategoryById(id)` - Get single category by ID
- `createCategory(name, color?)` - Create new category
- `updateCategory(id, updates)` - Update category with validation and automatic item updates
- `deleteCategory(id)` - Delete category with safety checks (prevents if in use or if last category)
- `checkCategoryInUse(name)` - Check if category is used by any items (returns { inUse, count })

### Location Operations
- `getAllLocations()` - Get all locations ordered by name
- `getLocationById(id)` - Get single location by ID
- `createLocation(name, description?)` - Create new location
- `updateLocation(id, updates)` - Update location with validation and automatic item updates
- `deleteLocation(id)` - Delete location with safety checks (prevents if in use or if last location)
- `checkLocationInUse(name)` - Check if location is used by any items (returns { inUse, count })

### Sync Queue Operations
- `getPendingSyncOperations()` - Get all pending sync operations
- `markSyncOperationComplete(id)` - Mark operation as completed
- `markSyncOperationFailed(id, error)` - Mark operation as failed with error

### Database Utilities
- `initializeDatabase()` - Initialize DB with default categories and locations (called on app startup)
- `deduplicateDatabase()` - Remove duplicate categories and locations (called after init to clean up React StrictMode race conditions)

## Common Development Tasks

### Running the App

```bash
# Navigate to project
cd medical-inventory-tracker

# Development server (hot reload on port 5173, or next available)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking and linting
npm run lint
```

### Running Tests

```bash
# Run all tests (headless)
npm test

# Run specific test file
npm test -- tests/07-inventory-page.spec.ts

# Run with single worker (prevents test interference)
npm test -- tests/07-inventory-page.spec.ts --workers=1

# Run tests with UI
npm run test:ui

# Run tests in headed mode (see browser)
npm run test:headed

# View test report
npm run test:report
```

**Important**: Some tests create items in IndexedDB. Use `--workers=1` flag when running individual test files to prevent race conditions.

### Code Formatting

```bash
# Format all files
npx prettier --write .

# Format specific file
npx prettier --write src/pages/HomePage.tsx
```

## Key Implementation Details

### Image Compression
Photos are compressed using `compressImage()` utility in `src/lib/utils/index.ts`:
- Target max dimension: 800px
- JPEG quality: 0.7
- Output: base64 data URL
- Prevents IndexedDB storage bloat

### Low Stock Detection
Items show "Low Stock" badge when `quantity <= minQuantity`:
```typescript
const isLowStock = item.minQuantity !== undefined && item.quantity <= item.minQuantity;
```

### Search Implementation
Search is case-insensitive and matches across:
- Item name
- Barcode
- Category
- Location
- Notes

### React StrictMode Handling
The app uses React 19's StrictMode which runs effects twice in development. The database initialization has been hardened against race conditions:
- Uses `categoriesCount` check instead of `settingsCount` for idempotency
- Wraps all `bulkAdd` operations in try-catch to handle duplicate key errors gracefully
- Runs `deduplicateDatabase()` after initialization to clean up any duplicates

**Related Files**:
- `src/App.tsx` (lines 14-25): Database initialization effect
- `src/lib/db/index.ts` (lines 81-170): Initialization and deduplication functions

### Form State Management
Forms use controlled components with local state:
```typescript
const [formData, setFormData] = useState({
  name: '',
  quantity: 1,
  minQuantity: 0,
  category: categories[0] || '',
  location: locations[0] || '',
  notes: '',
});
```

Number inputs handle empty strings and NaN:
```typescript
onChange={(e) => {
  const value = e.target.value === '' ? 0 : parseInt(e.target.value);
  setFormData({ ...formData, quantity: isNaN(value) ? 0 : value });
}}
```

### Mobile-First Design
- Uses Tailwind's mobile-first breakpoints
- Bottom navigation for mobile UX
- Touch-friendly button sizes (min-height: 44px)
- Optimized for 390x844 viewport (iPhone 12/13/14)

## Barcode Scanner Implementation (v0.2.0)

### Implementation Details

**Date Implemented**: 2025-01-21

The barcode scanner has been completely rewritten using **ZXing-JS** for optimal performance on mobile devices. See `docs/BARCODE_SCANNER.md` for complete technical documentation.

**Key Features:**
- ✅ Multi-format support (EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, QR Code)
- ✅ Adaptive FPS based on device capabilities (5-10 FPS)
- ✅ Smart ROI processing (40% performance improvement)
- ✅ Progressive resolution scaling (640x480 → 1280x720)
- ✅ Battery-aware optimization (reduces FPS on low battery)
- ✅ Single-read and multi-read confidence modes
- ✅ Torch/flashlight control (when supported)
- ✅ Camera switching (front/rear)
- ✅ Visual and haptic feedback
- ✅ Development debug stats overlay

**Performance Characteristics:**
- High-end devices (8+ cores): 10 FPS, ~200ms detection
- Mid-range devices (4-6 cores): 7-8 FPS, ~400ms detection
- Low-end devices (2-4 cores): 5-7 FPS, ~600ms detection
- Low battery mode (<20%): 5 FPS, ~800ms detection

**Files Modified/Created:**
- `src/components/scanner/BarcodeScanner.tsx` - Complete rewrite with ZXing-JS
- `tailwind.config.js` - Added scan-line animation keyframes
- `docs/BARCODE_SCANNER.md` - Complete implementation documentation
- `package.json` - Added @zxing/library and @zxing/browser

**Previous Implementation:**
- Quagga2 was initially installed but not fully integrated
- UI-only scanner page existed without detection capability
- Can be removed: `@ericblade/quagga2` package (optional cleanup)

**Testing:**
- Unit tests exist in `tests/10-scanner-functionality.spec.ts`
- Test fixtures available in `tests/fixtures/barcode-test-data.ts`
- Printable test barcodes in `tests/fixtures/printable-barcodes.html`
- Requires manual testing with real camera and barcodes

## Category & Location Management Implementation (v0.2.0)

### Implementation Details

**Date Implemented**: 2025-12-01

Full CRUD capabilities for managing categories and locations through the Settings page. Users are no longer stuck with the 4 hardcoded defaults for each.

**Key Features:**
- ✅ List all categories/locations with visual indicators
- ✅ Add new categories with 8 color options (Blue, Green, Orange, Red, Purple, Pink, Yellow, Gray)
- ✅ Add new locations with optional descriptions (max 200 chars)
- ✅ Edit existing categories/locations (name, color, description)
- ✅ Delete with comprehensive safety checks
- ✅ Automatic cascade updates when renaming
- ✅ Prevents deletion if in use (shows item count)
- ✅ Prevents deleting last category/location
- ✅ Success/error messages with auto-clear (3 seconds)
- ✅ Smooth modal animations (fadeIn/slideIn)

**Technical Architecture:**
- **String-based references**: Items store category/location names (not IDs) for simplicity
- **Bulk updates**: When renaming, automatically updates all affected items using Dexie's `where().modify()`
- **Validation**: Name length (1-50 chars), duplicate prevention (case-insensitive), format validation
- **Modal pattern**: Reusable component with escape key, backdrop click, body scroll prevention

**Files Created:**
- `src/components/common/Modal.tsx` (87 lines) - Reusable modal with animations
- `src/components/settings/CategoryManager.tsx` (349 lines) - Category CRUD UI
- `src/components/settings/LocationManager.tsx` (329 lines) - Location CRUD UI

**Files Modified:**
- `src/lib/db/operations.ts` - Added 8 new database operations (get, update, delete, checkInUse)
- `src/pages/SettingsPage.tsx` - Added "Organization" section with manager buttons
- `tailwind.config.js` - Added fadeIn and slideIn animations

**Database Operations Added:**
```typescript
// Category operations
getCategoryById(id: number): Promise<Category | undefined>
updateCategory(id: number, updates: { name?: string; color?: string }): Promise<void>
deleteCategory(id: number): Promise<void>
checkCategoryInUse(name: string): Promise<{ inUse: boolean; count: number }>

// Location operations
getLocationById(id: number): Promise<Location | undefined>
updateLocation(id: number, updates: { name?: string; description?: string }): Promise<void>
deleteLocation(id: number): Promise<void>
checkLocationInUse(name: string): Promise<{ inUse: boolean; count: number }>
```

**Validation Rules:**
- Category name: required, 1-50 chars, no duplicates (case-insensitive)
- Category color: hex format (#RRGGBB), 8 predefined options
- Location name: required, 1-50 chars, no duplicates (case-insensitive)
- Location description: optional, max 200 chars
- Delete: blocks if in use (shows count), blocks if last remaining item

**User Flow:**
1. Navigate to Settings → Organization
2. Tap "Manage Categories" or "Manage Locations"
3. View list of all existing items with counts
4. Add new: Fill form → Submit → Auto-reload list → Success message
5. Edit: Tap edit icon → Modify → Save → Auto-update items → Success message
6. Delete: Tap delete icon → See item count → Confirm or cancel → Success message

## Data Export Implementation (v0.2.0)

### Implementation Details

**Date Implemented**: 2025-12-02

The app now supports two export options for inventory data:
1. **CSV Export** - Lightweight data-only export for spreadsheet analysis
2. **ZIP Export with Photos** - Complete backup with all photos included

**Key Features:**
- ✅ CSV export with UTF-8 BOM for Excel compatibility
- ✅ ZIP export with folder structure (inventory.csv + photos/ directory)
- ✅ Photo filename references in CSV (pipe-separated paths)
- ✅ MIME type preservation (JPEG, PNG, GIF, WebP)
- ✅ Base64 to Blob conversion for proper image files
- ✅ Size estimation and warning for large exports (>50MB)
- ✅ Validation checks (empty inventory, no photos)
- ✅ Loading states and error handling
- ✅ Success messages with auto-clear (3 seconds)

**Technical Architecture:**

**CSV Export** (`src/lib/utils/csv.ts`):
- Uses native browser Blob API
- UTF-8 BOM (`\uFEFF`) for Excel compatibility
- RFC 4180 compliant escaping (commas, quotes, newlines)
- Timestamped filename: `medivault-inventory-YYYY-MM-DDTHH-MM-SS.csv`
- Includes: ID, Name, Barcode, Quantity, Min Quantity, Category, Location, Notes, Photo Count, Created At, Updated At
- Excludes: Photos array (too large), syncStatus/syncedAt (internal fields)

**ZIP Export** (`src/lib/utils/export.ts`):
- Uses JSZip library (3.10.1) with DEFLATE compression (level 6)
- Folder structure:
  ```
  medivault-backup-YYYY-MM-DDTHH-MM-SS.zip
  ├── inventory.csv (with photo references)
  └── photos/
      ├── item-1-photo-1.jpg
      ├── item-1-photo-2.png
      ├── item-2-photo-1.jpg
      └── ...
  ```
- Photo filenames: `item-{id}-photo-{index}.{ext}` (e.g., `item-5-photo-2.png`)
- CSV includes "Photos" column with pipe-separated paths: `photos/item-1-photo-1.jpg|photos/item-1-photo-2.jpg`
- Proper file extensions based on MIME type detection
- Memory cleanup with `URL.revokeObjectURL()`

**Files Created/Modified:**
- `src/lib/utils/export.ts` (NEW - 182 lines) - ZIP export utilities
  - `base64ToBlob()` - Converts base64 data URLs to Blob objects
  - `getExtensionFromMimeType()` - Maps MIME types to file extensions
  - `convertItemsToCSVWithPhotos()` - CSV with photo filename references
  - `exportInventoryWithPhotos()` - Creates and downloads ZIP file
  - `estimateExportSize()` - Calculates approximate ZIP size in MB
- `src/lib/utils/csv.ts` (MODIFIED) - Made `escapeCSVField()` exportable for reuse
- `src/pages/SettingsPage.tsx` (MODIFIED - +62 lines) - Added export functionality
  - Import export utilities and JSZip functions
  - Added `isExportingWithPhotos` state
  - Created `handleExportWithPhotos()` async handler
  - Added "Export with Photos" button in Data section
  - Photo validation (checks for presence of photos)
  - Size warning dialog for large exports (>50MB)
- `package.json` (MODIFIED) - Added JSZip 3.10.1 dependency

**Export Options Comparison:**

| Feature | CSV Export | ZIP Export with Photos |
|---------|------------|------------------------|
| File Size | ~5-50 KB | ~1-100+ MB (depends on photos) |
| Photos | ❌ (count only) | ✅ (full resolution) |
| Excel Compatible | ✅ | ✅ (CSV inside ZIP) |
| Restore Capability | Partial | Full |
| Use Case | Quick analysis | Complete backup |

**User Experience:**
- Settings → Data → "Export Data" for CSV only
- Settings → Data → "Export with Photos" for complete backup
- Shows error if no items to export
- Shows error if no photos exist (directs to use CSV export)
- Shows size warning dialog if ZIP >50MB with option to cancel
- Loading spinner during export process
- Success message on completion

## Data Import Implementation (v0.3.0)

### Implementation Details

**Date Implemented**: 2025-12-03

The app now supports importing inventory data from CSV and ZIP files, completing the full backup and restore cycle.

**Key Features:**
- ✅ CSV import (data only) with RFC 4180 compliant parsing
- ✅ ZIP import with photo restoration
- ✅ Three duplicate handling strategies (skip, overwrite, rename)
- ✅ Auto-create missing categories/locations
- ✅ ID preservation option
- ✅ Transaction-based import with atomic rollback on errors
- ✅ Real-time progress tracking with 5-phase updates
- ✅ Comprehensive validation (structure, data, duplicates)
- ✅ ARIA-compliant modal with multi-step wizard UI
- ✅ Photo MIME type preservation during restoration
- ✅ Detailed results summary with statistics

**Technical Architecture:**

**CSV Parser** (`src/lib/utils/csvParser.ts` - 500+ lines):
- RFC 4180 compliant parsing with quoted field support
- UTF-8 BOM detection and removal
- Multiple line ending support (CRLF, LF, CR)
- Header validation (CSV and ZIP format detection)
- Per-row data validation with line number tracking
- Duplicate detection (by ID, name, barcode)
- Missing category/location detection
- Types: `ParsedCSVData`, `ValidationResult`, `ImportValidation`, `DuplicateInfo`

**Import Utilities** (`src/lib/utils/import.ts` - 600+ lines):
- `importInventoryFromCSV()` - Import from CSV with progress tracking
- `importInventoryFromZIP()` - Extract CSV and photos, restore with progress
- `autoImport()` - Auto-detect file type and route to appropriate importer
- `extractCSVFromZIP()` - Extract inventory.csv from ZIP archive
- `extractPhotosFromZIP()` - Extract and convert photos to base64
- `validateZIPStructure()` - Ensure required files exist
- Progress tracking: Parsing (0-15%) → Validating (15-30%) → Photos (30-70%) → Importing (70-100%)

**Database Operations** (`src/lib/db/operations.ts` - +340 lines):
- `importItems()` - Transaction-based import with rollback
- `checkItemExists()` - Multi-strategy duplicate detection
- `generateUniqueItemName()` - Smart rename with counter (e.g., "Aspirin (2)")
- `bulkCreateCategories()` - Create missing categories in batch
- `bulkCreateLocations()` - Create missing locations in batch
- Types: `ImportOptions`, `ImportResult`

**Import Modal** (`src/components/settings/ImportModal.tsx` - 550+ lines):
- Multi-step wizard: File Selection → Options → Progress → Results
- ARIA compliance: `role="dialog"`, `aria-busy`, `aria-live` regions
- Focus management and keyboard navigation (Tab, Escape)
- Real-time progress with animated progress bar
- Detailed results with statistics grid
- Error and warning displays with context

**Files Created:**
- `src/lib/utils/csvParser.ts` (NEW - 520 lines) - CSV parsing and validation
- `src/lib/utils/import.ts` (NEW - 620 lines) - ZIP extraction and import orchestration
- `src/components/settings/ImportModal.tsx` (NEW - 550 lines) - Import UI with ARIA compliance

**Files Modified:**
- `src/lib/db/operations.ts` (+340 lines) - Added import database operations
- `src/pages/SettingsPage.tsx` (+15 lines) - Added import button and modal integration

**Import Options:**

```typescript
interface ImportOptions {
  duplicateStrategy: 'skip' | 'overwrite' | 'rename';  // How to handle existing items
  createMissingCategories: boolean;                     // Auto-create new categories
  createMissingLocations: boolean;                      // Auto-create new locations
  preserveIds: boolean;                                 // Try to keep original IDs
  onProgress?: (progress: ImportProgress) => void;      // Real-time progress callback
}
```

**Duplicate Strategies:**
1. **Skip**: Don't import items that already exist (default, safest)
2. **Overwrite**: Replace existing items with imported data
3. **Rename**: Create new items with unique names (e.g., "Aspirin" → "Aspirin (2)")

**Import Process:**
1. **File Selection**: Accept CSV or ZIP, validate file type
2. **Options Configuration**: Choose duplicate strategy, category/location creation
3. **Parsing (0-15%)**: Extract CSV, parse headers and rows
4. **Validation (15-30%)**: Validate structure, data types, required fields
5. **Photo Extraction (30-70%)**: Extract photos from ZIP, convert to base64
6. **Importing (70-100%)**: Transaction-based database import with rollback
7. **Results**: Display statistics, warnings, errors

**Edge Cases Handled:**
- Empty files, corrupted ZIPs, missing inventory.csv
- Invalid CSV structure, inconsistent column counts
- Missing required fields (name, quantity, category, location)
- Invalid data types (non-numeric quantities, invalid dates)
- Missing categories/locations (error or auto-create based on options)
- Duplicate items (skip, overwrite, or rename based on strategy)
- ID conflicts when preserving IDs
- Missing photos referenced in CSV
- Corrupted photo files, invalid MIME types
- Transaction failures with automatic rollback
- Browser storage quota exceeded
- Large file handling (progress updates prevent UI freezing)

**User Experience:**
- Settings → Data → "Import Data"
- Step 1: Drag & drop or click to select CSV/ZIP file
- Step 2: Configure import options with radio buttons and checkboxes
- Step 3: Real-time progress with phase labels and percentage
- Step 4: Results summary with statistics grid, warnings, and errors
- Success: Green checkmark, import statistics, duration
- Failure: Red alert, error details, option to retry

**Import vs Export Comparison:**

| Feature | CSV Export | ZIP Export | CSV Import | ZIP Import |
|---------|------------|------------|------------|------------|
| File Size | ~5-50 KB | ~1-100+ MB | Any | Any |
| Photos | ❌ Count only | ✅ Full resolution | ❌ | ✅ Restored |
| Duplicates | N/A | N/A | 3 strategies | 3 strategies |
| Categories/Locations | N/A | N/A | Auto-create option | Auto-create option |
| Validation | N/A | N/A | Comprehensive | Comprehensive |
| Progress Tracking | ❌ | ❌ | ✅ 5 phases | ✅ 5 phases |
| Transaction Safety | N/A | N/A | ✅ Rollback | ✅ Rollback |
| Use Case | Quick analysis | Complete backup | Data restore | Full restore |

**Testing Notes:**
- Import feature requires E2E tests with test CSV/ZIP files
- Test fixtures should include: valid files, invalid files, duplicates, missing fields
- Suggested test file: Export existing data, modify CSV, re-import to verify
- Manual testing recommended before merging to production

## Recent Issues and Fixes

### Issue: React Duplicate Key Warnings (FIXED)
**Date**: 2025-11-19
**Symptoms**: Console showed "Encountered two children with the same key" errors for categories and locations on Add Item page.

**Root Cause**: React StrictMode runs effects twice, causing `initializeDatabase()` to run concurrently and create duplicate entries.

**Fix Applied**:
1. Changed initialization check from `settingsCount` to `categoriesCount` (more reliable)
2. Added try-catch blocks around all `bulkAdd` operations to ignore duplicate key errors
3. Separated initialization checks for categories, locations, and settings
4. Created `deduplicateDatabase()` utility to clean up existing duplicates
5. Integrated deduplication into App startup sequence

**Files Modified**:
- `src/lib/db/index.ts` (lines 81-170)
- `src/App.tsx` (lines 7, 16)
- `src/pages/AddItemPage.tsx` (lines 165-204) - Changed conditional rendering to ternary operators

**Status**: Fixed and tested. No more duplicate key warnings.

## Known Issues

1. **Node.js Version Warning**: Vite requires Node.js 20.19+ or 22.12+, but works with 20.15.1 despite warning
2. **Camera Capture**: Requires HTTPS in production due to browser security
3. **IndexedDB Storage Limits**: Browsers typically allow 50-100MB per origin
4. **Many Background Bash Processes**: Multiple dev servers and test runners may be running from previous sessions (check with `/bashes` command)

## Features Status

### ✅ Implemented (v0.3.0)
- Mobile-first responsive UI
- Offline-first IndexedDB storage
- **Full Item CRUD operations** (create, read, update, delete)
- **Item detail view** with edit mode and delete functionality
  - View all item details (photos, barcode, quantity, category, location, notes)
  - Edit mode with full form (all fields editable)
  - Delete with confirmation dialog
  - Quick quantity adjustment (+/- buttons)
  - Photo management (add/remove photos)
- Photo upload with compression
- **Barcode scanner with ZXing-JS** (fully functional with:
  - Multi-format support (EAN, UPC, Code 128/39, QR)
  - Adaptive FPS based on device capabilities
  - Battery-aware optimization
  - Torch/flashlight control
  - Camera switching
  - Smart ROI processing)
- **Category management UI** (full CRUD with 8-color palette)
  - Add, edit, delete categories
  - Color selection for visual organization
  - Automatic item updates when renaming
  - Safety checks (prevents deletion if in use or if last category)
- **Location management UI** (full CRUD with descriptions)
  - Add, edit, delete locations
  - Optional description field
  - Automatic item updates when renaming
  - Safety checks (prevents deletion if in use or if last location)
- Low stock alerts with visual badges
- Search functionality across all fields
- Empty state messaging
- Form validation
- Relative timestamps (date-fns)
- **Reusable modal component** with animations
- **Data export functionality** (CSV and ZIP with photos)
  - CSV export with UTF-8 BOM for Excel compatibility
  - ZIP export with photo backup
  - Size estimation and warnings
  - Photo MIME type preservation
- **Data import functionality** (CSV and ZIP with photos) ✨ NEW in v0.3.0
  - CSV import with RFC 4180 compliance
  - ZIP import with photo restoration
  - Three duplicate handling strategies (skip, overwrite, rename)
  - Auto-create missing categories/locations
  - Transaction-based with rollback
  - Real-time progress tracking
  - ARIA-compliant wizard UI
  - Comprehensive validation and error handling

### 🚧 Partially Implemented
- Settings page (Organization, export, and import complete; sync pending)
- Sync queue (database schema ready, sync engine pending)

### ❌ Not Implemented
- Google Sheets OAuth flow
- Google Sheets sync engine
- PWA configuration (service worker)
- Offline support (currently requires network)
- Clear all data functionality
- Low stock notifications (push notifications)
- Bulk operations (multi-select and bulk edit/delete)
- Advanced filtering (by category, location, stock level)
- Item history/audit log
- Expiration date tracking
- Lot/batch number tracking
- Multi-user support

## Environment Variables

The app is configured to use environment variables for future features (Google Sheets sync):

```env
# .env file (not yet created)
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your-api-key
VITE_APP_NAME=Medical Inventory Tracker
```

Currently not required for development as sync features are not implemented.

## Testing Strategy

### Test Coverage
- Navigation between pages
- Add item form (all fields, validation, photo upload)
- Search functionality
- Mobile responsiveness (390x844 viewport)
- Visual consistency (card styling, colors, spacing)
- Empty states
- Low stock indicators

### Test Helpers
All test files include helper functions like:
```typescript
async function addItem(page: Page, itemData: {
  name: string;
  quantity: number;
  minQuantity?: number;
  category?: string;
  location?: string;
}) {
  // Navigate to add page, fill form, submit
}
```

### Screenshot Testing
Tests capture screenshots in `tests/screenshots/` directory for visual regression testing.

## Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### GitHub Pages
1. Update `vite.config.ts` base path
2. Run `npm run build`
3. Deploy `dist/` folder

### Railway/Other Platforms
Standard static site deployment:
- Build command: `npm run build`
- Output directory: `dist`
- Node version: 20.19+ or 22.12+

## Development Best Practices

1. **Always read files before editing** - Use Read tool to see current code
2. **Run tests after changes** - Use `npm test` or specific test files
3. **Check for background processes** - Multiple dev servers may be running
4. **Use `--workers=1` for test isolation** - Prevents test interference
5. **Preserve mobile-first design** - Test responsive behavior
6. **Handle empty states gracefully** - Check for zero items/categories/locations
7. **Use controlled form components** - Maintain single source of truth
8. **Compress images before storage** - Use `compressImage()` utility
9. **Add to sync queue on mutations** - All create/update/delete operations should queue sync
10. **Handle React StrictMode** - Expect effects to run twice in development

## Session Continuity

When starting a new session:
1. Check for running background processes (`/bashes`)
2. Review recent git commits for context
3. Check `tests/screenshots/` for visual state
4. Review database schema in `src/lib/db/index.ts`
5. Check README.md roadmap for feature status

## Contact & Resources

- **Project README**: `README.md`
- **Package Info**: `package.json`
- **Test Results**: Run `npm run test:report`
- **Vite Docs**: https://vite.dev
- **Dexie Docs**: https://dexie.org
- **Playwright Docs**: https://playwright.dev
- **Tailwind Docs**: https://tailwindcss.com

---

**Last Updated**: 2025-12-03 (Added Data Import with Photos feature - v0.3.0)
**Claude Version**: This file is maintained for Claude Code sessions to provide context and continuity.
