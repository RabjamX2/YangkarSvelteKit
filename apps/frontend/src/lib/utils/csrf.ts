/**
 * Utility functions for CSRF protection in API requests
 */

/**
 * Creates headers for an API request, including the CSRF token if needed
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

    if (csrfToken) {
        headers["X-CSRF-Token"] = csrfToken;
    }

    return headers;
}

/**
 * Creates a fetch function that automatically includes credentials and CSRF token
 * @param {string|null} csrfToken - The CSRF token obtained from the server
 * @returns {Function} - Enhanced fetch function
 */
export function createAuthFetch(csrfToken: string | null = null) {
    return function authFetch(url: string, options: RequestInit = {}) {
        const fetchOptions: RequestInit = {
            ...options,
            credentials: "include",
            headers: createApiHeaders(csrfToken, (options.headers as Record<string, string>) || {}),
        };

        return fetch(url, fetchOptions);
    };
}
