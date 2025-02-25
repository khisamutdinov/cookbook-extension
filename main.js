// main.js
import {
  extractPageContent,
  processContent,
  showError,
} from "./extension-functions.js";

document.addEventListener("DOMContentLoaded", () => {
  // Add retry functionality
  const retryButton = document.getElementById("retry-button");
  retryButton.addEventListener("click", () => {
    location.reload();
  });
  // Show loading state immediately
  const statusElement = document.getElementById("status");
  const resultElement = document.getElementById("result");
  const errorElement = document.getElementById("error");

  statusElement.style.display = "block";
  resultElement.style.display = "none";
  errorElement.style.display = "none";

  // Check for required permissions
  chrome.permissions.contains(
    { permissions: ["scripting", "activeTab"] },
    (hasPermissions) => {
      if (!hasPermissions) {
        showError("Extension doesn't have required permissions");
        return;
      }

      // Get active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) {
          showError("No active tab found");
          return;
        }

        const activeTab = tabs[0];

        // Execute content script with error handling
        chrome.scripting.executeScript(
          {
            target: { tabId: activeTab.id },
            func: extractPageContent,
          },
          (results) => {
            if (chrome.runtime.lastError) {
              showError(
                `Script execution failed: ${chrome.runtime.lastError.message}`,
              );
              return;
            }

            if (!results || !results[0] || !results[0].result) {
              showError("Failed to extract page content");
              return;
            }

            const htmlContent = results[0].result;
            processContent(activeTab, htmlContent);
          },
        );
      });
    },
  );
});
