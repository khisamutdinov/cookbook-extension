// google-auth.js - OAuth integration using Chrome Identity API with secure token storage

import {
  storeAuthTokens,
  getAccessToken,
  getUserData,
  hasValidToken,
  clearAuthData,
  refreshAccessToken,
  setupTokenRefresh
} from './token-storage.js';

// Store the authenticated user info
let currentUser = null;
let authListeners = [];

// Your OAuth client ID from Google Developer Console
// Replace this with your actual client ID
const CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
// Google API scopes we need
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];
// Authentication URL
const AUTH_URL = 'https://accounts.google.com/o/oauth2/auth';
// Token URL for refresh flow
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
// Redirect URL must match one registered in the Google Developer Console
const REDIRECT_URL = chrome.identity.getRedirectURL();

/**
 * Subscribe to auth state changes
 * @param {Function} listener - Callback function that receives the user object
 * @returns {Function} Unsubscribe function
 */
export function onAuthStateChanged(listener) {
  authListeners.push(listener);

  // Immediately notify with current state
  listener(currentUser);

  // Return unsubscribe function
  return () => {
    authListeners = authListeners.filter(l => l !== listener);
  };
}

/**
 * Notify all auth state listeners
 * @param {Object|null} user
 */
function notifyListeners(user) {
  authListeners.forEach(listener => listener(user));
}

/**
 * Sign in with Google using Chrome Identity API
 * @returns {Promise<Object>} User data
 */
export async function signInWithGoogle() {
  try {
    // Check if we already have a valid token
    if (await hasValidToken()) {
      // Get cached user data
      const userData = await getUserData();
      if (userData) {
        currentUser = userData;
        notifyListeners(currentUser);
        return userData;
      }
    }

    // Build the OAuth consent URL
    const authURL = new URL(AUTH_URL);
    authURL.searchParams.append('client_id', CLIENT_ID);
    authURL.searchParams.append('response_type', 'code');
    authURL.searchParams.append('redirect_uri', REDIRECT_URL);
    authURL.searchParams.append('scope', SCOPES.join(' '));
    // Add offline access to get a refresh token
    authURL.searchParams.append('access_type', 'offline');
    // Force approval prompt to ensure we get a refresh token
    authURL.searchParams.append('prompt', 'consent');

    // Launch the web auth flow
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authURL.toString(),
      interactive: true
    });

    // Extract the authorization code from the response URL
    const code = extractAuthCode(responseUrl);

    // Exchange the code for tokens
    const tokenResponse = await exchangeCodeForTokens(code);

    // Get user data using the access token
    const userData = await fetchUserInfo(tokenResponse.access_token);

    // Store tokens securely
    await storeAuthTokens(
      tokenResponse.access_token,
      tokenResponse.refresh_token,
      tokenResponse.id_token,
      userData,
      tokenResponse.expires_in
    );

    // Setup token refresh
    await setupTokenRefresh();

    // Update current user and notify listeners
    currentUser = userData;
    notifyListeners(currentUser);

    return userData;
  } catch (error) {
    console.error('Authentication error:', error);
    throw new Error('Failed to authenticate with Google');
  }
}

/**
 * Extract authorization code from the redirect URL
 * @param {string} redirectUrl - The URL containing the code
 * @returns {string} The authorization code
 */
function extractAuthCode(redirectUrl) {
  const url = new URL(redirectUrl);
  const code = url.searchParams.get('code');
  if (!code) {
    throw new Error('Failed to extract authorization code from redirect URL');
  }
  return code;
}

/**
 * Exchange authorization code for access and refresh tokens
 * @param {string} code - The authorization code
 * @returns {Promise<Object>} Token response
 */
async function exchangeCodeForTokens(code) {
  const tokenRequestBody = new URLSearchParams({
    code: code,
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URL,
    grant_type: 'authorization_code'
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: tokenRequestBody.toString()
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Token exchange failed: ${errorData.error || response.statusText}`);
  }

  return await response.json();
}

/**
 * Fetch user information from Google API using the access token
 * @param {string} accessToken - The OAuth access token
 * @returns {Promise<Object>} User profile data
 */
async function fetchUserInfo(accessToken) {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }

  const userInfo = await response.json();
  return {
    id: userInfo.id,
    name: userInfo.name,
    email: userInfo.email,
    avatar: userInfo.picture
  };
}

/**
 * Sign out the current user
 * @returns {Promise<void>}
 */
export async function signOut() {
  try {
    // Get the access token
    const token = await getAccessToken().catch(() => null);

    // Clear stored auth data
    await clearAuthData();

    // If we have a token, revoke it with Google
    if (token) {
      // Revoke token - we do this even if it fails
      try {
        await revokeToken(token);
      } catch (error) {
        console.warn('Failed to revoke token:', error);
      }
    }

    // Update state
    currentUser = null;
    notifyListeners(null);
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

/**
 * Revoke an access token with Google
 * @param {string} token - The access token to revoke
 * @returns {Promise<void>}
 */
async function revokeToken(token) {
  const response = await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`, {
    method: 'GET'
  });

  if (!response.ok) {
    throw new Error('Failed to revoke token');
  }
}

/**
 * Load authentication state from secure storage
 * @returns {Promise<void>}
 */
export async function loadAuthState() {
  try {
    // Check if we have a valid token
    if (await hasValidToken()) {
      // Get user data
      const userData = await getUserData();
      if (userData) {
        currentUser = userData;
        notifyListeners(currentUser);

        // Setup token refresh
        await setupTokenRefresh();
        return true;
      }
    } else if (await getUserData()) {
      // We have user data but token is expired, try to refresh
      const success = await refreshAccessToken();
      if (success) {
        const userData = await getUserData();
        currentUser = userData;
        notifyListeners(currentUser);
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Failed to load auth state:', error);
    return false;
  }
}

/**
 * Get the current authenticated user
 * @returns {Object|null} Current user or null if not authenticated
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Check if a user is signed in
 * @returns {boolean}
 */
export function isAuthenticated() {
  return currentUser !== null;
}

/**
 * Get auth token for API requests
 * @returns {Promise<string>} Access token
 */
export async function getAuthToken() {
  try {
    return await getAccessToken();
  } catch (error) {
    console.error('Failed to get auth token:', error);
    throw new Error('Authentication token unavailable');
  }
}

// Initialize: Try to load auth state when the module loads
loadAuthState().catch(error => {
  console.error('Failed to initialize authentication:', error);
});