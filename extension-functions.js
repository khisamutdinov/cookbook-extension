// extension-functions.js
import { getAuthToken } from "./google-auth.js";

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
    return cloneDoc.outerHTML;
  } catch (error) {
    console.error("Error in content script:", error);
    return null;
  }
}

export async function processContent(tab, htmlContent) {
  const extensionId = chrome.runtime.id;
  const requestId = `${extensionId}-${Date.now()}`;

  try {
    // Get authentication token
    const token = await getAuthToken();
    console.log("Got auth token for API request");

    // Compress the HTML content before sending
    const compressedHtml = await compressHtml(htmlContent);

    // Make the API request
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: "makeApiCall",
          url: "https://cookbook-577683305271.us-west1.run.app/recipe",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "X-Extension-ID": extensionId,
            "X-Request-ID": requestId,
          },
          body: {
            url: tab.url,
            html: compressedHtml,
            title: tab.title,
          },
        },
        resolve,
      );
    });

    console.log("Recipe endpoint response:", response);

    if (!response.success) {
      if (response.error && response.error.includes("authentication")) {
        throw new Error("Authentication error. Please sign in again.");
      } else {
        throw new Error(response.error || "Recipe request failed");
      }
    }

    const { data } = response;

    if (data.status === 401 || data.status === 403) {
      throw new Error("Authentication error. Please sign in again.");
    }

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

// Add this function to extension-functions.js
export async function compressHtml(htmlContent) {
  // Convert to UTF-8 string
  const encoder = new TextEncoder();
  const data = encoder.encode(htmlContent);

  // Compress using CompressionStream (GZIP)
  const compressedStream = new Blob([data])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));

  // Convert compressed stream to Blob
  const compressedBlob = await new Response(compressedStream).blob();

  // Convert Blob to Base64
  const base64 = await blobToBase64(compressedBlob);

  console.log(`Original size: ${htmlContent.length} bytes`);
  console.log(`Compressed size: ${base64.length} bytes`);
  console.log(
    `Compression ratio: ${((base64.length / htmlContent.length) * 100).toFixed(2)}%`,
  );

  return base64;
}

// Helper function to convert Blob to Base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Remove the "data:application/octet-stream;base64," part
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}