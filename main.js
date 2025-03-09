// main.js
import {
  extractPageContent,
  processContent,
  showError,
} from "./extension-functions.js";

import {
  onAuthStateChanged,
  signInWithGoogle,
  signOut,
  isAuthenticated,
  loadAuthData
} from "./google-auth.js";

// DOM Elements we'll need to reference
let authRequiredElement;
let contentContainerElement;
let authContainerElement;
let signInButton;
let authErrorElement;
let statusElement;
let resultElement;
let errorElement;
let retryButton;
let tokenRefreshNotification;

document.addEventListener("DOMContentLoaded", async () => {
  // Get references to DOM elements
  authRequiredElement = document.getElementById("auth-required");
  contentContainerElement = document.getElementById("content-container");
  authContainerElement = document.getElementById("auth-container");
  signInButton = document.getElementById("sign-in-button");
  authErrorElement = document.getElementById("auth-error");
  statusElement = document.getElementById("status");
  resultElement = document.getElementById("result");
  errorElement = document.getElementById("error");
  retryButton = document.getElementById("retry-button");
  tokenRefreshNotification = document.getElementById("token-refresh-notification");

  // Set up event listeners
  signInButton.addEventListener("click", handleSignIn);
  retryButton.addEventListener("click", () => {
    location.reload();
  });

  // Listen for token refresh events from background script
  chrome.runtime.onMessage.addListener(handleBackgroundMessages);

  // Initialize auth state
  showLoadingState("Checking authentication...");
  try {
    // Try to load existing auth data
    await loadAuthState();
    // Set up auth state listener
    onAuthStateChanged(handleAuthStateChanged);
  } catch (error) {
    console.error("Failed to initialize authentication:", error);
    showUnauthenticatedUI();
  }
});

/**
 * Handle messages from background script
 */
function handleBackgroundMessages(message, sender, sendResponse) {
  if (message.action === 'token-refreshed') {
    // Show a notification that token was refreshed
    showTokenRefreshNotification("Authentication refreshed automatically");
    sendResponse({ received: true });
    return true;
  }

  if (message.action === 'auth-invalid') {
    // Authentication is invalid, force re-login
    showError("Your session has expired. Please sign in again.");
    signOut().catch(console.error);
    sendResponse({ received: true });
    return true;
  }
}

/**
 * Show a temporary notification for token refresh
 * @param {string} message - The notification message
 */
function showTokenRefreshNotification(message) {
  if (!tokenRefreshNotification) return;

  tokenRefreshNotification.textContent = message;
  tokenRefreshNotification.style.display = "block";

  // Hide after 5 seconds
  setTimeout(() => {
    tokenRefreshNotification.style.display = "none";
  }, 5000);
}

/**
 * Handle authentication state changes
 * @param {Object|null} user - The authenticated user or null
 */
function handleAuthStateChanged(user) {
  if (user) {
    // User is authenticated
    showAuthenticatedUI(user);
    initRecipeExtraction();

    // Notify background script of auth state change
    chrome.runtime.sendMessage({
      action: 'auth-state-changed',
      isAuthenticated: true
    }).catch(error => {
      console.error('Failed to notify background of auth state:', error);
    });
  } else {
    // User is not authenticated
    showUnauthenticatedUI();

    // Notify background script of auth state change
    chrome.runtime.sendMessage({
      action: 'auth-state-changed',
      isAuthenticated: false
    }).catch(error => {
      console.error('Failed to notify background of auth state:', error);
    });
  }
}

/**
 * Display temporary loading state
 * @param {string} message - Loading message to display
 */
function showLoadingState(message) {
  authRequiredElement.style.display = "none";
  contentContainerElement.style.display = "none";

  const loadingElement = document.createElement("div");
  loadingElement.id = "auth-loading";
  loadingElement.className = "auth-loading";
  loadingElement.innerHTML = `
    <div class="spinner"></div>
    <p>${message}</p>
  `;

  // Remove existing loading element if it exists
  const existingLoadingElement = document.getElementById("auth-loading");
  if (existingLoadingElement) {
    existingLoadingElement.remove();
  }

  document.querySelector(".container").appendChild(loadingElement);
}

/**
 * Remove loading state
 */
function removeLoadingState() {
  const loadingElement = document.getElementById("auth-loading");
  if (loadingElement) {
    loadingElement.remove();
  }
}

/**
 * Display the authenticated UI state
 * @param {Object} user - The authenticated user object
 */
function showAuthenticatedUI(user) {
  removeLoadingState();

  // Show the user profile in the header
  authContainerElement.innerHTML = `
    <div class="user-profile">
      <img src="${user.avatar}" alt="" class="user-avatar">
      <span class="user-name">${user.name}</span>
      <button id="sign-out-button" class="sign-out-button">Sign out</button>
    </div>
  `;

  // Add sign out handler
  document.getElementById("sign-out-button").addEventListener("click", handleSignOut);

  // Show content area, hide auth required
  authRequiredElement.style.display = "none";
  contentContainerElement.style.display = "block";
}

/**
 * Display the unauthenticated UI state
 */
function showUnauthenticatedUI() {
  removeLoadingState();

  // Clear user profile from header
  authContainerElement.innerHTML = '';

  // Reset sign in button
  signInButton.disabled = false;
  signInButton.innerHTML = `
    <img src="google-icon.svg" alt="Google" class="google-icon" />
    Sign in with Google
  `;

  // Show auth required, hide content
  authRequiredElement.style.display = "block";
  contentContainerElement.style.display = "none";

  // Hide auth error if it was shown
  authErrorElement.style.display = "none";
}

/**
 * Handle sign in button click
 */
async function handleSignIn() {
  // Show loading state
  signInButton.disabled = true;
  signInButton.innerHTML = `
    <div class="spinner"></div>
    <span>Signing in...</span>
  `;

  // Hide any previous errors
  authErrorElement.style.display = "none";

  try {
    // Attempt to sign in using Chrome Identity API
    await signInWithGoogle();
    // The auth state listener will update the UI
  } catch (error) {
    console.error("Sign in error:", error);
    // Show error message
    authErrorElement.textContent = error.message || "Failed to sign in. Please try again.";
    authErrorElement.style.display = "block";

    // Reset button
    signInButton.disabled = false;
    signInButton.innerHTML = `
      <img src="google-icon.svg" alt="Google" class="google-icon" />
      Sign in with Google
    `;
  }
}

/**
 * Handle sign out button click
 */
async function handleSignOut() {
  try {
    showLoadingState("Signing out...");
    await signOut();
    // The auth state listener will update the UI
  } catch (error) {
    console.error("Sign out failed:", error);
  }
}

/**
 * Initialize recipe extraction process
 */
function initRecipeExtraction() {
  if (!isAuthenticated()) {
    return; // Safety check
  }

  // Show loading state
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
    }
  );
}