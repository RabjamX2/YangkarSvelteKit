/**
 * Utility functions for CSRF protection in API requests
 */

import { get } from "svelte/store";
import { auth } from "$lib/stores/auth.store";

/**
 * Creates headers for an API request, including the CSRF token
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

    // Try to get CSRF token from the provided token or from the store
    const authStore = get(auth);
    const actualCsrfToken = csrfToken || authStore.csrfToken;

    // Add CSRF token if available for protection against CSRF attacks
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
        const authStore = get(auth);

        // Always explicitly include credentials for cookies
        const fetchOptions: RequestInit = {
            ...options,
            // Include credentials to send httpOnly cookies with the request
            credentials: "include",
            headers: createApiHeaders(csrfToken, (options.headers as Record<string, string>) || {}),
        };

        // Enhanced debugging - always log these regardless of environment
        console.log(`AUTH FETCH DEBUG to ${url}`, {
            hasCsrfToken: !!csrfToken,
            credentials: fetchOptions.credentials,
            method: options.method || "GET",
            headers: Object.keys(fetchOptions.headers || {}).join(", "),
        });

        return fetch(url, fetchOptions);
    };
}
