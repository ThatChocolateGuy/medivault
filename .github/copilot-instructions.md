# Copilot Instructions for MediVault

This file provides guidance to GitHub Copilot when working with the MediVault codebase.

## Project Overview

**MediVault** is a modern, mobile-first medical inventory management app with barcode scanning, offline support, and planned cloud sync. It's built with React 19, TypeScript, ZXing-JS for barcode scanning, and uses IndexedDB for local-first data storage.

**Current Status**: MVP Phase (v0.2.0) - Core CRUD operations complete, optimized barcode scanning fully implemented with ZXing-JS, import/export features complete, sync features in development.

## Tech Stack

- **Frontend Framework**: React 19 + TypeScript 5.9
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 3.4 with custom utility classes
- **Database**: IndexedDB via Dexie.js 4.2 (offline-first storage)
- **Icons**: Lucide React
- **Date Utilities**: date-fns
- **State Management**: React Query (TanStack Query)
- **Barcode Scanning**: ZXing-JS (@zxing/library + @zxing/browser) - Primary scanning library
- **File Export/Import**: JSZip for ZIP operations
- **Testing**: Playwright (E2E tests)
- **Linting**: ESLint with TypeScript ESLint
- **Code Formatting**: Prettier

## Project Structure

```
src/
├── components/
│   ├── common/          # Reusable UI components (Button, Input, Modal, ConfirmDialog, etc.)
│   ├── items/           # Inventory item components (ItemCard)
│   ├── layout/          # Header, BottomNav, Layout
│   ├── scanner/         # Barcode scanner (ZXing-JS)
│   └── settings/        # CategoryManager, LocationManager
├── lib/
│   ├── db/              # IndexedDB schema and CRUD operations (Dexie.js)
│   └── utils/           # Helper functions (image compression, CSV, import/export)
├── pages/               # Page components (Home, Add, Settings, Scanner)
├── App.tsx              # Main app with page routing
└── main.tsx             # React entry point

tests/                   # Playwright E2E tests
docs/                    # Additional documentation
```

## Development Commands

```bash
# Development server (hot reload)
npm run dev

# Build for production
npm run build

# Type checking and linting
npm run lint

# Run all tests (headless)
npm test

# Run specific test file (use --workers=1 to prevent race conditions)
npm test -- tests/<test-file>.spec.ts --workers=1

# Format code
npx prettier --write .
```

## Coding Conventions

### TypeScript
- Use TypeScript for all new code
- Prefer interfaces over types for object shapes
- Use explicit return types for functions
- Handle null/undefined with optional chaining and nullish coalescing

### React
- Use functional components with hooks
- Use controlled form components with local state
- Handle React StrictMode (effects run twice in development)
- Use React Query for async data fetching

### Styling
- Use Tailwind CSS utility classes
- Follow mobile-first design (start with mobile styles, add responsive breakpoints)
- Touch-friendly button sizes (min-height: 44px)
- Optimized for 390x844 viewport (iPhone 12/13/14)

### Database Operations
- All database operations are in `src/lib/db/operations.ts`
- Use Dexie.js transactions for atomic operations
- Add operations to sync queue for future Google Sheets sync
- Handle duplicate key errors gracefully (for React StrictMode)
- Use `clearAllData()` to clear items while preserving categories/locations

### Error Handling
- Wrap async operations in try-catch
- Display user-friendly error messages
- Log errors to console for debugging

## Key Files

- `src/lib/db/index.ts` - Database schema and initialization
- `src/lib/db/operations.ts` - All CRUD operations
- `src/lib/utils/index.ts` - Helper functions (image compression)
- `src/lib/utils/csv.ts` - CSV export utilities
- `src/lib/utils/csvParser.ts` - CSV import parsing
- `src/lib/utils/import.ts` - ZIP import utilities
- `src/lib/utils/export.ts` - ZIP export utilities
- `src/components/scanner/BarcodeScanner.tsx` - Barcode scanner with ZXing-JS
- `src/components/common/ConfirmDialog.tsx` - ARIA-compliant confirmation dialog
- `docs/BARCODE_SCANNER.md` - Barcode scanner documentation

## Database Schema

The app uses IndexedDB via Dexie.js with these tables:

- **items** - Inventory items (name, barcode, quantity, minQuantity, category, location, notes, photos)
- **categories** - Categories with color coding
- **locations** - Storage locations with descriptions
- **syncQueue** - Pending sync operations for Google Sheets
- **settings** - App settings (sync config, notifications)

## Testing

- Tests use Playwright for E2E testing
- Test files are in `tests/` directory
- Use `--workers=1` flag to prevent test interference
- Screenshots captured in `tests/screenshots/` for visual regression

## Additional Documentation

- `CLAUDE.md` - Comprehensive development guide (detailed implementation notes)
- `README.md` - Project overview and usage
- `docs/BARCODE_SCANNER.md` - Barcode scanner implementation details
- `DEPLOYMENT.md` - Deployment instructions

## Best Practices for Issues

When creating issues for Copilot to work on:

1. **Be specific** - Include exact file paths and line numbers when possible
2. **Define acceptance criteria** - What should the solution achieve?
3. **Scope appropriately** - Focus on single, well-defined changes
4. **Reference existing code** - Point to similar implementations in the codebase
5. **Include test requirements** - Specify if tests should be added or updated

### Good Task Types for Copilot
- Bug fixes with clear reproduction steps
- Adding tests for existing functionality
- Documentation updates
- Small refactors with clear scope
- Accessibility improvements
- Style/UI tweaks with specific requirements
- Adding new utility functions

### Tasks to Avoid for Copilot
- Major architectural changes
- Complex business logic requiring deep domain knowledge
- Security-sensitive features (OAuth, API keys)
- Performance optimization without clear metrics
