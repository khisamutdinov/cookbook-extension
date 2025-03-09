// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "makeApiCall") {
    const { url, method, headers, body } = request;

    console.log("Making request to:", url);
    console.log("Headers:", headers);
    console.log("Body:", body);

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

  // Handle auth token revocation on sign out
  else if (request.action === "revokeAuthToken" && request.token) {
    // Revoke the token with Google
    fetch(`https://accounts.google.com/o/oauth2/revoke?token=${request.token}`, {
      method: 'GET'
    })
    .then(response => {
      if (response.status === 200) {
        console.log("Token successfully revoked");
      } else {
        console.warn("Token revocation failed with status:", response.status);
      }
      sendResponse({ success: true });
    })
    .catch(error => {
      console.error("Failed to revoke token:", error);
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
  } else if (details.reason === 'update') {
    // Extension updated
    console.log('Extension updated from version', details.previousVersion, 'to', chrome.runtime.getManifest().version);
  }
});