// google-auth.js - OAuth integration using Chrome Identity API

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
    // Build the OAuth consent URL
    const authURL = new URL(AUTH_URL);
    authURL.searchParams.append('client_id', CLIENT_ID);
    authURL.searchParams.append('response_type', 'token');
    authURL.searchParams.append('redirect_uri', REDIRECT_URL);
    authURL.searchParams.append('scope', SCOPES.join(' '));

    // Launch the web auth flow
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authURL.toString(),
      interactive: true
    });

    // Extract the access token from the response URL
    const accessToken = extractAccessToken(responseUrl);

    // Get user data using the access token
    const userData = await fetchUserInfo(accessToken);

    // Store token in Chrome storage for persistence
    await storeAuthToken(accessToken, userData);

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
 * Extract access token from the redirect URL
 * @param {string} redirectUrl - The URL containing the access token
 * @returns {string} The access token
 */
function extractAccessToken(redirectUrl) {
  const tokenMatch = redirectUrl.match(/[#?](.*)/);
  if (tokenMatch && tokenMatch.length > 1) {
    const params = new URLSearchParams(tokenMatch[1].replace('#', '?'));
    return params.get('access_token');
  }
  throw new Error('Failed to extract access token from redirect URL');
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
 * Store authentication data in Chrome storage
 * @param {string} token - The OAuth access token
 * @param {Object} userData - User profile data
 */
async function storeAuthToken(token, userData) {
  await chrome.storage.local.set({
    'auth_token': token,
    'auth_user': userData,
    'auth_time': Date.now()
  });
}

/**
 * Load authentication data from Chrome storage
 * @returns {Promise<Object|null>} Authentication data or null
 */
export async function loadAuthData() {
  const data = await chrome.storage.local.get(['auth_token', 'auth_user', 'auth_time']);

  if (data.auth_token && data.auth_user) {
    // Check if token has expired (tokens typically last 1 hour)
    const tokenAge = Date.now() - (data.auth_time || 0);
    const TOKEN_LIFETIME = 3600 * 1000; // 1 hour in milliseconds

    if (tokenAge < TOKEN_LIFETIME) {
      currentUser = data.auth_user;
      notifyListeners(currentUser);
      return data;
    } else {
      // Token expired, clear storage
      await chrome.storage.local.remove(['auth_token', 'auth_user', 'auth_time']);
    }
  }

  return null;
}

/**
 * Sign out the current user
 * @returns {Promise<void>}
 */
export async function signOut() {
  await chrome.storage.local.remove(['auth_token', 'auth_user', 'auth_time']);
  currentUser = null;
  notifyListeners(null);
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
  const data = await chrome.storage.local.get(['auth_token']);
  if (!data.auth_token) {
    throw new Error("No authentication token available");
  }
  return data.auth_token;
}

// Initialize: Try to load auth data from storage when the module loads
loadAuthData().catch(error => {
  console.error('Failed to load authentication data:', error);
});