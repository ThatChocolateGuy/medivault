# Google Workspace Sync

MediVault supports two-way synchronization with Google Workspace (Google Sheets and Google Drive) for cross-device data sync.

## Features

- **Google OAuth 2.0 with PKCE**: Secure authentication without exposing secrets
- **Google Sheets Sync**: Structured data (items, categories, locations) stored in a spreadsheet
- **Google Drive Sync**: Photos stored in a dedicated folder structure
- **Offline Support**: Queue changes locally and sync when online
- **Conflict Resolution**: Last-write-wins strategy with merge option
- **Background Sync**: Automatic periodic sync with configurable intervals

## Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Google Sheets API
   - Google Drive API

### 2. Configure OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. Select **External** user type
3. Fill in app information:
   - App name: MediVault
   - User support email: your email
   - Developer contact: your email
4. Add scopes:
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive.file`
5. Add test users if in testing mode

### 3. Create OAuth Client ID

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Application type: **Web application**
4. Name: MediVault Web Client
5. Authorized JavaScript origins:
   - `http://localhost:5173` (development)
   - `https://your-domain.com` (production)
6. Authorized redirect URIs:
   - `http://localhost:5173/auth/callback` (development)
   - `https://your-domain.com/auth/callback` (production)
7. Copy the Client ID

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

## Usage

### Initial Sync

1. Go to **Settings > Sync**
2. Click **Connect Google Account**
3. Authorize MediVault to access your Google account
4. Choose sync direction:
   - **Upload to Cloud**: Send device data to Google Sheets
   - **Download from Cloud**: Get data from existing spreadsheet
   - **Merge Both**: Combine data from both sources (recommended)

### Ongoing Sync

- Automatic background sync every 5 minutes when signed in
- Manual sync available via **Sync Now** button
- Offline changes are queued and synced when online

### View Spreadsheet

Click **View Spreadsheet** to open your data in Google Sheets.

### Disconnect

Click **Disconnect Google Account** to stop syncing. Local data is preserved.

## Data Structure

### Google Sheets

The sync creates a spreadsheet named "MediVault Inventory" with these sheets:

| Sheet | Purpose |
|-------|---------|
| Items | Inventory items with all fields |
| Categories | Category definitions with colors |
| Locations | Location definitions with descriptions |
| Metadata | Sync timestamps and device info |

### Google Drive

Photos are stored in a folder structure:

```
My Drive/
└── MediVault/
    └── Photos/
        ├── item-1-photo-1.jpg
        ├── item-1-photo-2.png
        └── item-2-photo-1.jpg
```

## Conflict Resolution

When the same item is modified on multiple devices:

1. **Last-write-wins** (default): Most recent change takes precedence
2. **Merge**: During initial sync, data from both sources is combined

Conflicts are detected by comparing `updatedAt` timestamps.

## Security

- OAuth tokens stored in browser localStorage
- PKCE (Proof Key for Code Exchange) used for secure token exchange
- Tokens automatically refreshed when expired
- Revoke access anytime via Settings

## Limitations

- Requires Google account
- Subject to Google API quotas
- Photos limited by Google Drive storage quota
- First-party app requires OAuth consent screen approval for public use

## Troubleshooting

### "Google Client ID not configured"

Ensure `VITE_GOOGLE_CLIENT_ID` is set in your `.env` file and rebuild the app.

### "OAuth state not found"

The authentication flow was interrupted. Try connecting again.

### "Permission denied"

Ensure you've granted all required permissions during OAuth consent.

### "Spreadsheet not found"

The sync spreadsheet may have been deleted. Disconnect and reconnect to create a new one.

## API Reference

### OAuth Functions

```typescript
import { initiateOAuthFlow, revokeGoogleAccess, isSignedIn } from './lib/google';

// Start OAuth flow (redirects to Google)
await initiateOAuthFlow();

// Check if signed in
const signedIn = isSignedIn();

// Sign out and revoke access
await revokeGoogleAccess();
```

### Sync Functions

```typescript
import { performInitialSync, performIncrementalSync, syncManager } from './lib/google';

// Initial sync with direction
await performInitialSync({
  direction: 'merge', // 'deviceToCloud' | 'cloudToDevice' | 'merge'
});

// Manual incremental sync
await performIncrementalSync();

// Start background sync
syncManager.start({
  onStatusChange: (status) => console.log(status),
});

// Stop background sync
syncManager.stop();
```

### Sync State

```typescript
import { getSyncState, type SyncState } from './lib/google';

const state: SyncState = await getSyncState();
// {
//   status: 'idle' | 'syncing' | 'success' | 'error' | 'offline',
//   lastSyncAt: Date | undefined,
//   spreadsheetInfo: { spreadsheetId, spreadsheetUrl } | undefined,
//   isOnline: boolean,
//   pendingChanges: number,
// }
```
