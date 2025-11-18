# PWA Icons

To generate PWA icons for production, you need to create the following files in the `public/` directory:

- `pwa-192x192.png` - 192x192px icon
- `pwa-512x512.png` - 512x512px icon
- `apple-touch-icon.png` - 180x180px icon for iOS
- `favicon.ico` - Standard favicon

## Quick Generation

You can use online tools to generate these from a single source image:

1. **PWA Asset Generator**: https://www.pwabuilder.com/imageGenerator
2. **RealFaviconGenerator**: https://realfavicongenerator.net/
3. **Favicon.io**: https://favicon.io/

## Design Recommendations

- Use a simple, recognizable icon
- Ensure it works well on both light and dark backgrounds
- Keep it clean and minimal for small sizes
- Medical/health-related icon (cross, pill, stethoscope, etc.)
- Brand color: #2563eb (Primary Blue)

## Development

For development, the app will work without these icons, but you'll see console warnings. The PWA will still function with offline support.
