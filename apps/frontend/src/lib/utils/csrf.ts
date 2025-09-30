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
    return async function authFetch(url: string, options: RequestInit = {}) {
        // Always explicitly include credentials
        const fetchOptions: RequestInit = {
            ...options,
            credentials: "include",
            headers: createApiHeaders(csrfToken, (options.headers as Record<string, string>) || {}),
        };

        // Enhanced debugging - always log these regardless of environment
        console.log(`AUTH FETCH DEBUG to ${url}`, {
            hasCsrfToken: !!csrfToken,
            csrfTokenFirstChars: csrfToken ? csrfToken.substring(0, 10) + "..." : "none",
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
