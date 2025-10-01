/**
 * Utility functions for CSRF protection in API requests
 */

import { get } from "svelte/store";
import { auth } from "$lib/stores/auth.store";
import { apiFetch } from "./api.js";

/**
 * Creates headers for an API request, including the CSRF token
 * @param {string|null} csrfToken - The CSRF token obtained from the server
 * @param {Object} additionalHeaders - Any additional headers to include
 * @returns {Object} - Headers object ready for fetch API
 */
export function createApiHeaders(csrfToken = null, additionalHeaders = {}) {
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
 * Uses apiFetch internally to handle token refresh
 * @param {string|null} csrfToken - The CSRF token obtained from the server
 * @returns {Function} - Enhanced fetch function with token refresh
 */
export function createAuthFetch(csrfToken = null) {
    return async function authFetch(url, options = {}) {
        // Set up headers with CSRF token
        const headers = createApiHeaders(csrfToken, options.headers || {});

        // Enhanced debugging - always log these regardless of environment
        console.log(`AUTH FETCH DEBUG to ${url}`, {
            hasCsrfToken: !!csrfToken,
            method: options.method || "GET",
            headers: Object.keys(headers || {}).join(", "),
        });

        // Use apiFetch which handles token refresh automatically
        return apiFetch(url, {
            ...options,
            headers,
        });
    };
}
