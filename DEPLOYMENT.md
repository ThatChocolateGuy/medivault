# Deployment Guide

## Prerequisites

- Git repository (already initialized)
- Vercel account (https://vercel.com)
- Node.js 20.19+ or 22.12+ (optional, Vercel uses its own)

## Quick Deploy to Vercel

### Option 1: Vercel CLI (Recommended)

1. Install Vercel CLI globally:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy from the project directory:
```bash
cd medical-inventory-tracker
vercel
```

4. Follow the prompts:
   - **Set up and deploy**: Yes
   - **Which scope**: Select your account
   - **Link to existing project**: No
   - **Project name**: medical-inventory-tracker (or your choice)
   - **Directory**: ./ (current directory)
   - **Override settings**: No

5. Your app will be deployed! Vercel will provide a production URL.

### Option 2: Vercel Dashboard (Easy)

1. Push your code to GitHub:
```bash
git remote add origin https://github.com/YOUR_USERNAME/medical-inventory-tracker.git
git push -u origin main
```

2. Go to https://vercel.com/new

3. Import your GitHub repository

4. Configure project:
   - **Framework Preset**: Vite
   - **Root Directory**: ./
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

5. Click "Deploy"

## Post-Deployment

### 1. Test the PWA

- Visit your deployed URL
- Open DevTools → Application → Service Workers
- Verify service worker is registered
- Test offline functionality:
  - Add some items
  - Go offline (DevTools → Network → Offline)
  - App should still work

### 2. Install as PWA

On mobile (Chrome/Edge):
- Visit the site
- Tap the "Add to Home Screen" prompt
- Or: Menu → "Add to Home Screen" / "Install App"

On desktop (Chrome/Edge):
- Visit the site
- Click the install icon in the address bar
- Or: Menu → "Install Medical Inventory Tracker"

### 3. Test Barcode Scanning

**Important**: Barcode scanning requires HTTPS, which Vercel provides automatically.

- Navigate to the Scan tab
- Click "Start Scanning"
- Allow camera permissions
- Scan a barcode (try product barcodes from around your house)

### 4. Add PWA Icons (Optional)

Generate proper app icons:

1. Create a 512x512px icon (PNG)
2. Use https://www.pwabuilder.com/imageGenerator to generate all sizes
3. Download the generated icons
4. Place them in the `public/` directory:
   - `pwa-192x192.png`
   - `pwa-512x512.png`
   - `apple-touch-icon.png`
   - `favicon.ico`
5. Commit and redeploy:
```bash
git add public/
git commit -m "Add PWA icons"
git push
```

## Environment Variables

Currently, the app doesn't require any environment variables. If you implement Google Sheets sync later, you'll need to add:

```
VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_GOOGLE_API_KEY=your-api-key
```

Add these in:
- Vercel Dashboard → Project → Settings → Environment Variables

## Continuous Deployment

Vercel automatically:
- Deploys on every push to `main` branch
- Creates preview deployments for pull requests
- Builds with production optimizations
- Enables HTTPS automatically
- Provides global CDN

## Troubleshooting

### Build Fails

```bash
# Test build locally first
npm run build

# Check for TypeScript errors
npm run lint
```

### Camera Not Working

- Ensure you're using HTTPS (Vercel provides this)
- Check browser camera permissions
- Try on a different device/browser
- Camera API requires user gesture (button click)

### Service Worker Not Registering

- Clear browser cache
- Check DevTools Console for errors
- Verify HTTPS is being used
- Try in incognito/private mode

### App Not Working Offline

- Verify service worker is registered
- Check Application → Service Workers in DevTools
- Try visiting a page first (to cache it)
- Check Network tab to see cached responses

## Performance

Current bundle sizes (production):
- Main JS: ~466KB (144KB gzipped)
- CSS: ~17KB (4KB gzipped)
- Total first load: ~148KB gzipped

Performance optimizations already applied:
- Code splitting
- Tree shaking
- Minification
- Gzip compression
- Service worker caching
- Lazy loading of routes

## Monitoring

Use Vercel Analytics (optional, paid feature):
1. Enable in Vercel Dashboard
2. Get insights on:
   - Page views
   - Performance metrics
   - Error tracking
   - User location

## Custom Domain (Optional)

1. Go to Vercel Dashboard → Project → Settings → Domains
2. Add your custom domain
3. Configure DNS records as shown
4. SSL certificate is automatic

## Need Help?

- Vercel Docs: https://vercel.com/docs
- Vite Docs: https://vitejs.dev
- PWA Docs: https://vite-pwa-org.netlify.app/

Happy deploying! 🚀
