// token-manager.js - Background service for token management
// Import our token storage functionality
import {
  hasValidToken,
  getTokenTimeRemaining,
  refreshAccessToken,
  clearAuthData
} from './token-storage.js';

// Constants for token management
const ALARM_NAME = 'token-refresh-alarm';
const TOKEN_CHECK_INTERVAL = 15; // Check token every 15 minutes
const REFRESH_THRESHOLD = 5 * 60; // Refresh token if less than 5 minutes remaining

/**
 * Initialize token management when extension loads
 */
export async function initializeTokenManager() {
  console.log('Initializing token manager');

  // Set up periodic token check with alarms API
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: TOKEN_CHECK_INTERVAL
  });

  // Listen for the alarm
  chrome.alarms.onAlarm.addListener(handleTokenAlarm);

  // Do an initial token check
  await checkAndRefreshToken();
}

/**
 * Handle the token refresh alarm
 * @param {chrome.alarms.Alarm} alarm - The alarm that fired
 */
async function handleTokenAlarm(alarm) {
  if (alarm.name === ALARM_NAME) {
    console.log('Token refresh alarm triggered');
    await checkAndRefreshToken();
  }
}

/**
 * Check token validity and refresh if needed
 */
async function checkAndRefreshToken() {
  try {
    // Check if we have a valid token
    if (!await hasValidToken()) {
      console.log('No valid token found');
      return;
    }

    // Get time remaining before token expires
    const timeRemaining = await getTokenTimeRemaining();
    console.log(`Token expires in ${timeRemaining} seconds`);

    // If token is close to expiring, refresh it
    if (timeRemaining < REFRESH_THRESHOLD) {
      console.log('Token expiring soon, refreshing');
      const success = await refreshAccessToken();

      if (success) {
        console.log('Token refreshed successfully');
        // Notify any UI components that token was refreshed
        notifyTokenRefreshed();
      } else {
        console.warn('Token refresh failed');
        // If refresh fails, clear auth data to force re-login
        await clearAuthData();
        // Notify UI components that auth is invalid
        notifyAuthInvalid();
      }
    }
  } catch (error) {
    console.error('Error in token check/refresh:', error);
  }
}

/**
 * Notify UI that token was refreshed
 */
function notifyTokenRefreshed() {
  chrome.runtime.sendMessage({
    action: 'token-refreshed'
  }).catch(err => {
    // It's normal for this to fail if no listeners are registered
    console.log('No listeners for token refresh notification');
  });
}

/**
 * Notify UI that authentication is invalid
 */
function notifyAuthInvalid() {
  chrome.runtime.sendMessage({
    action: 'auth-invalid'
  }).catch(err => {
    // It's normal for this to fail if no listeners are registered
    console.log('No listeners for auth invalid notification');
  });
}

/**
 * Request an immediate token refresh
 * @returns {Promise<boolean>} Success indicator
 */
export async function requestTokenRefresh() {
  try {
    console.log('Manually requesting token refresh');
    const success = await refreshAccessToken();
    if (success) {
      notifyTokenRefreshed();
    }
    return success;
  } catch (error) {
    console.error('Manual token refresh failed:', error);
    return false;
  }
}

// Listen for messages from UI components
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'check-token') {
    checkAndRefreshToken()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required for async response
  }

  if (message.action === 'refresh-token') {
    requestTokenRefresh()
      .then(success => sendResponse({ success }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required for async response
  }
});