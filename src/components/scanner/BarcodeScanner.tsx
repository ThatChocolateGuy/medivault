import { useEffect, useRef, useState } from 'react';
import Quagga from '@ericblade/quagga2';
import { X, Camera } from 'lucide-react';
import { Button } from '../common/Button';

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const detectedRef = useRef(false);
  const quaggaStarted = useRef(false);

  // Multi-read verification state
  const detectionHistoryRef = useRef<Array<{ code: string; quality: number; timestamp: number }>>([]);
  const REQUIRED_MATCHES = 2; // Require 2 consecutive matches (mobile-friendly)
  const QUALITY_THRESHOLD = 0.6; // Minimum quality score (0-1, relaxed for mobile)
  const DETECTION_WINDOW = 3000; // 3 second window for matches

  useEffect(() => {
    // Prevent double initialization
    if (quaggaStarted.current) return;

    const initScanner = async () => {
      if (!scannerRef.current) return;

      quaggaStarted.current = true;

      try {
        await Quagga.init(
          {
            inputStream: {
              type: 'LiveStream',
              target: scannerRef.current,
              constraints: {
                width: { min: 640, ideal: 1280, max: 1920 },
                height: { min: 480, ideal: 720, max: 1080 },
                facingMode: 'environment', // Use back camera
                aspectRatio: { min: 1, max: 2 },
              },
            },
            locator: {
              patchSize: 'medium',
              halfSample: true,
            },
            numOfWorkers: 2,
            decoder: {
              readers: [
                'ean_reader',
                'ean_8_reader',
                'code_128_reader',
                'code_39_reader',
                'upc_reader',
                'upc_e_reader',
              ],
            },
            locate: true,
          },
          (err) => {
            if (err) {
              console.error('Failed to initialize Quagga:', err);
              setError(
                'Failed to access camera. Please ensure camera permissions are granted and you are using HTTPS.'
              );
              return;
            }
            Quagga.start();
          }
        );

        // Handle barcode detection with multi-read verification
        Quagga.onDetected((result) => {
          if (detectedRef.current) return; // Already detected successfully

          const code = result.codeResult.code;
          if (!code) return;

          // Calculate quality score from Quagga's error metrics
          // Lower error = higher quality (invert and normalize to 0-1 scale)
          const errors = result.codeResult.decodedCodes
            .filter((c: any) => c.error !== undefined)
            .map((c: any) => c.error);
          const avgError = errors.length > 0
            ? errors.reduce((sum: number, err: number) => sum + err, 0) / errors.length
            : 1.0;
          const quality = Math.max(0, 1 - avgError);

          // Log detection for debugging
          console.log(`Detected: ${code} (quality: ${quality.toFixed(2)})`);

          // Filter out low-quality reads
          if (quality < QUALITY_THRESHOLD) {
            console.log(`Rejected: quality ${quality.toFixed(2)} below threshold ${QUALITY_THRESHOLD}`);
            return;
          }

          // Add to detection history
          const now = Date.now();
          detectionHistoryRef.current.push({ code, quality, timestamp: now });

          // Remove old detections outside the time window
          detectionHistoryRef.current = detectionHistoryRef.current.filter(
            (d) => now - d.timestamp < DETECTION_WINDOW
          );

          // Check for consecutive matches
          const recentDetections = detectionHistoryRef.current.slice(-REQUIRED_MATCHES);
          const allMatch = recentDetections.length === REQUIRED_MATCHES &&
            recentDetections.every((d) => d.code === code);

          if (allMatch) {
            // We have enough consecutive high-quality matches!
            detectedRef.current = true;

            // Calculate average quality of matches
            const avgQuality = recentDetections.reduce((sum, d) => sum + d.quality, 0) / recentDetections.length;
            console.log(`✅ Confirmed: ${code} (avg quality: ${avgQuality.toFixed(2)}, ${REQUIRED_MATCHES} matches)`);

            // Visual feedback
            if (scannerRef.current) {
              scannerRef.current.style.borderColor = '#10b981';
              scannerRef.current.style.borderWidth = '4px';
            }

            // Vibrate if supported
            if (navigator.vibrate) {
              navigator.vibrate(200);
            }

            // Call callback after short delay to show visual feedback
            setTimeout(() => {
              onDetected(code);
            }, 300);
          } else {
            // Not enough matches yet - give subtle feedback
            const matchCount = recentDetections.filter((d) => d.code === code).length;
            console.log(`Progress: ${matchCount}/${REQUIRED_MATCHES} matches for ${code}`);
          }
        });
      } catch (err) {
        console.error('Scanner initialization error:', err);
        setError('Failed to initialize scanner. Please try again.');
        quaggaStarted.current = false; // Reset on error so user can retry
      }
    };

    initScanner();

    // Cleanup
    return () => {
      try {
        // Stop Quagga if it was initialized
        if (quaggaStarted.current) {
          Quagga.stop();
          Quagga.offDetected();
        }
      } catch (err) {
        // Ignore errors if Quagga wasn't initialized
      }
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent safe-top">
        <div className="flex items-center gap-2 text-white">
          <Camera className="w-6 h-6" />
          <span className="font-medium">Scan Barcode</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/20 active:bg-white/30"
          aria-label="Close scanner"
        >
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Scanner viewport */}
      <div className="relative w-full h-full flex items-center justify-center">
        {error ? (
          <div className="px-6 text-center">
            <div className="mb-4 text-red-400 text-lg">{error}</div>
            <Button onClick={onClose} variant="secondary">
              Close
            </Button>
          </div>
        ) : (
          <>
            <div
              ref={scannerRef}
              className="relative w-full max-w-2xl aspect-video border-2 border-white/50 rounded-lg overflow-hidden"
              style={{ maxHeight: '70vh' }}
            />

            {/* Scanning guide overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-full max-w-md aspect-video">
                {/* Corner guides */}
                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-green-500" />
                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-green-500" />
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-green-500" />
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-green-500" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Instructions */}
      {!error && (
        <div className="absolute bottom-0 left-0 right-0 p-6 text-center bg-gradient-to-t from-black/80 to-transparent safe-bottom">
          <p className="text-white text-sm">
            Position the barcode within the frame
            <br />
            Scanner will detect automatically
          </p>
        </div>
      )}
    </div>
  );
}
