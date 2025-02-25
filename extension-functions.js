// extension-functions.js
export function extractPageContent() {
  try {
    console.log("CEX: Processing html...");
    const cloneDoc = document.cloneNode(true).documentElement;

    // Remove non-content elements
    const nonContentElements = cloneDoc.querySelectorAll(
      "script, style, link, meta, noscript",
    );
    nonContentElements.forEach((el) => el.remove());

    // Remove all inline styles and attributes
    cloneDoc.querySelectorAll("*").forEach((el) => {
      el.removeAttribute("style");
      el.removeAttribute("class");
      el.removeAttribute("id");
    });

    // Special handling for images
    cloneDoc.querySelectorAll("img").forEach((img) => {
      const altText = img.alt ? img.alt : "No alt text";
      img.replaceWith(document.createTextNode(`[Image: ${altText}]`));
    });

    console.log("CEX: HTML is ready");
    // console.log(cloneDoc.outerHTML);
    return cloneDoc.outerHTML;
  } catch (error) {
    console.error("Error in content script:", error);
    return null;
  }
}

export async function processContent(tab, htmlContent) {
  const token = "";
  const extensionId = chrome.runtime.id;
  const requestId = `${extensionId}-${Date.now()}`;

  // First try the health endpoint to verify token works
  try {
    // Test with health endpoint first
    const healthResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: "makeApiCall",
          url: "https://cookbook-577683305271.us-west1.run.app/actuator/info",
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Extension-ID": extensionId,
            "X-Request-ID": requestId,
          },
        },
        resolve,
      );
    });

    console.log("Health check response:", healthResponse);

    // Now try the recipe endpoint
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: "makeApiCall",
          url: "https://cookbook-577683305271.us-west1.run.app/recipe",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-Extension-ID": extensionId,
            "X-Request-ID": requestId,
          },
          body: {
            url: tab.url,
            html: htmlContent,
            title: tab.title,
          },
        },
        resolve,
      );
    });

    console.log("Recipe endpoint response:", response);

    if (!response.success) {
      throw new Error(response.error || "Recipe request failed");
    }

    const { data } = response;

    if (data.status !== 200) {
      throw new Error(
        `API request failed (${data.status}): ${data.body || "Unknown error"}`,
      );
    }

    // Parse JSON response
    let jsonData;
    try {
      jsonData = JSON.parse(data.body);
    } catch (e) {
      console.error("Failed to parse JSON:", e);
      throw new Error("Invalid response format");
    }

    showResult(jsonData);
  } catch (error) {
    console.error("API call error details:", error);
    showError(error.message);
  }
}

export function showResult(data) {
  const statusElement = document.getElementById("status");
  const resultElement = document.getElementById("result");
  const errorElement = document.getElementById("error");

  statusElement.style.display = "none";
  errorElement.style.display = "none";
  resultElement.style.display = "block";

  const resultContent = document.getElementById("result-content");
  resultContent.innerHTML = ""; // Clear previous content

  // Add result using DOM methods instead of innerHTML
  resultContent.appendChild(formatJson(data));
}

export function showError(message) {
  const statusElement = document.getElementById("status");
  const resultElement = document.getElementById("result");
  const errorElement = document.getElementById("error");
  const retryButton = document.getElementById("retry-button");

  statusElement.style.display = "none";
  resultElement.style.display = "none";
  errorElement.textContent = `Error: ${message}`;
  errorElement.style.display = "block";
  retryButton.style.display = "block";
}

export function formatJson(obj) {
  const div = document.createElement("div");

  if (typeof obj === "object" && obj !== null) {
    Object.entries(obj).forEach(([key, value]) => {
      const entryDiv = document.createElement("div");
      entryDiv.className = "json-entry";

      const keySpan = document.createElement("span");
      keySpan.className = "json-key";
      keySpan.textContent = `${key}: `;

      const valueSpan = document.createElement("span");
      valueSpan.className = "json-value";
      valueSpan.appendChild(formatJson(value));

      entryDiv.appendChild(keySpan);
      entryDiv.appendChild(valueSpan);
      div.appendChild(entryDiv);
    });
  } else {
    const valueSpan = document.createElement("span");
    valueSpan.className = typeof obj;
    valueSpan.textContent = typeof obj === "string" ? obj : JSON.stringify(obj);
    div.appendChild(valueSpan);
  }

  return div;
}
