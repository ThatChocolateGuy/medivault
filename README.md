# MediVault

A modern, mobile-first medical inventory management app with barcode scanning, offline support, and planned cloud sync. Built with React 19, TypeScript, and ZXing-JS.

## Features

### Current (v0.2.0 - MVP with Scanning)
- ✅ **Mobile-first UI** - Optimized for touch and small screens
- ✅ **Offline-first storage** - IndexedDB with Dexie.js
- ✅ **Item management** - Create, view, search inventory items
- ✅ **Barcode scanning** - ZXing-JS with adaptive performance optimization
- ✅ **Photo upload** - Capture and compress item photos
- ✅ **Categories & locations** - Organize items efficiently
- ✅ **Low stock alerts** - Visual indicators for low quantity items
- ✅ **Search functionality** - Quick item lookup
- ✅ **Responsive design** - Works on any device

### Coming Soon
- 🔲 Google Sheets sync for cloud backup
- 🔲 PWA support for offline usage
- 🔲 Export/import data (CSV)
- 🔲 Item detail view with history
- 🔲 Bulk operations
- 🔲 Advanced filtering

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Styling**: Tailwind CSS 3
- **Build Tool**: Vite 7
- **Database**: IndexedDB (via Dexie.js)
- **Barcode Scanning**: ZXing-JS (@zxing/library + @zxing/browser)
- **Icons**: Lucide React
- **Package Manager**: npm (or bun)

## Getting Started

### Prerequisites

- Node.js 20.19+ or 22.12+ (20.15.1 works but shows warnings)
- npm or bun

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd medivault
```

2. Install dependencies:
```bash
npm install
# or
bun install
```

3. Start the development server:
```bash
npm run dev
# or
bun run dev
```

4. Open http://localhost:5173 in your browser

### Build for Production

```bash
npm run build
npm run preview  # Preview production build locally
```

## Project Structure

```
src/
├── components/
│   ├── layout/          # Header, BottomNav, Layout
│   ├── items/           # ItemCard, ItemList components
│   ├── scanner/         # Barcode scanner (ZXing-JS)
│   ├── photos/          # Photo upload components
│   └── common/          # Reusable UI components (Button, Input, etc.)
├── lib/
│   ├── db/              # IndexedDB schema and operations (Dexie.js)
│   ├── sync/            # Google Sheets sync (coming soon)
│   ├── auth/            # OAuth flow (coming soon)
│   └── utils/           # Helper functions
├── pages/               # Page components (Home, Add, Settings, Scanner)
├── App.tsx              # Main app router
└── main.tsx             # React entry point
```

## Usage

### Adding Items

1. Tap the "Add" button in the bottom navigation
2. Fill in item details (name, quantity, category, location)
3. Optionally add photos using the camera button
4. Tap "Add Item" to save

### Searching Items

- Use the search bar on the home screen
- Search works across item names, barcodes, categories, locations, and notes

### Low Stock Alerts

- Set a "Min Quantity" when adding/editing items
- Items below minimum show a red alert icon
- Low stock count appears in the notifications badge

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Code Formatting

The project uses Prettier for code formatting:

```bash
npx prettier --write .
```

## Deployment

### Vercel (Recommended)

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
vercel
```

### GitHub Pages

1. Update `vite.config.ts` to set the base path
2. Build the project: `npm run build`
3. Deploy the `dist` folder to GitHub Pages

## Environment Variables

Create a `.env` file in the root directory (see `.env.example`):

```env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your-api-key
VITE_APP_NAME=MediVault
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Roadmap

### Phase 1: Core Features ✅ Complete
- ✅ Basic CRUD operations
- ✅ Mobile-first UI
- ✅ Search and filtering
- ✅ Photo upload
- ✅ Barcode/QR scanning (ZXing-JS)

### Phase 2: Sync & Cloud (Current)
- 🔲 Item detail view and editing
- 🔲 Google Sheets OAuth
- 🔲 Two-way sync engine
- 🔲 Offline queue

### Phase 3: PWA & Polish
- 🔲 Service worker
- 🔲 Offline support
- 🔲 Push notifications
- 🔲 Install prompt

### Phase 4: Advanced Features
- 🔲 Multi-user support
- 🔲 Expiration date tracking
- 🔲 Lot/batch numbers
- 🔲 Advanced analytics

## Known Issues

- Node.js version warning (works with 20.15.1 despite warning)
- Camera capture requires HTTPS in production
- IndexedDB has browser storage limits (typically ~50-100MB)

## Acknowledgments

Built with inspiration from Sortly and other modern inventory management tools.
