import { useState, useEffect } from 'react';
import { Cloud, Check, AlertCircle, RefreshCw, LogOut, ExternalLink } from 'lucide-react';
import { Modal } from '../common/Modal';
import {
  initiateOAuthFlow,
  revokeGoogleAccess,
  isSignedIn,
  getSyncState,
  performInitialSync,
  performIncrementalSync,
  syncManager,
  type SyncState,
  type SyncDirection,
  type SyncResult,
} from '../../lib/google';

interface GoogleSyncPanelProps {
  onSyncComplete?: () => void;
}

export function GoogleSyncPanel({ onSyncComplete }: GoogleSyncPanelProps) {
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showInitialSyncModal, setShowInitialSyncModal] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ phase: string; percent: number } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Load sync state on mount
  useEffect(() => {
    loadSyncState();

    // Start sync manager if signed in
    if (isSignedIn()) {
      syncManager.start({
        onStatusChange: (status) => {
          setSyncState((prev) => (prev ? { ...prev, status } : null));
        },
      });
    }

    return () => {
      syncManager.stop();
    };
  }, []);

  async function loadSyncState() {
    try {
      const state = await getSyncState();
      setSyncState({
        ...state,
        status: isSignedIn() ? 'idle' : 'idle',
        isOnline: navigator.onLine,
      });
    } catch (error) {
      console.error('Failed to load sync state:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConnect() {
    try {
      setSyncError(null);
      await initiateOAuthFlow();
      // This will redirect to Google, so we won't reach here
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect';
      setSyncError(message);
    }
  }

  async function handleDisconnect() {
    try {
      setSyncError(null);
      await revokeGoogleAccess();
      syncManager.stop();
      setSyncState({
        status: 'idle',
        isOnline: navigator.onLine,
        pendingChanges: 0,
      });
      setShowDisconnectConfirm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to disconnect';
      setSyncError(message);
    }
  }

  async function handleInitialSync(direction: SyncDirection) {
    setIsSyncing(true);
    setSyncError(null);
    setSyncProgress({ phase: 'Starting...', percent: 0 });

    try {
      const result = await performInitialSync(
        { direction },
        {
          onProgress: (progress) => {
            setSyncProgress({
              phase: progress.phase,
              percent: Math.round((progress.current / progress.total) * 100),
            });
          },
          onComplete: (result: SyncResult) => {
            console.log('✅ Initial sync completed:', result);
          },
          onError: (error: Error) => {
            setSyncError(error.message);
          },
        }
      );

      if (result.success) {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 3000);
        await loadSyncState();
        onSyncComplete?.();

        // Start background sync
        syncManager.start({
          onStatusChange: (status) => {
            setSyncState((prev) => (prev ? { ...prev, status } : null));
          },
        });
      } else {
        setSyncError(result.errors.join(', ') || 'Sync failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      setSyncError(message);
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
      setShowInitialSyncModal(false);
    }
  }

  async function handleManualSync() {
    setIsSyncing(true);
    setSyncError(null);

    try {
      const result = await performIncrementalSync({
        onStatusChange: (status) => {
          setSyncState((prev) => (prev ? { ...prev, status } : null));
        },
      });

      if (result && result.success) {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 3000);
        await loadSyncState();
        onSyncComplete?.();
      } else if (result && result.errors.length > 0) {
        setSyncError(result.errors.join(', '));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      setSyncError(message);
    } finally {
      setIsSyncing(false);
    }
  }

  const signedIn = isSignedIn();
  const hasSpreadsheet = !!syncState?.spreadsheetInfo;

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-500">Loading sync status...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 divide-y">
        {/* Connection Status */}
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Cloud className={`w-5 h-5 ${signedIn ? 'text-green-600' : 'text-gray-400'}`} />
            <div className="flex-1">
              <p className="font-medium text-gray-900">Google Sheets Sync</p>
              <p className="text-sm text-gray-500">
                {signedIn
                  ? hasSpreadsheet
                    ? 'Connected and syncing'
                    : 'Connected - ready to sync'
                  : 'Connect your Google account'}
              </p>
            </div>

            {signedIn ? (
              <div className="flex items-center gap-2">
                {syncState?.status === 'syncing' || isSyncing ? (
                  <RefreshCw className="w-4 h-4 text-primary-600 animate-spin" />
                ) : syncState?.status === 'success' || syncSuccess ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : syncState?.status === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                ) : syncState?.status === 'offline' ? (
                  <span className="text-xs text-gray-400">Offline</span>
                ) : null}
                <span className="text-xs text-green-600">Connected</span>
              </div>
            ) : (
              <span className="text-xs text-gray-400">Not connected</span>
            )}
          </div>
        </div>

        {/* Actions */}
        {!signedIn ? (
          <button
            onClick={handleConnect}
            className="flex items-center gap-3 w-full p-4 text-left text-primary-600 active:bg-gray-50"
          >
            <Cloud className="w-5 h-5" />
            <span className="font-medium">Connect Google Account</span>
          </button>
        ) : (
          <>
            {/* Sync Status */}
            {syncState?.lastSyncAt && (
              <div className="p-4 text-sm text-gray-500">
                Last synced: {new Date(syncState.lastSyncAt).toLocaleString()}
                {syncState.pendingChanges > 0 && (
                  <span className="ml-2 text-orange-600">
                    ({syncState.pendingChanges} pending changes)
                  </span>
                )}
              </div>
            )}

            {/* Initial Sync Button (if no spreadsheet) */}
            {!hasSpreadsheet && (
              <button
                onClick={() => setShowInitialSyncModal(true)}
                disabled={isSyncing}
                className="flex items-center gap-3 w-full p-4 text-left text-primary-600 active:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="font-medium">Start Initial Sync</span>
              </button>
            )}

            {/* Manual Sync Button */}
            {hasSpreadsheet && (
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className="flex items-center gap-3 w-full p-4 text-left active:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 text-gray-600 ${isSyncing ? 'animate-spin' : ''}`} />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Sync Now</p>
                  <p className="text-sm text-gray-500">
                    {isSyncing ? 'Syncing...' : 'Manually trigger sync'}
                  </p>
                </div>
              </button>
            )}

            {/* View Spreadsheet */}
            {syncState?.spreadsheetInfo?.spreadsheetUrl && (
              <a
                href={syncState.spreadsheetInfo.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full p-4 text-left active:bg-gray-50"
              >
                <ExternalLink className="w-5 h-5 text-gray-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">View Spreadsheet</p>
                  <p className="text-sm text-gray-500">Open in Google Sheets</p>
                </div>
              </a>
            )}

            {/* Disconnect */}
            <button
              onClick={() => setShowDisconnectConfirm(true)}
              className="flex items-center gap-3 w-full p-4 text-left text-red-600 active:bg-red-50"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Disconnect Google Account</span>
            </button>
          </>
        )}

        {/* Error Message */}
        {syncError && (
          <div className="p-4 bg-red-50 text-red-700 text-sm">{syncError}</div>
        )}

        {/* Success Message */}
        {syncSuccess && (
          <div className="p-4 bg-green-50 text-green-700 text-sm">Sync completed successfully!</div>
        )}

        {/* Sync Progress */}
        {syncProgress && (
          <div className="p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">{syncProgress.phase}</span>
              <span className="text-gray-500">{syncProgress.percent}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-600 transition-all duration-300"
                style={{ width: `${syncProgress.percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Initial Sync Direction Modal */}
      <Modal
        isOpen={showInitialSyncModal}
        onClose={() => !isSyncing && setShowInitialSyncModal(false)}
        title="Choose Sync Direction"
      >
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            Choose how to sync your data for the first time:
          </p>

          <div className="space-y-3">
            <button
              onClick={() => handleInitialSync('deviceToCloud')}
              disabled={isSyncing}
              className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-primary-500 focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
            >
              <p className="font-medium text-gray-900">Upload to Cloud</p>
              <p className="text-sm text-gray-500">
                Send your device data to Google Sheets (replaces cloud data)
              </p>
            </button>

            <button
              onClick={() => handleInitialSync('cloudToDevice')}
              disabled={isSyncing}
              className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-primary-500 focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
            >
              <p className="font-medium text-gray-900">Download from Cloud</p>
              <p className="text-sm text-gray-500">
                Get data from Google Sheets (replaces device data)
              </p>
            </button>

            <button
              onClick={() => handleInitialSync('merge')}
              disabled={isSyncing}
              className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-primary-500 focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
            >
              <p className="font-medium text-gray-900">Merge Both</p>
              <p className="text-sm text-gray-500">
                Combine data from device and cloud (recommended)
              </p>
            </button>
          </div>

          {syncProgress && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">{syncProgress.phase}</span>
                <span className="text-gray-500">{syncProgress.percent}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-600 transition-all duration-300"
                  style={{ width: `${syncProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {!isSyncing && (
            <button
              onClick={() => setShowInitialSyncModal(false)}
              className="w-full py-2 text-gray-600 text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      </Modal>

      {/* Disconnect Confirmation Modal */}
      <Modal
        isOpen={showDisconnectConfirm}
        onClose={() => setShowDisconnectConfirm(false)}
        title="Disconnect Google Account?"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            This will stop syncing your data with Google Sheets. Your local data will be
            preserved, but changes won't sync to the cloud.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => setShowDisconnectConfirm(false)}
              className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleDisconnect}
              className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg font-medium"
            >
              Disconnect
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
