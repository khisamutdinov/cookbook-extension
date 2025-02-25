// background.js - Match curl exactly
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
});
