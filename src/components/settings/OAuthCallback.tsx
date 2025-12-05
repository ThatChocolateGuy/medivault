import { useEffect, useState } from 'react';
import { Check, AlertCircle, Loader } from 'lucide-react';
import { handleOAuthCallback, OAuthError } from '../../lib/google';

// Constants for UI timing - provides visual feedback to user
const SUCCESS_DISPLAY_DURATION_MS = 1500;

interface OAuthCallbackProps {
  onSuccess: () => void;
  onError: (error: string) => void;
}

/**
 * OAuth Callback Handler Component
 *
 * This component handles the OAuth callback from Google.
 * It extracts the authorization code from the URL and exchanges it for tokens.
 *
 * Usage: Render this component when the URL matches /auth/callback
 */
export function OAuthCallback({ onSuccess, onError }: OAuthCallbackProps) {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      try {
        // Get the authorization code from URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        // Check for errors from Google
        if (error) {
          throw new OAuthError(
            errorDescription || `OAuth error: ${error}`,
            'AUTH_FAILED'
          );
        }

        if (!code) {
          throw new OAuthError(
            'No authorization code received from Google',
            'AUTH_FAILED'
          );
        }

        // Exchange the code for tokens
        await handleOAuthCallback(code);

        setStatus('success');

        // Clear the URL parameters
        window.history.replaceState({}, '', '/');

        // Brief delay to show success state to user before navigating
        setTimeout(() => {
          onSuccess();
        }, SUCCESS_DISPLAY_DURATION_MS);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication failed';
        setErrorMessage(message);
        setStatus('error');

        // Clear the URL parameters
        window.history.replaceState({}, '', '/');

        onError(message);
      }
    }

    handleCallback();
  }, [onSuccess, onError]);

  return (
    <div className="fixed inset-0 bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full mx-4 text-center">
        {status === 'processing' && (
          <>
            <Loader className="w-12 h-12 mx-auto text-primary-600 animate-spin" />
            <h2 className="mt-4 text-xl font-semibold text-gray-900">
              Connecting to Google...
            </h2>
            <p className="mt-2 text-gray-500">Please wait while we complete the sign-in process.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">
              Successfully Connected!
            </h2>
            <p className="mt-2 text-gray-500">Your Google account is now linked to MediVault.</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">Connection Failed</h2>
            <p className="mt-2 text-red-600">{errorMessage}</p>
            <button
              onClick={() => window.location.href = '/'}
              className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium"
            >
              Return to App
            </button>
          </>
        )}
      </div>
    </div>
  );
}
