// background.js
import { initializeTokenManager } from './token-manager.js';

// Initialize token manager when extension loads
initializeTokenManager().catch(error => {
  console.error('Failed to initialize token manager:', error);
});

// Handle API requests from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "makeApiCall") {
    const { url, method, headers, body } = request;

    console.log("Making request to:", url);
    console.log("Headers:", headers);

    // Don't log sensitive body data in production
    if (process.env.NODE_ENV !== 'production') {
      console.log("Body:", body);
    }

    // Create fetch options to match curl as closely as possible
    const fetchOptions = {
      method: method || "GET",
      headers: headers || {},
    };

    // Only add body for non-GET requests
    if (method !== "GET" && body) {
      fetchOptions.body = JSON.stringify(body);
    }

    fetch(url, fetchOptions)
      .then((response) => {
        console.log("Response status:", response.status);

        // Check for auth errors
        if (response.status === 401 || response.status === 403) {
          // Notify that we may need to refresh token
          chrome.runtime.sendMessage({
            action: 'check-token'
          }).catch(() => {});
        }

        return response.text().then((text) => ({
          status: response.status,
          statusText: response.statusText,
          headers: [...response.headers.entries()].reduce(
            (obj, [key, value]) => {
              obj[key] = value;
              return obj;
            },
            {},
          ),
          body: text,
        }));
      })
      .then((data) => {
        console.log("Sending response back to content script");
        sendResponse({ success: true, data });
      })
      .catch((error) => {
        console.error("Fetch error:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Required to use sendResponse asynchronously
  }
});

// Listen for installation events
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First installation
    console.log('Extension installed');

    // Generate and store encryption key for token storage
    // This would be a good place to initialize the encryption key
    crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    ).then(key => {
      // Export the key to raw format
      return crypto.subtle.exportKey('raw', key);
    }).then(keyData => {
      // Store the key in local storage
      const keyArray = Array.from(new Uint8Array(keyData));
      chrome.storage.local.set({ 'auth_encryption_key': keyArray });
      console.log('Generated and stored new encryption key');
    }).catch(error => {
      console.error('Failed to generate encryption key:', error);
    });
  } else if (details.reason === 'update') {
    // Extension updated
    console.log('Extension updated from version', details.previousVersion, 'to', chrome.runtime.getManifest().version);
  }
});

// Handle authentication events
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'auth-state-changed') {
    // You can do things like update the badge or icon based on auth state
    if (message.isAuthenticated) {
      chrome.action.setBadgeText({ text: '✓' });
      chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' }); // Green
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
    sendResponse({ success: true });
    return true;
  }
});