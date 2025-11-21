import { useEffect, useRef, useState } from 'react';
import Quagga from '@ericblade/quagga2';
import { X, Camera, Zap, SwitchCamera } from 'lucide-react';
import { Button } from '../common/Button';

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const detectedRef = useRef(false);
  const quaggaStarted = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Multi-read verification state
  const detectionHistoryRef = useRef<Array<{ code: string; quality: number; timestamp: number }>>([]);
  const REQUIRED_MATCHES = 2; // Require 2 matches (more forgiving)
  const QUALITY_THRESHOLD = 0.65; // Minimum quality score (0-1)
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
                width: { min: 640, ideal: 1920, max: 1920 },
                height: { min: 480, ideal: 1080, max: 1080 },
                facingMode: facingMode, // User-selectable camera direction
                aspectRatio: 1.77778, // 16:9 for main camera
              },
            },
            locator: {
              patchSize: 'large',
              halfSample: false, // Full quality processing for better accuracy
            },
            frequency: 10, // Process 10 frames per second
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
            console.log('✅ Quagga started successfully');

            // Log frame processing to verify scanner is working
            let frameCount = 0;
            const frameInterval = setInterval(() => {
              frameCount++;
              if (frameCount % 10 === 0) {
                console.log(`📹 Processed ${frameCount} frames`);
              }
            }, 100); // Log every 1 second (10 frames at 100ms each)

            // Store interval for cleanup
            (window as any).__scannerFrameInterval = frameInterval;

            // Log browser info
            console.log('Browser:', navigator.userAgent);
            console.log('Platform:', navigator.platform);

            // Get the video element and stream for torch control
            const checkTorch = () => {
              const video = scannerRef.current?.querySelector('video');
              console.log('Video element found:', !!video);
              if (video) {
                videoRef.current = video;
                const stream = video.srcObject as MediaStream;
                console.log('Stream found:', !!stream);
                if (stream) {
                  streamRef.current = stream;
                  const track = stream.getVideoTracks()[0];
                  console.log('Video track found:', !!track);

                  if (track) {
                    const capabilities = track.getCapabilities?.() as any;
                    const settings = track.getSettings?.() as any;
                    console.log('Track capabilities:', capabilities);
                    console.log('Track settings:', settings);
                    console.log('Torch capability:', capabilities?.torch);
                    console.log('Facing mode:', settings?.facingMode);

                    if (capabilities?.torch) {
                      console.log('✅ Torch available!');
                      setTorchAvailable(true);
                    } else {
                      console.log('❌ Torch not available');
                      console.log('Available capabilities:', Object.keys(capabilities || {}));
                    }
                  }
                }
              }
            };

            // Try immediately
            checkTorch();

            // Also try after a delay (sometimes capabilities aren't immediately available)
            setTimeout(checkTorch, 1000);
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

          // Use "most common code" approach - more forgiving of occasional misreads
          const recentDetections = detectionHistoryRef.current.slice(-REQUIRED_MATCHES * 2); // Look at wider window

          // Count occurrences of each code
          const codeCounts = recentDetections.reduce((acc, d) => {
            acc[d.code] = (acc[d.code] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          // Find most common code
          const mostCommonCode = Object.keys(codeCounts).reduce((a, b) =>
            codeCounts[a] > codeCounts[b] ? a : b
          , code);

          const matchCount = codeCounts[mostCommonCode] || 0;

          console.log(`Detection: ${code} | Most common: ${mostCommonCode} (${matchCount}/${REQUIRED_MATCHES} matches)`);

          // If most common code appears enough times, confirm it
          if (matchCount >= REQUIRED_MATCHES && recentDetections.length >= REQUIRED_MATCHES) {
            detectedRef.current = true;

            // Calculate average quality of matches for the confirmed code
            const confirmedMatches = recentDetections.filter((d) => d.code === mostCommonCode);
            const avgQuality = confirmedMatches.reduce((sum, d) => sum + d.quality, 0) / confirmedMatches.length;
            console.log(`✅ Confirmed: ${mostCommonCode} (avg quality: ${avgQuality.toFixed(2)}, ${matchCount} matches)`);

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
              onDetected(mostCommonCode);
            }, 300);
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
        // Clear frame logging interval
        if ((window as any).__scannerFrameInterval) {
          clearInterval((window as any).__scannerFrameInterval);
        }

        // Stop Quagga if it was initialized
        if (quaggaStarted.current) {
          Quagga.stop();
          Quagga.offDetected();
        }
      } catch (err) {
        // Ignore errors if Quagga wasn't initialized
      }
    };
  }, [onDetected, facingMode]);

  const switchCamera = () => {
    // Stop current scanner
    try {
      if (quaggaStarted.current) {
        Quagga.stop();
        Quagga.offDetected();
      }
    } catch (err) {
      console.error('Error stopping scanner:', err);
    }

    // Reset state
    quaggaStarted.current = false;
    setTorchEnabled(false);
    setTorchAvailable(false);
    detectionHistoryRef.current = [];

    // Toggle camera
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const toggleTorch = async () => {
    if (!streamRef.current || !torchAvailable) return;

    try {
      const track = streamRef.current.getVideoTracks()[0];
      const newTorchState = !torchEnabled;
      await track.applyConstraints({
        // @ts-ignore - torch is not in TypeScript definitions but works on mobile
        advanced: [{ torch: newTorchState }]
      });
      setTorchEnabled(newTorchState);
    } catch (err) {
      console.error('Failed to toggle torch:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent safe-top">
        <div className="flex items-center gap-2 text-white">
          <Camera className="w-6 h-6" />
          <span className="font-medium">Scan Barcode</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Camera switch button */}
          <button
            onClick={switchCamera}
            className="p-2 rounded-full bg-white/20 text-white active:bg-white/30 transition-colors"
            aria-label="Switch camera"
          >
            <SwitchCamera className="w-6 h-6" />
          </button>

          {/* Torch button */}
          {torchAvailable && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-full transition-colors ${
                torchEnabled
                  ? 'bg-yellow-500 text-white'
                  : 'bg-white/20 text-white active:bg-white/30'
              }`}
              aria-label={torchEnabled ? 'Turn off flashlight' : 'Turn on flashlight'}
            >
              <Zap className="w-6 h-6" fill={torchEnabled ? 'currentColor' : 'none'} />
            </button>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/20 active:bg-white/30"
            aria-label="Close scanner"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Scanner viewport */}
      <div className="relative w-full h-full flex items-center justify-center px-4">
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
              className="relative w-full mx-auto"
              style={{
                maxWidth: '600px',
                aspectRatio: '16/9',
                maxHeight: 'calc(100vh - 200px)'
              }}
            />

            {/* Scanning guide overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
              <div
                className="relative"
                style={{
                  width: '100%',
                  maxWidth: '400px',
                  aspectRatio: '16/9'
                }}
              >
                {/* Corner guides */}
                <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-green-500" />
                <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-green-500" />
                <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-green-500" />
                <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-green-500" />

                {/* Center line guides */}
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-green-500/30 transform -translate-y-1/2" />
                <div className="absolute left-1/2 top-0 h-full w-0.5 bg-green-500/30 transform -translate-x-1/2" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Instructions */}
      {!error && (
        <div className="absolute bottom-0 left-0 right-0 p-6 text-center bg-gradient-to-t from-black/80 to-transparent safe-bottom">
          <p className="text-white text-sm leading-relaxed">
            Hold phone steady 6-10 inches from barcode
            <br />
            Ensure barcode is well-lit and in focus
            <br />
            {torchAvailable && 'Tap flashlight icon if needed'}
            {!torchAvailable && 'Scanner will detect automatically'}
          </p>
        </div>
      )}
    </div>
  );
}
