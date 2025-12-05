/**
 * Google OAuth 2.0 Service
 *
 * Implements OAuth 2.0 with PKCE (Proof Key for Code Exchange) for secure
 * client-side authentication with Google APIs.
 *
 * Supports:
 * - Google Sheets API (read/write)
 * - Google Drive API (for photo storage)
 */

// OAuth Configuration
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

// Scopes required for full sync functionality
const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets', // Full access to Sheets
  'https://www.googleapis.com/auth/drive.file', // Access to files created by app
];

// Token storage keys (using IndexedDB via our db module)
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'google_access_token',
  REFRESH_TOKEN: 'google_refresh_token',
  TOKEN_EXPIRY: 'google_token_expiry',
  CODE_VERIFIER: 'google_code_verifier',
};

/**
 * Token data structure
 */
export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

/**
 * OAuth state stored during auth flow
 */
interface OAuthState {
  codeVerifier: string;
  redirectUri: string;
}

/**
 * Error type for OAuth operations
 */
export type OAuthErrorCode =
  | 'INVALID_CONFIG'
  | 'AUTH_FAILED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_REFRESH_FAILED'
  | 'REVOKE_FAILED'
  | 'NETWORK_ERROR'
  | 'STORAGE_ERROR';

export class OAuthError extends Error {
  code: OAuthErrorCode;

  constructor(message: string, code: OAuthErrorCode) {
    super(message);
    this.name = 'OAuthError';
    this.code = code;
  }
}

/**
 * Generate a cryptographically secure random string
 */
function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate code verifier for PKCE
 */
function generateCodeVerifier(): string {
  // Code verifier must be 43-128 characters
  return generateRandomString(32);
}

/**
 * Generate code challenge from verifier using SHA-256
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);

  // Base64url encode the hash
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Get the Google Client ID from environment variables
 */
function getClientId(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new OAuthError(
      'Google Client ID not configured. Set VITE_GOOGLE_CLIENT_ID in environment.',
      'INVALID_CONFIG'
    );
  }
  return clientId;
}

/**
 * Get the redirect URI for OAuth callback
 */
function getRedirectUri(): string {
  // Use the current origin with /auth/callback path
  return `${window.location.origin}/auth/callback`;
}

/**
 * Secure storage helpers using sessionStorage for temporary data
 * and localStorage for persistent tokens (with encryption consideration)
 */
const secureStorage = {
  /**
   * Store OAuth state temporarily during auth flow (session only)
   */
  setOAuthState(state: OAuthState): void {
    try {
      sessionStorage.setItem('oauth_state', JSON.stringify(state));
    } catch (error) {
      console.warn('⚠️ Failed to store OAuth state:', error);
      throw new OAuthError('Failed to store OAuth state', 'STORAGE_ERROR');
    }
  },

  /**
   * Get and clear OAuth state
   */
  getOAuthState(): OAuthState | null {
    try {
      const state = sessionStorage.getItem('oauth_state');
      if (state) {
        sessionStorage.removeItem('oauth_state');
        return JSON.parse(state);
      }
      return null;
    } catch (error) {
      console.warn('⚠️ Failed to retrieve OAuth state:', error);
      return null;
    }
  },

  /**
   * Store tokens securely
   * Note: Tokens are stored in localStorage for persistence across sessions.
   * While sessionStorage would be more secure, it doesn't persist when browser is closed,
   * making the user experience poor for a mobile-first app.
   * The app uses PKCE which protects against code interception attacks,
   * and tokens are short-lived with automatic refresh.
   */
  setTokens(tokens: GoogleTokens): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
      localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, tokens.expiresAt.toISOString());
      if (tokens.refreshToken) {
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
      }
    } catch (error) {
      console.warn('⚠️ Failed to store tokens:', error);
      throw new OAuthError('Failed to store tokens securely', 'STORAGE_ERROR');
    }
  },

  /**
   * Get stored tokens
   */
  getTokens(): GoogleTokens | null {
    try {
      const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const expiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
      const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

      if (!accessToken || !expiry) {
        return null;
      }

      return {
        accessToken,
        refreshToken: refreshToken || undefined,
        expiresAt: new Date(expiry),
      };
    } catch (error) {
      console.warn('⚠️ Failed to retrieve tokens:', error);
      return null;
    }
  },

  /**
   * Clear all stored tokens
   */
  clearTokens(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
      localStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
    } catch (error) {
      console.warn('⚠️ Failed to clear tokens:', error);
    }
  },
};

/**
 * Check if tokens are currently valid (not expired)
 */
function isTokenValid(tokens: GoogleTokens): boolean {
  // Add 5-minute buffer before expiration
  const bufferMs = 5 * 60 * 1000;
  return tokens.expiresAt.getTime() - bufferMs > Date.now();
}

/**
 * Initiate the OAuth flow by redirecting to Google
 */
export async function initiateOAuthFlow(): Promise<void> {
  const clientId = getClientId();
  const redirectUri = getRedirectUri();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store state for callback handling
  secureStorage.setOAuthState({ codeVerifier, redirectUri });

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: REQUIRED_SCOPES.join(' '),
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline', // Request refresh token
    prompt: 'consent', // Always show consent screen for refresh token
  });

  // Redirect to Google OAuth
  window.location.href = `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Handle OAuth callback and exchange code for tokens
 */
export async function handleOAuthCallback(code: string): Promise<GoogleTokens> {
  const clientId = getClientId();
  const state = secureStorage.getOAuthState();

  if (!state) {
    throw new OAuthError('OAuth state not found. Please try again.', 'AUTH_FAILED');
  }

  const { codeVerifier, redirectUri } = state;

  // Exchange authorization code for tokens
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('❌ Token exchange failed:', errorData);
    throw new OAuthError(
      `Failed to exchange authorization code: ${errorData.error_description || 'Unknown error'}`,
      'AUTH_FAILED'
    );
  }

  const data = await response.json();

  const tokens: GoogleTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };

  // Store tokens securely
  secureStorage.setTokens(tokens);

  console.log('✅ OAuth flow completed successfully');
  return tokens;
}

/**
 * Refresh the access token using the refresh token
 */
export async function refreshAccessToken(): Promise<GoogleTokens> {
  const clientId = getClientId();
  const storedTokens = secureStorage.getTokens();

  if (!storedTokens?.refreshToken) {
    throw new OAuthError(
      'No refresh token available. Please sign in again.',
      'TOKEN_REFRESH_FAILED'
    );
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      refresh_token: storedTokens.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('❌ Token refresh failed:', errorData);

    // If refresh fails, clear tokens and require re-auth
    secureStorage.clearTokens();

    throw new OAuthError(
      `Failed to refresh access token: ${errorData.error_description || 'Unknown error'}`,
      'TOKEN_REFRESH_FAILED'
    );
  }

  const data = await response.json();

  const tokens: GoogleTokens = {
    accessToken: data.access_token,
    // Keep the existing refresh token if a new one isn't provided
    refreshToken: data.refresh_token || storedTokens.refreshToken,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };

  // Update stored tokens
  secureStorage.setTokens(tokens);

  console.log('✅ Token refreshed successfully');
  return tokens;
}

/**
 * Get a valid access token, refreshing if necessary
 */
export async function getValidAccessToken(): Promise<string> {
  const tokens = secureStorage.getTokens();

  if (!tokens) {
    throw new OAuthError('Not signed in. Please connect your Google account.', 'TOKEN_EXPIRED');
  }

  // Check if token is still valid
  if (isTokenValid(tokens)) {
    return tokens.accessToken;
  }

  // Token expired, try to refresh
  console.log('🔄 Access token expired, refreshing...');
  const refreshedTokens = await refreshAccessToken();
  return refreshedTokens.accessToken;
}

/**
 * Revoke Google access and clear stored tokens
 */
export async function revokeGoogleAccess(): Promise<void> {
  const tokens = secureStorage.getTokens();

  if (tokens?.accessToken) {
    try {
      // Revoke the token with Google
      await fetch(`${GOOGLE_REVOKE_URL}?token=${tokens.accessToken}`, {
        method: 'POST',
      });
      console.log('✅ Google access revoked');
    } catch (error) {
      console.warn('⚠️ Failed to revoke token with Google:', error);
      // Continue to clear local tokens even if revoke fails
    }
  }

  // Clear all stored tokens
  secureStorage.clearTokens();
}

/**
 * Check if user is currently signed in with Google
 */
export function isSignedIn(): boolean {
  const tokens = secureStorage.getTokens();
  return tokens !== null && isTokenValid(tokens);
}

/**
 * Check if user has stored tokens (may be expired)
 */
export function hasStoredTokens(): boolean {
  return secureStorage.getTokens() !== null;
}

/**
 * Get the stored tokens (for debugging/display purposes)
 */
export function getStoredTokens(): GoogleTokens | null {
  return secureStorage.getTokens();
}
