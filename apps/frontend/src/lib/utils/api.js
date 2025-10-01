import { auth } from "$lib/stores/auth.store.js";
import { browser } from "$app/environment";

// Get the backend URL from environment variables
const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;

// Keep track of refresh attempts to prevent infinite loops
let isRefreshing = false;
let refreshPromise = null;
const pendingRequests = [];

/**
 * Custom fetch utility with automatic token refresh
 * @param {string} url - The URL to fetch (can be relative to API base or absolute)
 * @param {object} options - Standard fetch options
 * @returns {Promise<Response>} - Fetch response
 */
export async function apiFetch(url, options = {}) {
    // Ensure we have a complete URL
    const fullUrl = url.startsWith("http") ? url : `${PUBLIC_BACKEND_URL}${url.startsWith("/") ? url : `/${url}`}`;

    // Ensure options is an object
    const fetchOptions = { ...options };

    // Always include credentials for cookies
    fetchOptions.credentials = "include";

    // Add CSRF token for non-GET/HEAD requests if available
    if (!["GET", "HEAD"].includes(fetchOptions.method || "GET")) {
        const csrfToken = auth?.csrfToken;
        if (csrfToken) {
            fetchOptions.headers = {
                ...fetchOptions.headers,
                "X-CSRF-Token": csrfToken,
            };
        }
    }

    try {
        // Attempt the original request
        const response = await fetch(fullUrl, fetchOptions);

        // If unauthorized and token expired error, try refreshing
        if (response.status === 401) {
            // Only try to parse JSON if there's a body
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                const data = await response.json();

                // Check for token expired code
                if (data.code === "TOKEN_EXPIRED" && browser) {
                    console.log("Access token expired, attempting to refresh...");

                    // Get a fresh token and retry the request
                    const newToken = await refreshAccessToken();

                    // If we got a new token, retry the original request
                    if (newToken) {
                        return apiFetch(url, options); // Retry with same options (CSRF token will be updated)
                    }
                }
            }
        }

        return response;
    } catch (error) {
        console.error("API fetch error:", error);
        throw error;
    }
}

/**
 * Refreshes the access token using the refresh token stored in cookies
 * @returns {Promise<boolean>} True if refresh was successful
 */
async function refreshAccessToken() {
    // Don't refresh if we're already in the process
    if (isRefreshing) {
        return refreshPromise;
    }

    // Set the refreshing flag and create a new promise
    isRefreshing = true;
    refreshPromise = new Promise(async (resolve) => {
        try {
            console.log("Attempting to refresh access token...");

            // Call the refresh endpoint - cookies are automatically included
            const response = await fetch(`${PUBLIC_BACKEND_URL}/api/refresh`, {
                method: "POST",
                credentials: "include",
            });

            if (response.ok) {
                const data = await response.json();

                if (data.user && data.csrfToken) {
                    // Update the auth store with the new user data and CSRF token
                    auth.setAuth({
                        user: data.user,
                        csrfToken: data.csrfToken,
                    });

                    console.log("Access token refreshed successfully");
                    resolve(true);
                    return true;
                }
            }

            // If refresh failed, clear the auth data
            console.error("Failed to refresh access token, logging out");
            auth.clearAuth();
            resolve(false);
            return false;
        } catch (error) {
            console.error("Error refreshing token:", error);
            auth.clearAuth();
            resolve(false);
            return false;
        } finally {
            // Reset the refreshing state
            isRefreshing = false;
            refreshPromise = null;
        }
    });

    return refreshPromise;
}

/**
 * Logout helper function
 * @param {Function} [navigationCallback] - Optional callback for navigation after logout
 * @returns {Promise<boolean>} - Success status of the logout operation
 */
export async function logout(navigationCallback) {
    try {
        await apiFetch("/api/logout", {
            method: "POST",
        });

        // Clear the auth store first
        auth.clearAuth();

        // Execute navigation callback if provided
        if (typeof navigationCallback === "function") {
            navigationCallback();
        }

        return true;
    } catch (error) {
        console.error("Error during logout:", error);

        // Still clear auth on error
        auth.clearAuth();

        // Execute navigation callback even on error to ensure user is redirected
        if (typeof navigationCallback === "function") {
            navigationCallback();
        }

        return false;
    }
}

export default apiFetch;
