/**
 * Utility functions for CSRF protection in API requests
 */

import { get } from "svelte/store";
import { auth } from "$lib/stores/auth.store";

/**
 * Creates headers for an API request, including the CSRF token and Authorization if available
 * @param {string|null} csrfToken - The CSRF token obtained from the server
 * @param {Record<string, string>} [additionalHeaders] - Any additional headers to include
 * @returns {Record<string, string>} - Headers object ready for fetch API
 */
export function createApiHeaders(
    csrfToken: string | null = null,
    additionalHeaders: Record<string, string> = {}
): Record<string, string> {
    const headers = {
        "Content-Type": "application/json",
        ...additionalHeaders,
    };

    // Try to get token from the provided token or from the store
    const authStore = get(auth);
    const actualCsrfToken = csrfToken || authStore.csrfToken;
    const accessToken = authStore.accessToken;

    // ALWAYS add Authorization header with Bearer token if available
    // This is our primary authentication method
    if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
        console.log("Added Bearer token to request - auth method active");
    } else {
        console.warn("No access token available for API request");
    }

    // Add CSRF token if available
    if (actualCsrfToken) {
        headers["X-CSRF-Token"] = actualCsrfToken;
    }

    return headers;
}

/**
 * Creates a fetch function that automatically includes credentials and CSRF token
 * @param {string|null} csrfToken - The CSRF token obtained from the server
 * @returns {Function} - Enhanced fetch function
 */
export function createAuthFetch(csrfToken: string | null = null) {
    return async function authFetch(url: string, options: RequestInit = {}) {
        // Check if we have an access token for this request
        const authStore = get(auth);
        const hasToken = !!authStore.accessToken;

        if (!hasToken && url.includes("/api/") && !url.includes("/api/login") && !url.includes("/api/signup")) {
            console.warn(`AUTH WARNING: Making authenticated request to ${url} without access token`);
        }

        // Always explicitly include credentials
        const fetchOptions: RequestInit = {
            ...options,
            // Still include credentials for compatibility, but we'll primarily use Authorization header
            credentials: "include",
            headers: createApiHeaders(csrfToken, (options.headers as Record<string, string>) || {}),
        };

        // Enhanced debugging - always log these regardless of environment
        console.log(`AUTH FETCH DEBUG to ${url}`, {
            hasAccessToken: hasToken,
            hasCsrfToken: !!csrfToken,
            credentials: fetchOptions.credentials,
            method: options.method || "GET",
            headers: Object.keys(fetchOptions.headers || {}).join(", "),
        });

        try {
            // Try to get document.cookie to see if any cookies are accessible
            if (typeof document !== "undefined") {
                console.log("Available cookies in browser:", document.cookie ? "Some cookies present" : "No cookies");
            }

            const response = await fetch(url, fetchOptions);
            return response;
        } catch (error) {
            console.error("Error in auth fetch:", error);
            throw error;
        }
    };
}
