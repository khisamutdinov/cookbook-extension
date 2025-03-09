// token-storage.js - Secure token storage and management

let ENCRYPTION_KEY;

// Get encryption key from storage
chrome.storage.local.get(['auth_encryption_key'], (result) => {
  if (result.auth_encryption_key) {
    ENCRYPTION_KEY = new Uint8Array(result.auth_encryption_key);
  } else {
    console.error('No encryption key found');
    throw new Error('Missing encryption key');
  }
});

/**
 * Token storage keys
 */
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  ID_TOKEN: 'auth_id_token',
  USER_DATA: 'auth_user_data',
  EXPIRATION: 'auth_token_expiration',
  ENCRYPTION_IV: 'auth_encryption_iv',
};

/**
 * Store an authentication token securely
 * @param {string} accessToken - OAuth access token
 * @param {string} refreshToken - OAuth refresh token (if available)
 * @param {string} idToken - OAuth ID token (if available)
 * @param {Object} userData - User profile data
 * @param {number} expiresIn - Token expiration time in seconds
 * @returns {Promise<void>}
 */
export async function storeAuthTokens(accessToken, refreshToken, idToken, userData, expiresIn) {
  try {
    // Generate random initialization vector for encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Calculate expiration timestamp
    const expirationTime = Date.now() + (expiresIn * 1000);

    // Prepare data for storage
    const storageData = {
      [STORAGE_KEYS.ACCESS_TOKEN]: await encryptData(accessToken, iv),
      [STORAGE_KEYS.EXPIRATION]: expirationTime,
      [STORAGE_KEYS.USER_DATA]: await encryptData(JSON.stringify(userData), iv),
      [STORAGE_KEYS.ENCRYPTION_IV]: Array.from(iv)  // Store IV for decryption
    };

    // Store refresh token if available
    if (refreshToken) {
      storageData[STORAGE_KEYS.REFRESH_TOKEN] = await encryptData(refreshToken, iv);
    }

    // Store ID token if available
    if (idToken) {
      storageData[STORAGE_KEYS.ID_TOKEN] = await encryptData(idToken, iv);
    }

    // Save to Chrome storage
    await chrome.storage.local.set(storageData);

    console.log('Authentication tokens stored securely');
  } catch (error) {
    console.error('Failed to store authentication tokens:', error);
    throw error;
  }
}

/**
 * Retrieve the stored access token
 * @returns {Promise<string>} The decrypted access token
 */
export async function getAccessToken() {
  try {
    const data = await chrome.storage.local.get([
      STORAGE_KEYS.ACCESS_TOKEN,
      STORAGE_KEYS.EXPIRATION,
      STORAGE_KEYS.ENCRYPTION_IV
    ]);

    // Check if token exists
    if (!data[STORAGE_KEYS.ACCESS_TOKEN]) {
      throw new Error('No access token found');
    }

    // Check if token is expired
    if (Date.now() > data[STORAGE_KEYS.EXPIRATION]) {
      // Try to refresh the token
      const newToken = await refreshAccessToken();
      if (newToken) {
        return newToken;
      }
      throw new Error('Token expired and refresh failed');
    }

    // Decrypt and return the token
    const iv = new Uint8Array(data[STORAGE_KEYS.ENCRYPTION_IV]);
    return await decryptData(data[STORAGE_KEYS.ACCESS_TOKEN], iv);
  } catch (error) {
    console.error('Failed to get access token:', error);
    throw error;
  }
}

/**
 * Retrieve user data stored with the token
 * @returns {Promise<Object>} The user data object
 */
export async function getUserData() {
  try {
    const data = await chrome.storage.local.get([
      STORAGE_KEYS.USER_DATA,
      STORAGE_KEYS.ENCRYPTION_IV
    ]);

    if (!data[STORAGE_KEYS.USER_DATA]) {
      return null;
    }

    const iv = new Uint8Array(data[STORAGE_KEYS.ENCRYPTION_IV]);
    const userData = await decryptData(data[STORAGE_KEYS.USER_DATA], iv);
    return JSON.parse(userData);
  } catch (error) {
    console.error('Failed to get user data:', error);
    return null;
  }
}

/**
 * Check if the current token is valid
 * @returns {Promise<boolean>} True if a valid token exists
 */
export async function hasValidToken() {
  try {
    const data = await chrome.storage.local.get([
      STORAGE_KEYS.ACCESS_TOKEN,
      STORAGE_KEYS.EXPIRATION
    ]);

    return !!(data[STORAGE_KEYS.ACCESS_TOKEN] && Date.now() < data[STORAGE_KEYS.EXPIRATION]);
  } catch (error) {
    console.error('Error checking token validity:', error);
    return false;
  }
}

/**
 * Get remaining time until token expiration in seconds
 * @returns {Promise<number>} Seconds until expiration (0 if expired)
 */
export async function getTokenTimeRemaining() {
  try {
    const data = await chrome.storage.local.get([STORAGE_KEYS.EXPIRATION]);

    if (!data[STORAGE_KEYS.EXPIRATION]) {
      return 0;
    }

    const remaining = data[STORAGE_KEYS.EXPIRATION] - Date.now();
    return Math.max(0, Math.floor(remaining / 1000));
  } catch (error) {
    console.error('Error getting token time remaining:', error);
    return 0;
  }
}

/**
 * Clear all stored authentication data
 * @returns {Promise<void>}
 */
export async function clearAuthData() {
  try {
    await chrome.storage.local.remove(Object.values(STORAGE_KEYS));
    console.log('Authentication data cleared');
  } catch (error) {
    console.error('Failed to clear authentication data:', error);
    throw error;
  }
}

/**
 * Refresh the access token using the refresh token
 * @returns {Promise<string|null>} New access token or null if refresh failed
 */
export async function refreshAccessToken() {
  try {
    // Get the refresh token
    const data = await chrome.storage.local.get([
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.ENCRYPTION_IV
    ]);

    if (!data[STORAGE_KEYS.REFRESH_TOKEN]) {
      console.error('No refresh token available');
      return null;
    }

    const iv = new Uint8Array(data[STORAGE_KEYS.ENCRYPTION_IV]);
    const refreshToken = await decryptData(data[STORAGE_KEYS.REFRESH_TOKEN], iv);

    // Make the token refresh request
    // Note: This is a placeholder for the actual token refresh implementation
    // In a real app, you would call your token endpoint or use OAuth library

    // For demonstration, we'll simulate a token refresh request
    const response = await simulateTokenRefresh(refreshToken);

    if (response.success) {
      // Store the new tokens
      await storeAuthTokens(
        response.accessToken,
        response.refreshToken || refreshToken, // Use new refresh token if provided
        response.idToken || null,
        response.userData,
        response.expiresIn
      );

      return response.accessToken;
    } else {
      console.error('Token refresh failed:', response.error);
      return null;
    }
  } catch (error) {
    console.error('Failed to refresh access token:', error);
    return null;
  }
}

/**
 * Encrypt data using AES-GCM
 * @param {string} data - Data to encrypt
 * @param {Uint8Array} iv - Initialization vector
 * @returns {Promise<string>} Base64 encoded encrypted data
 */
async function encryptData(data, iv) {
  try {
    // Convert the data to an ArrayBuffer
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    // Import the encryption key
    const key = await crypto.subtle.importKey(
      'raw',
      ENCRYPTION_KEY,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // Encrypt the data
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      dataBuffer
    );

    // Convert the encrypted data to Base64
    return arrayBufferToBase64(encryptedBuffer);
  } catch (error) {
    console.error('Encryption failed:', error);
    throw error;
  }
}

/**
 * Decrypt data using AES-GCM
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @param {Uint8Array} iv - Initialization vector
 * @returns {Promise<string>} Decrypted data
 */
async function decryptData(encryptedData, iv) {
  try {
    // Convert the Base64 data to an ArrayBuffer
    const encryptedBuffer = base64ToArrayBuffer(encryptedData);

    // Import the encryption key
    const key = await crypto.subtle.importKey(
      'raw',
      ENCRYPTION_KEY,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Decrypt the data
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encryptedBuffer
    );

    // Convert the decrypted data to a string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw error;
  }
}

/**
 * Convert an ArrayBuffer to a Base64 string
 * @param {ArrayBuffer} buffer - ArrayBuffer to convert
 * @returns {string} Base64 string
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert a Base64 string to an ArrayBuffer
 * @param {string} base64 - Base64 string to convert
 * @returns {ArrayBuffer} Resulting ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Simulate a token refresh request for demonstration
 * In a real implementation, this would be a call to your OAuth server
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<Object>} Response with new tokens or error
 */
async function simulateTokenRefresh(refreshToken) {
  return new Promise((resolve) => {
    // Simulate network delay
    setTimeout(() => {
      // 80% success rate for testing
      if (Math.random() < 0.8) {
        resolve({
          success: true,
          accessToken: 'new_access_token_' + Date.now(),
          refreshToken: 'new_refresh_token_' + Date.now(), // Sometimes refresh tokens also rotate
          idToken: 'new_id_token_' + Date.now(),
          expiresIn: 3600, // 1 hour
          userData: {
            id: 'user123',
            name: 'Test User',
            email: 'testuser@example.com',
            avatar: 'https://ui-avatars.com/api/?name=Test+User&background=4285F4&color=fff'
          }
        });
      } else {
        resolve({
          success: false,
          error: 'Failed to refresh token'
        });
      }
    }, 1000);
  });
}

// Check for token expiration and setup auto-refresh
export async function setupTokenRefresh() {
  const timeRemaining = await getTokenTimeRemaining();
  if (timeRemaining > 0) {
    // If token expires in less than 5 minutes, refresh now
    if (timeRemaining < 300) {
      console.log('Token expiring soon, refreshing now');
      await refreshAccessToken();
    } else {
      // Schedule a refresh for 5 minutes before expiration
      const refreshTime = timeRemaining - 300;
      console.log(`Scheduling token refresh in ${refreshTime} seconds`);

      // Schedule refresh using chrome.alarms
      chrome.alarms.create('manual-token-refresh', {
        delayInMinutes: Math.max(1, refreshTime / 60) // Minimum 1 minute
      });
    }
  }
}

// Initialize token management when module loads
(async function initTokenManagement() {
  try {
    // Setup token refresh if we have a valid token
    if (await hasValidToken()) {
      await setupTokenRefresh();
    }
  } catch (error) {
    console.error('Failed to initialize token management:', error);
  }
})();
