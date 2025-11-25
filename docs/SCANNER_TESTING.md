# Barcode Scanner Testing Guide

## HTTPS Requirement

⚠️ **Important:** The barcode scanner requires HTTPS to access the camera API (browser security requirement).

## Testing Methods

### Method 1: ngrok (Recommended for Mobile Testing)

**Pros:**
- ✅ Automatic HTTPS
- ✅ Test on any device (phone, tablet)
- ✅ No certificate warnings
- ✅ Share with others for testing

**Steps:**

1. **Start the dev server:**
   ```bash
   cd medical-inventory-tracker
   npm run dev
   ```

2. **In a new terminal, start ngrok:**
   ```bash
   ngrok http 5173
   ```

3. **Access the HTTPS URL from ngrok output:**
   ```
   Forwarding  https://abc123.ngrok-free.app -> http://localhost:5173
   ```

4. **Open the HTTPS URL on your phone/device**
   - Navigate to the Scanner page
   - Grant camera permissions when prompted
   - Test with real barcodes!

**Tip:** The ngrok URL changes each time you restart it. For a permanent URL, upgrade to ngrok Pro.

### Method 2: localhost with HTTPS

**Pros:**
- ✅ Works on same machine
- ✅ Fast testing cycle

**Cons:**
- ⚠️ Self-signed certificate warnings
- ⚠️ Can't test on mobile devices easily

**Steps:**

1. **Enable HTTPS in vite.config.ts:**
   ```typescript
   server: {
     https: true, // Change from false to true
     host: true,
   }
   ```

2. **Start the dev server:**
   ```bash
   npm run dev
   ```

3. **Access via https://localhost:5173**
   - Your browser will show a certificate warning
   - Click "Advanced" → "Proceed anyway" (safe for localhost)
   - Grant camera permissions
   - Test the scanner

### Method 3: Network Access (HTTP - localhost exception)

**Only works if:**
- Accessing from the same machine as the dev server
- Using `localhost` or `127.0.0.1` (NOT your local IP)

**Steps:**

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Access via http://localhost:5173**
   - Modern browsers allow camera access on localhost even without HTTPS
   - This won't work if you access via `http://192.168.1.x:5173`

## Troubleshooting

### Error: "Failed to access camera"

**Possible causes:**
1. ❌ Not using HTTPS (most common)
2. ❌ Camera permissions denied
3. ❌ Camera in use by another app
4. ❌ Browser doesn't support MediaDevices API

**Solutions:**
1. Use ngrok or enable HTTPS in Vite config
2. Check browser permissions (look for camera icon in address bar)
3. Close other apps using camera (Zoom, Skype, etc.)
4. Try a different browser (Chrome/Edge recommended)

### Permission Denied

1. **Check browser settings:**
   - Chrome: Settings → Privacy and Security → Site Settings → Camera
   - Make sure your site is allowed

2. **Reset permissions:**
   - Click the lock icon in address bar
   - Reset permissions for Camera
   - Refresh page and try again

3. **Clear browser data:**
   - Sometimes cached permissions cause issues
   - Clear site data and try again

### Camera Not Found

1. **Check hardware:**
   - Does your device have a camera?
   - Is the camera enabled in device settings?

2. **Try different browser:**
   - Safari on iOS can be finicky
   - Try Chrome or Firefox

### Scanner Not Detecting Barcodes

1. **Check lighting:**
   - Ensure barcode is well-lit
   - Use flashlight button if available

2. **Hold steady:**
   - Keep camera 6-10 inches from barcode
   - Hold steady for 1-2 seconds

3. **Check barcode quality:**
   - Damaged barcodes may take longer
   - Try with multiple barcodes to verify

4. **Check debug stats (development mode):**
   - Stats overlay shows FPS, resolution, battery
   - Low FPS? Device may be too slow
   - Try reducing quality in BarcodeScanner.tsx

## Test Barcodes

### Use Real Products

Best way to test is with products around your home:
- Food packages (UPC/EAN)
- Medication bottles (often Code 128)
- Shipping boxes (Code 39/128)

### Print Test Barcodes

Use the test fixture:
```bash
# Open in browser
start tests/fixtures/printable-barcodes.html
```

Print the page and test with various barcode formats.

### Online Barcode Generator

Generate custom barcodes:
- https://barcode.tec-it.com/en
- https://www.barcodesinc.com/generator/

## Performance Testing

### Check Scanner Performance

1. **Open developer console** (F12)
2. **Look for logs:**
   ```
   ✅ ZXing scanner initialized
   📱 Detected: 1234567890123 (confidence: 0.85)
   ✅ Confirmed: 1234567890123
   ```

3. **Check debug overlay** (development mode only)
   - Top-left corner shows stats
   - FPS should be 5-10
   - Resolution should match device capabilities

### Measure Detection Speed

Time from pointing camera to detection:
- **Target:** < 1 second for clear barcodes
- **Acceptable:** 1-2 seconds
- **Slow:** > 2 seconds (may need optimization)

If consistently slow:
1. Check device capabilities (CPU cores, battery)
2. Ensure good lighting
3. Try different barcode types
4. Review BarcodeScanner.tsx optimization settings

## Browser Compatibility

### Tested Browsers

✅ **Chrome/Edge (Desktop & Mobile)** - Best performance
✅ **Firefox (Desktop & Mobile)** - Good performance
✅ **Safari (iOS 14+)** - Works but may be slower
✅ **Samsung Internet** - Works well

❌ **Internet Explorer** - Not supported (no MediaDevices API)

### Feature Detection

The scanner automatically detects:
- Camera availability
- Torch/flashlight support (mobile only)
- Battery API support (for adaptive performance)
- Vibration API support (for haptic feedback)

## Best Practices

1. **Always test on real devices:**
   - Desktop webcam != mobile camera
   - Different devices have different performance

2. **Test in various lighting:**
   - Bright light (ideal)
   - Indoor lighting (typical)
   - Low light (use flashlight)
   - Outdoor sunlight (can cause glare)

3. **Test different barcode types:**
   - Product barcodes (UPC/EAN)
   - Shipping labels (Code 128)
   - QR codes
   - Damaged/worn barcodes

4. **Monitor performance:**
   - Check console for errors
   - Watch FPS in debug overlay
   - Test on low-end devices

5. **User testing:**
   - Have non-technical users try it
   - Watch for confusion or issues
   - Iterate based on feedback

## Next Steps

Once scanner works:
1. Test database integration (add items by barcode)
2. Test item lookup (scan existing items)
3. Test in production environment
4. Deploy and test on actual medical inventory

## Need Help?

Check the full implementation documentation:
- `docs/BARCODE_SCANNER.md` - Complete technical details
- `CLAUDE.md` - Project overview and setup
- Console logs - Detailed scanner debugging

---

**Last Updated:** 2025-01-21
