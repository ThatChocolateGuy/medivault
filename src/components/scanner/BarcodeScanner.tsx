import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat, NotFoundException } from '@zxing/library';
import { X, Camera, Zap, SwitchCamera, AlertCircle } from 'lucide-react';
import { Button } from '../common/Button';

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

interface DeviceCapabilities {
  cpuCores: number;
  isMobile: boolean;
  batteryLevel: number | null;
  hasLowBattery: boolean;
}

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const detectedRef = useRef(false);
  const initializingRef = useRef(false);
  const abortInitRef = useRef(false);
  const cleanupCameraRef = useRef<(() => void) | null>(null);

  // State
  const [error, setError] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [deviceCapabilities, setDeviceCapabilities] = useState<DeviceCapabilities>({
    cpuCores: navigator.hardwareConcurrency || 2,
    isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
    batteryLevel: null,
    hasLowBattery: false,
  });
  const [scanStats, setScanStats] = useState({
    framesProcessed: 0,
    currentFPS: 10,
    resolution: { width: 640, height: 480 },
  });

  // Detection history for multi-read verification with consensus voting
  const detectionHistoryRef = useRef<Array<{ code: string; timestamp: number }>>([]);
  const REQUIRED_MATCHES = 2;          // Require 2 matching reads (faster detection)
  const DETECTION_WINDOW = 1000;       // Within 1 second (faster)
  const CONSENSUS_THRESHOLD = 0.67;    // 67% of reads must agree

  // Fixed FPS for consistent performance on mobile
  const SCAN_FPS = 4;

  // Optimized resolution for faster processing (25% less data than 1280x720)
  const SCAN_RESOLUTION = { width: 960, height: 540 };

  // Get device capabilities on mount
  useEffect(() => {
    const detectCapabilities = async () => {
      try {
        // @ts-expect-error - Battery API is experimental
        const battery = await navigator.getBattery?.();
        if (battery) {
          const level = battery.level * 100;
          setDeviceCapabilities(prev => ({
            ...prev,
            batteryLevel: level,
            hasLowBattery: level < 20,
          }));

          // Listen for battery changes
          battery.addEventListener('levelchange', () => {
            const newLevel = battery.level * 100;
            setDeviceCapabilities(prev => ({
              ...prev,
              batteryLevel: newLevel,
              hasLowBattery: newLevel < 20,
            }));
          });
        }
      } catch {
        console.log('Battery API not available');
      }
    };

    detectCapabilities();
  }, []);

  // Use fixed FPS for predictable performance
  const calculateOptimalFPS = useCallback((): number => {
    return SCAN_FPS;
  }, []);

  // Process single frame - decode from canvas with ROI
  const processFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !readerRef.current) return;
    if (detectedRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Skip if video not ready
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.debug('⏳ Video not ready:', { width: video.videoWidth, height: video.videoHeight });
        return;
      }

      // Initialize canvas dimensions to match video (only once)
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        console.log('📐 Canvas initialized:', { width: canvas.width, height: canvas.height });
      }

      // Get canvas context
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Draw current video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Calculate ROI (center 50% of frame for better performance)
      const roiWidth = Math.floor(canvas.width * 0.5);
      const roiHeight = Math.floor(canvas.height * 0.5);
      const roiX = Math.floor((canvas.width - roiWidth) / 2);
      const roiY = Math.floor((canvas.height - roiHeight) / 2);

      // Extract ROI image data
      const roiImageData = ctx.getImageData(roiX, roiY, roiWidth, roiHeight);

      // Create temporary canvas for ROI
      const roiCanvas = document.createElement('canvas');
      roiCanvas.width = roiWidth;
      roiCanvas.height = roiHeight;
      const roiCtx = roiCanvas.getContext('2d');
      if (!roiCtx) return;

      // Put ROI ImageData onto temporary canvas
      roiCtx.putImageData(roiImageData, 0, 0);

      // Decode from ROI canvas
      try {
        const result = readerRef.current.decodeFromCanvas(roiCanvas);

        if (result && result.getText()) {
          const code = result.getText();
          console.log(`🔍 ZXing detected: ${code} (format: ${result.getBarcodeFormat()})`);
          handleDetection(code);
        }
      } catch (err) {
        // NotFoundException is normal when no barcode visible
        if (!(err instanceof NotFoundException)) {
          // Log ALL non-NotFoundException errors for debugging
          console.error('❌ Decode error:', err, {
            videoSize: `${video.videoWidth}x${video.videoHeight}`,
            canvasSize: `${canvas.width}x${canvas.height}`,
            roiSize: `${roiWidth}x${roiHeight}`
          });
        }
      }
    } catch (err) {
      console.error('❌ Frame processing error:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle barcode detection with consensus voting verification
  const handleDetection = useCallback((code: string) => {
    if (detectedRef.current) return;

    const now = Date.now();

    // Add to detection history
    detectionHistoryRef.current.push({ code, timestamp: now });

    // Remove old detections outside time window
    detectionHistoryRef.current = detectionHistoryRef.current.filter(
      d => now - d.timestamp < DETECTION_WINDOW
    );

    // Count votes for each detected code (majority voting)
    const votes = new Map<string, number>();
    detectionHistoryRef.current.forEach(({ code: c }) => {
      votes.set(c, (votes.get(c) || 0) + 1);
    });

    // Find code with most votes (winning code)
    let winningCode = '';
    let maxVotes = 0;
    votes.forEach((count, c) => {
      if (count > maxVotes) {
        maxVotes = count;
        winningCode = c;
      }
    });

    // Check consensus requirements
    const totalReads = detectionHistoryRef.current.length;
    const hasEnoughReads = maxVotes >= REQUIRED_MATCHES;
    const hasConsensus = maxVotes / totalReads >= CONSENSUS_THRESHOLD;

    if (hasEnoughReads && hasConsensus) {
      const agreementPct = ((maxVotes / totalReads) * 100).toFixed(0);
      console.log(`✅ Consensus reached: ${winningCode} (${maxVotes}/${totalReads} votes, ${agreementPct}% agreement)`);
      confirmDetection(winningCode);
    } else {
      console.log(`📊 Verifying: ${winningCode} has ${maxVotes}/${REQUIRED_MATCHES} matches (${totalReads} total reads)`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [REQUIRED_MATCHES, DETECTION_WINDOW, CONSENSUS_THRESHOLD]);

  // Confirm detection and trigger callback
  const confirmDetection = useCallback((code: string) => {
    detectedRef.current = true;
    scanningRef.current = false;

    console.log(`✅ Confirmed: ${code}`);

    // Visual feedback
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate([200]);
    }

    // Call callback after brief delay for visual feedback
    setTimeout(() => {
      // Cleanup camera before callback (which unmounts component)
      if (cleanupCameraRef.current) {
        cleanupCameraRef.current();
      }
      onDetected(code);
    }, 300);
  }, [onDetected]);

  // Main scanning loop with adaptive processing
  const startScanningLoop = useCallback((targetFPS: number) => {
    try {
      const frameDelay = 1000 / targetFPS;
      let lastFrameTime = 0;
      let frameCount = 0;

      console.log(`🔄 Starting scanning loop at ${targetFPS} FPS (${frameDelay.toFixed(2)}ms per frame)`);
      console.log('📋 Initial state:', {
        scanning: scanningRef.current,
        detected: detectedRef.current,
        hasVideo: !!videoRef.current,
        hasReader: !!readerRef.current
      });

      const scanFrame = async (timestamp: number) => {
        try {
          // Log first frame
          if (frameCount === 0) {
            console.log('🎬 First frame callback invoked!', {
              timestamp,
              scanning: scanningRef.current,
              detected: detectedRef.current
            });
          }

          if (!scanningRef.current || detectedRef.current) {
            console.log('⏹️ Scanning loop stopped:', { scanning: scanningRef.current, detected: detectedRef.current });
            return;
          }

          // Adaptive frame skipping
          if (timestamp - lastFrameTime < frameDelay) {
            requestAnimationFrame(scanFrame);
            return;
          }

          lastFrameTime = timestamp;
          frameCount++;

          // Update stats every frame for better visibility
          setScanStats(prev => ({ ...prev, framesProcessed: frameCount }));

          // Log every 20 frames
          if (frameCount % 20 === 0) {
            console.log(`📊 Processed ${frameCount} frames`);
          }

          // Process frame
          await processFrame();

          // Continue loop
          requestAnimationFrame(scanFrame);
        } catch (err) {
          console.error('❌ Error in scanFrame:', err);
          // Try to continue scanning despite error
          requestAnimationFrame(scanFrame);
        }
      };

      const rafId = requestAnimationFrame(scanFrame);
      console.log('✅ requestAnimationFrame registered, ID:', rafId);
    } catch (err) {
      console.error('❌ Error in startScanningLoop:', err);
    }
  }, [processFrame]);

  // Helper function to find best camera with autofocus capability
  const findBestCamera = useCallback(async (targetFacingMode: 'user' | 'environment'): Promise<{ deviceId: string | undefined; fromCache: boolean }> => {
    try {
      // Check cache first for instant initialization on subsequent opens
      const cacheKey = `medivault_best_camera_${targetFacingMode}`;
      const cachedDeviceId = localStorage.getItem(cacheKey);

      if (cachedDeviceId) {
        console.log(`✨ Using cached camera: ${cachedDeviceId}`);

        // Verify cached camera still exists and works
        try {
          const testStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: cachedDeviceId } }
          });
          testStream.getTracks().forEach(t => t.stop());
          console.log('✅ Cached camera verified');
          return { deviceId: cachedDeviceId, fromCache: true };
        } catch (err) {
          console.warn('⚠️ Cached camera no longer available, finding new one');
          localStorage.removeItem(cacheKey);
        }
      }

      console.log('🔍 Finding best camera (first time setup)...');

      // Request permission first to populate labels
      const permissionStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: targetFacingMode } });
      permissionStream.getTracks().forEach(t => t.stop());
      await new Promise(resolve => setTimeout(resolve, 50)); // Reduced from 100ms

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');

      console.log('📷 Available cameras:', videoDevices.map(d => d.label || d.deviceId));

      // Filter cameras by facing mode
      const filteredDevices = videoDevices.filter(device => {
        const label = device.label.toLowerCase();
        const deviceId = device.deviceId.toLowerCase();

        // On first boot with empty labels, prefer camera with "0" in deviceId (usually main camera)
        if (!label && targetFacingMode === 'environment') {
          return deviceId.includes('0') || deviceId.includes('back');
        }
        if (!label && targetFacingMode === 'user') {
          return deviceId.includes('1') || deviceId.includes('front');
        }

        if (targetFacingMode === 'environment') {
          return label.includes('back') || label.includes('rear');
        } else if (targetFacingMode === 'user') {
          return label.includes('front') || label.includes('user');
        }
        return false;
      });

      console.log(`📷 Filtered to ${filteredDevices.length} ${targetFacingMode} cameras`);

      // Try each filtered camera and check for autofocus capability
      for (const device of filteredDevices) {
        const label = device.label.toLowerCase();

        // Skip obvious ultrawide/telephoto cameras
        if (label && (label.includes('ultra') || label.includes('tele'))) {
          console.log(`⏭️ Skipping ${device.label} (ultrawide/telephoto)`);
          continue;
        }

        try {
          // Request this specific camera to test capabilities
          const testStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: device.deviceId } }
          });

          const track = testStream.getVideoTracks()[0];
          const caps = track.getCapabilities() as MediaTrackCapabilities & {
            focusMode?: string[];
          };

          const hasAutofocus = caps?.focusMode?.includes('continuous');

          // Clean up test stream
          testStream.getTracks().forEach(t => t.stop());

          // Wait for camera to fully release
          await new Promise(resolve => setTimeout(resolve, 50)); // Reduced from 100ms

          if (hasAutofocus) {
            console.log(`✅ Found camera with autofocus: ${device.label || device.deviceId}`);
            // Cache the best camera for instant initialization next time
            localStorage.setItem(cacheKey, device.deviceId);
            console.log(`💾 Cached camera for future use`);
            return { deviceId: device.deviceId, fromCache: false };
          } else {
            console.log(`⏭️ Skipping ${device.label || device.deviceId} (no continuous autofocus)`);
          }
        } catch (err) {
          console.warn(`⚠️ Could not test camera ${device.label || device.deviceId}:`, err);
        }
      }

      console.warn('⚠️ No camera with continuous autofocus found, using default');
      return { deviceId: undefined, fromCache: false };
    } catch (err) {
      console.error('❌ Camera enumeration failed:', err);
      return { deviceId: undefined, fromCache: false };
    }
  }, []);

  // Initialize scanner
  useEffect(() => {
    // Allow re-initialization if we have no active stream (handles StrictMode remount)
    if (detectedRef.current || (initializingRef.current && streamRef.current)) {
      console.log('⏭️ Skipping initialization:', {
        detected: detectedRef.current,
        initializing: initializingRef.current,
        hasStream: !!streamRef.current
      });
      return;
    }

    const initScanner = async () => {
      initializingRef.current = true;
      abortInitRef.current = false; // Reset abort flag for this initialization
      console.log('🚀 Initializing scanner...', {
        attempt: streamRef.current ? 'retry after cleanup' : 'first attempt'
      });

      // Diagnostic checks
      console.log('=== Scanner Diagnostics ===');
      console.log('URL:', window.location.href);
      console.log('Protocol:', window.location.protocol);
      console.log('Is HTTPS:', window.location.protocol === 'https:');
      console.log('Is localhost:', window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      console.log('MediaDevices available:', !!navigator.mediaDevices);
      console.log('getUserMedia available:', !!navigator.mediaDevices?.getUserMedia);
      console.log('User agent:', navigator.userAgent);
      console.log('========================');

      try {
        // Configure ZXing hints for optimal scanning
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.QR_CODE,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true); // Enable for better detection
        hints.set(DecodeHintType.ASSUME_GS1, false);

        // Create reader
        const reader = new BrowserMultiFormatReader(hints);
        readerRef.current = reader;

        console.log('📋 ZXing configured for formats:', [
          'CODE_128', 'CODE_39', 'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'QR_CODE'
        ]);

        // Calculate optimal FPS based on device capabilities
        const optimalFPS = calculateOptimalFPS();
        setScanStats(prev => ({ ...prev, currentFPS: optimalFPS, resolution: SCAN_RESOLUTION }));

        // Find best camera with autofocus capability
        const { deviceId: bestCameraId, fromCache } = await findBestCamera(facingMode);

        // Check if cleanup was called during camera enumeration
        if (abortInitRef.current) {
          console.warn('⚠️ Cleanup called during camera enumeration, aborting initialization');
          return;
        }

        // Wait for any test cameras to fully release hardware (only needed if we tested cameras)
        if (bestCameraId && !fromCache) {
          await new Promise(resolve => setTimeout(resolve, 100)); // Reduced from 200ms, only when testing
          console.log('⏳ Camera hardware released, requesting final camera...');
        }

        // Check again after delay
        if (abortInitRef.current) {
          console.warn('⚠️ Cleanup called during camera release delay, aborting initialization');
          return;
        }

        // Request camera with explicit deviceId or fallback to facingMode
        const constraints: MediaStreamConstraints = {
          video: bestCameraId ? {
            deviceId: { exact: bestCameraId },
            width: { ideal: SCAN_RESOLUTION.width },
            height: { ideal: SCAN_RESOLUTION.height },
            aspectRatio: { ideal: 16 / 9 },
            // Enable continuous autofocus (experimental API)
            focusMode: { ideal: 'continuous' },
            // Prefer close focus distance (0.2 = ~6-10 inches optimal for barcodes)
            focusDistance: { ideal: 0.2 },
          } as any : {
            // Fallback if no camera with autofocus found
            facingMode: facingMode,
            width: { ideal: SCAN_RESOLUTION.width },
            height: { ideal: SCAN_RESOLUTION.height },
            aspectRatio: { ideal: 16 / 9 },
            // Enable continuous autofocus (experimental API)
            focusMode: { ideal: 'continuous' },
            // Prefer close focus distance (0.2 = ~6-10 inches optimal for barcodes)
            focusDistance: { ideal: 0.2 },
          } as any,
        };

        console.log('🎥 Requesting camera with constraints:', {
          usingDeviceId: !!bestCameraId,
          constraints: bestCameraId ? 'explicit deviceId' : 'facingMode fallback'
        });

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Store stream IMMEDIATELY so cleanup can find it if user exits during initialization
        streamRef.current = stream;
        console.log('📹 Stream acquired and stored in ref');

        // Check if cleanup was called during camera acquisition
        if (abortInitRef.current) {
          console.warn('⚠️ Cleanup called during camera acquisition, stopping stream immediately');
          stream.getTracks().forEach(track => {
            console.log(`⏹️ Stopping orphaned track: ${track.kind} (${track.label})`);
            track.stop();
          });
          streamRef.current = null;
          return;
        }

        // Check if video element is still available
        if (!videoRef.current) {
          console.warn('⚠️ Video element unmounted, stopping stream');
          stream.getTracks().forEach(track => {
            track.stop();
          });
          streamRef.current = null;
          return;
        }

        const video = videoRef.current;
        video.srcObject = stream;

        // Wait for video to be ready (readyState >= 3 for actual frames)
        console.log('⏳ Waiting for video to be ready...');
        await new Promise<void>((resolve) => {
          const checkReady = () => {
            if (video.readyState >= 3 && video.videoWidth > 0 && video.videoHeight > 0) {
              console.log('📹 Video ready:', {
                readyState: video.readyState,
                dimensions: `${video.videoWidth}x${video.videoHeight}`,
                paused: video.paused
              });
              video.removeEventListener('loadeddata', checkReady);
              video.removeEventListener('canplay', checkReady);
              video.removeEventListener('playing', checkReady);
              resolve();
            }
          };

          // Check immediately
          if (video.readyState >= 3 && video.videoWidth > 0 && video.videoHeight > 0) {
            console.log('📹 Video ready immediately');
            resolve();
            return;
          }

          // Listen to multiple events to catch when ready
          video.addEventListener('loadeddata', checkReady);
          video.addEventListener('canplay', checkReady);
          video.addEventListener('playing', checkReady);

          // Timeout after 5 seconds
          setTimeout(() => {
            video.removeEventListener('loadeddata', checkReady);
            video.removeEventListener('canplay', checkReady);
            video.removeEventListener('playing', checkReady);
            console.log('⚠️ Video ready timeout, proceeding anyway:', {
              readyState: video.readyState,
              dimensions: `${video.videoWidth}x${video.videoHeight}`
            });
            resolve();
          }, 5000);
        });

        // Ensure video is playing (defensive fallback if autoPlay fails)
        if (video.paused) {
          try {
            await video.play();
            console.log('✅ Video playback started programmatically');
          } catch (playErr) {
            console.warn('⚠️ Video play() failed:', playErr);
            // In most cases autoPlay will handle this, so this is just a fallback
          }
        } else {
          console.log('✅ Video already playing via autoPlay');
        }

        // Check camera capabilities and apply autofocus
        const videoTrack = stream.getVideoTracks()[0];
        const capabilities = videoTrack.getCapabilities?.() as MediaTrackCapabilities & {
          torch?: boolean;
          focusMode?: string[];
          focusDistance?: { min: number; max: number; step: number };
        };

        console.log('📷 Camera selected:', {
          label: videoTrack.label,
          focusModes: capabilities?.focusMode,
          focusDistance: capabilities?.focusDistance,
        });

        // Apply continuous autofocus if supported
        if (capabilities?.focusMode?.includes('continuous')) {
          try {
            const minFocusDistance = capabilities.focusDistance?.min ?? 0.2;
            // Use experimental focus APIs (not in TypeScript defs yet)
            await videoTrack.applyConstraints({
              advanced: [
                { focusMode: 'continuous' },
                { focusDistance: Math.max(minFocusDistance, 0.2) }
              ]
            } as any);
            console.log('✅ Continuous autofocus enabled');
          } catch (err) {
            console.warn('⚠️ Could not apply autofocus:', err);
          }
        } else {
          console.warn('⚠️ Continuous autofocus not available on this camera');
        }

        // Check torch capability
        if (capabilities?.torch) {
          setTorchAvailable(true);
          console.log('✅ Torch available');
        }

        // Start scanning loop
        console.log('🎬 Starting scanning loop...');
        scanningRef.current = true;
        startScanningLoop(optimalFPS);

        console.log('✅ ZXing scanner initialized', {
          fps: optimalFPS,
          resolution: SCAN_RESOLUTION,
          device: deviceCapabilities,
        });

      } catch (err) {
        console.error('Scanner initialization error:', err);

        // Detailed error logging
        let errorMessage = 'Failed to access camera. ';

        if (err instanceof Error) {
          console.error('Error name:', err.name);
          console.error('Error message:', err.message);

          // AbortError is expected in React StrictMode (development only)
          // It happens when the component unmounts during initialization
          if (err.name === 'AbortError') {
            console.warn('⚠️ Scanner initialization aborted (likely due to React StrictMode in development)');
            console.warn('This is expected in development and will not happen in production.');
            // Don't show error to user - it will reinitialize
            return;
          } else if (err.name === 'NotAllowedError') {
            errorMessage += 'Permission denied. Please allow camera access in browser settings.';
          } else if (err.name === 'NotFoundError') {
            errorMessage += 'No camera found on this device.';
          } else if (err.name === 'NotReadableError') {
            errorMessage += 'Camera is in use by another application.';
          } else if (err.name === 'OverconstrainedError') {
            errorMessage += 'Camera does not support the requested resolution.';
          } else if (err.name === 'SecurityError') {
            errorMessage += 'Camera access blocked by browser security policy. Ensure you are using HTTPS.';
          } else {
            errorMessage += `${err.message} (${err.name})`;
          }
        } else {
          errorMessage += 'Unknown error occurred.';
        }

        // Check if MediaDevices API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          errorMessage = 'Camera API not supported. Please use a modern browser (Chrome, Firefox, Safari).';
        }

        setError(errorMessage);
      }
    };

    initScanner();

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up scanner...', {
        hadStream: !!streamRef.current,
        wasScanning: scanningRef.current
      });

      // Signal abort to any ongoing initialization
      abortInitRef.current = true;

      scanningRef.current = false;
      detectedRef.current = false;
      initializingRef.current = false; // Reset immediately to allow re-init

      // Pause video first
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
        console.log('📹 Paused and cleared video source');
      }

      // Stop all camera tracks
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        console.log(`⏹️ Stopping ${tracks.length} camera track(s)`);
        tracks.forEach((track, index) => {
          console.log(`⏹️ Track ${index + 1}: ${track.kind} (${track.label}) - State: ${track.readyState}`);
          track.stop();
          console.log(`✅ Track ${index + 1} stopped - New state: ${track.readyState}`);
        });
        streamRef.current = null;
      }

      // BrowserMultiFormatReader doesn't need cleanup - it's a stateless decoder

      console.log('✅ Cleanup complete');
    };
  }, [facingMode, calculateOptimalFPS, startScanningLoop, findBestCamera]);

  // Explicit cleanup function for immediate camera release
  const cleanupCamera = useCallback(() => {
    console.log('🧹 Manual cleanup triggered');

    // Signal abort to any ongoing initialization
    abortInitRef.current = true;

    // Stop scanning loop immediately
    scanningRef.current = false;
    detectedRef.current = false;

    // Stop all camera tracks FIRST (before touching video element)
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      console.log(`⏹️ Stopping ${tracks.length} camera track(s)`);

      tracks.forEach((track, index) => {
        console.log(`⏹️ Track ${index + 1}: ${track.kind} (${track.label}) - State: ${track.readyState}`);

        // Try to stop the track
        try {
          track.stop();

          // Verify it actually stopped
          if (track.readyState !== 'ended') {
            console.warn(`⚠️ Track ${index + 1} didn't stop immediately, retrying...`);
            // Force stop again
            track.stop();

            // Check again after a microtask
            setTimeout(() => {
              if (track.readyState !== 'ended') {
                console.error(`❌ Track ${index + 1} FAILED to stop! State: ${track.readyState}`);
              } else {
                console.log(`✅ Track ${index + 1} stopped on retry`);
              }
            }, 0);
          } else {
            console.log(`✅ Track ${index + 1} stopped - State: ${track.readyState}`);
          }
        } catch (err) {
          console.error(`❌ Error stopping track ${index + 1}:`, err);
        }
      });

      // Clear stream reference
      streamRef.current = null;
    }

    // Pause and clear video AFTER stopping tracks
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
        // Force load to clear any buffered data
        videoRef.current.load();
        console.log('📹 Video paused, cleared, and reloaded');
      } catch (err) {
        console.error('❌ Error clearing video:', err);
      }
    }

    console.log('✅ Manual cleanup complete');
  }, []);

  // Store cleanup function in ref for use in callbacks
  cleanupCameraRef.current = cleanupCamera;

  // Switch camera
  const switchCamera = () => {
    // Stop current stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    // Reset state
    scanningRef.current = false;
    detectedRef.current = false;
    initializingRef.current = false;
    detectionHistoryRef.current = [];
    setTorchEnabled(false);
    setTorchAvailable(false);

    // Toggle camera
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  // Toggle torch
  const toggleTorch = async () => {
    if (!streamRef.current || !torchAvailable) return;

    try {
      const track = streamRef.current.getVideoTracks()[0];
      const newTorchState = !torchEnabled;

      await track.applyConstraints({
        // @ts-expect-error - torch is not in TypeScript definitions
        advanced: [{ torch: newTorchState }]
      });

      setTorchEnabled(newTorchState);
      console.log(`💡 Torch ${newTorchState ? 'ON' : 'OFF'}`);
    } catch (err) {
      console.error('Failed to toggle torch:', err);
    }
  };

  // Handle close with explicit cleanup
  const handleClose = () => {
    cleanupCamera();
    onClose();
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
            onClick={handleClose}
            className="p-2 rounded-full bg-white/20 active:bg-white/30"
            aria-label="Close scanner"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Scanner viewport */}
      <div className="relative w-full h-full flex items-center justify-center">
        {error ? (
          <div className="px-6 text-center">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-red-100">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <div className="mb-4 text-red-400 text-lg">{error}</div>
            <Button onClick={onClose} variant="secondary">
              Close
            </Button>
          </div>
        ) : (
          <div className="relative w-full h-full">
            {/* Video element */}
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />

            {/* Hidden canvas for processing */}
            <canvas
              ref={canvasRef}
              className="hidden"
            />

            {/* Scanning guide overlay with ROI indicator */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="relative"
                style={{
                  width: '50%',
                  maxWidth: '400px',
                  aspectRatio: '16/9'
                }}
              >
                {/* Corner guides */}
                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-green-500" />
                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-green-500" />
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-green-500" />
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-green-500" />

                {/* Scanning line animation - GPU accelerated with transform */}
                <div
                  className="absolute top-0 left-0 right-0 h-full animate-scan-line"
                  style={{ willChange: 'transform' }}
                >
                  <div className="h-0.5 bg-green-500" />
                </div>
              </div>
            </div>

            {/* Performance stats (debug mode) */}
            {import.meta.env.DEV && (
              <div className="absolute top-20 left-4 bg-black/70 text-white text-xs p-2 rounded font-mono">
                <div>FPS: {scanStats.currentFPS}</div>
                <div>Res: {scanStats.resolution.width}x{scanStats.resolution.height}</div>
                <div>Frames: {scanStats.framesProcessed}</div>
                {deviceCapabilities.batteryLevel !== null && (
                  <div>Battery: {deviceCapabilities.batteryLevel.toFixed(0)}%</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Instructions */}
      {!error && (
        <div className="absolute bottom-0 left-0 right-0 p-6 text-center bg-gradient-to-t from-black/80 to-transparent safe-bottom">
          <p className="text-white text-sm leading-relaxed">
            Hold phone steady 6-10 inches from barcode
            <br />
            Position barcode in the center frame
            <br />
            {deviceCapabilities.hasLowBattery && (
              <span className="text-yellow-400">⚠️ Low battery - reduced scan rate<br /></span>
            )}
            Scanner will detect automatically
          </p>
        </div>
      )}
    </div>
  );
}
