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

        // If unauthorized (401), try refreshing the token once
        if (response.status === 401 && browser) {
            console.log("Authentication required (401), attempting to refresh token...");

            // Clone the response before we consume it with json()
            const clonedResponse = response.clone();

            try {
                // Try to extract error details for better debugging
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const errorData = await response.json();
                    console.log("401 Error details:", errorData);
                }
            } catch (e) {
                // Ignore JSON parsing errors
            }

            // Try to get a fresh token
            const refreshSuccess = await refreshAccessToken();

            // If we got a new token, retry the original request
            if (refreshSuccess) {
                console.log("Token refreshed successfully, retrying original request");
                return apiFetch(url, options); // Retry with same options (CSRF token will be updated)
            } else {
                console.log("Token refresh failed, user needs to login again");
            }

            // If refresh failed, return the original response
            return clonedResponse;
        }

        return response;
    } catch (error) {
        console.error("API fetch error:", error);
        throw error;
    }
}

/**
 * Refreshes the access token using the refresh token stored in cookies
 * This is an on-demand function that's only called when a request fails with a 401
 * @returns {Promise<boolean>} True if refresh was successful
 */
export async function refreshAccessToken() {
    // Don't refresh if we're already in the process
    if (isRefreshing) {
        console.log("Token refresh already in progress, waiting for result...");
        return refreshPromise;
    }

    // Set the refreshing flag and create a new promise
    isRefreshing = true;
    refreshPromise = new Promise(async (resolve) => {
        try {
            console.log("Attempting to refresh access token...");

            // Note: We can't check for HttpOnly cookies via document.cookie
            // The refresh_token is HttpOnly for security and won't appear in document.cookie
            // We'll attempt the refresh regardless and let the server check for the cookie

            // Call the refresh endpoint - cookies are automatically included
            // Add retry attempt tracking
            const maxRetries = 2;
            let retryCount = 0;
            let response = null;

            // Try the refresh with automatic retry for certain errors
            while (retryCount <= maxRetries) {
                try {
                    response = await fetch(`${PUBLIC_BACKEND_URL}/api/refresh`, {
                        method: "POST",
                        credentials: "include",
                        // Only include basic headers to avoid CORS issues
                        headers: {
                            "Content-Type": "application/json",
                            // Add retry header for server logging if this isn't the first attempt
                            ...(retryCount > 0 ? { "X-Retry-Refresh": "true" } : {}),
                        },
                    });

                    // Break the retry loop if we get a success or a non-retriable error
                    // We only want to retry on database errors, not auth errors
                    if (response.ok || response.status === 401) {
                        break;
                    }

                    // For 500 errors that could be database conflicts, add a small backoff delay
                    if (response.status === 500) {
                        const backoffMs = 200 * Math.pow(2, retryCount);
                        console.log(
                            `Refresh failed, retrying in ${backoffMs}ms (attempt ${retryCount + 1}/${maxRetries + 1})`
                        );
                        await new Promise((r) => setTimeout(r, backoffMs));
                        retryCount++;
                    } else {
                        // Don't retry for other status codes
                        break;
                    }
                } catch (networkError) {
                    console.error("Network error during token refresh:", networkError);
                    if (retryCount < maxRetries) {
                        retryCount++;
                        await new Promise((r) => setTimeout(r, 500));
                    } else {
                        break;
                    }
                }
            }

            // Handle the case where we couldn't connect at all
            if (!response) {
                console.error("Failed to connect to refresh endpoint after retries");
                resolve(false);
                return false;
            }

            if (response.ok) {
                const data = await response.json();

                if (data.user && data.csrfToken) {
                    // Update the auth store with the new user data and CSRF token
                    auth.setAuth({
                        user: data.user,
                        csrfToken: data.csrfToken,
                    });

                    // Add a small delay to ensure cookies are fully processed by the browser
                    // This helps with race conditions between setting cookies and using them
                    await new Promise((r) => setTimeout(r, 100));

                    console.log("Access token refreshed successfully");
                    resolve(true);
                    return true;
                } else {
                    console.warn("Refresh response OK but missing user or csrfToken:", data);
                }
            } else {
                // Log more details about the failed refresh
                console.error("Token refresh failed with status:", response ? response.status : "unknown");
                try {
                    if (response) {
                        const errorData = await response.json();
                        console.error("Error response:", errorData);
                    }
                } catch (e) {
                    console.error("Could not parse error response as JSON");
                }
            }

            // If refresh failed, clear the auth data and provide more debug info
            console.error("Failed to refresh access token, logging out");
            console.log("Token refresh process:", {
                backendUrl: PUBLIC_BACKEND_URL,
                responseStatus: response?.status,
                responseHeaders: response ? Object.fromEntries([...response.headers.entries()]) : null,
                retryAttempts: retryCount,
            });

            // Special case handling for development - in some browsers,
            // cookies might still be present but not working correctly
            if (response && (response.status === 500 || response.status === 401)) {
                console.log("Critical auth error - clearing cookies manually");

                // Force a redirect to the login page to completely reset auth state
                // This works better than just clearing the auth store
                if (window.location.pathname !== "/login") {
                    window.location.href = "/login";
                }
            }

            auth.clearAuth();
            resolve(false);
            return false;
        } catch (error) {
            console.error("Error refreshing token:", error);

            // Provide more helpful diagnostics for CORS errors
            const errorMessage = String(error);
            if (errorMessage.includes("NetworkError") || errorMessage.includes("Failed to fetch")) {
                console.warn(
                    "Possible CORS issue detected. Check that backend CORS settings allow all necessary headers."
                );
                console.info("Backend URL:", PUBLIC_BACKEND_URL);
            }

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
        // Check cookies before logout
        console.log("Cookies before logout:", document.cookie);

        // Actually wait for the logout response to ensure cookies are properly cleared
        const response = await apiFetch("/api/logout", {
            method: "POST",
        }).catch((error) => {
            console.error("Logout API call failed:", error);
            return null;
        });

        // Check cookies after server has cleared them
        console.log("Cookies after logout response:", document.cookie);

        // Clear auth store
        auth.clearAuth();

        // Navigation should be handled by the caller now
        // But still support the legacy callback pattern for backward compatibility
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
