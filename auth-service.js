// auth-service.js
// Stub implementation of authentication service

// In-memory storage for demo purposes
// In a real implementation, we would use chrome.storage APIs
let currentUser = null;
let authListeners = [];

// Mock user data
const MOCK_USERS = [
  {
    id: "user123",
    name: "Test User",
    email: "testuser@example.com",
    avatar: "https://ui-avatars.com/api/?name=Test+User&background=4285F4&color=fff"
  }
];

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
 * Sign in with Google
 * @returns {Promise<Object>} User data
 */
export async function signInWithGoogle() {
  // Simulate network delay
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // 90% success rate for demo purposes
      if (Math.random() < 0.9) {
        currentUser = MOCK_USERS[0];
        notifyListeners(currentUser);
        resolve(currentUser);
      } else {
        const error = new Error("Failed to authenticate with Google");
        reject(error);
      }
    }, 1500); // Simulate network delay
  });
}

/**
 * Sign out the current user
 * @returns {Promise<void>}
 */
export async function signOut() {
  return new Promise((resolve) => {
    setTimeout(() => {
      currentUser = null;
      notifyListeners(null);
      resolve();
    }, 500);
  });
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
 * @returns {Promise<string>} JWT token
 */
export async function getAuthToken() {
  if (!currentUser) {
    throw new Error("No authenticated user");
  }

  // In a real implementation, this would return the actual token
  // For now, return a fake token
  return "mock_jwt_token_" + currentUser.id;
}