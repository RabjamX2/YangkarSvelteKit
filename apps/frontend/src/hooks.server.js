const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;

/**
 * SvelteKit server hook for handling authentication
 * This manages:
 * 1. Validating access tokens
 * 2. Refreshing tokens when needed
 * 3. Exposing user data and CSRF token to routes
 */
export const handle = async ({ event, resolve }) => {
    // Get tokens from cookies
    const accessToken = event.cookies.get("access_token");
    const refreshToken = event.cookies.get("refresh_token");

    // Initialize auth state
    event.locals.user = null;
    event.locals.csrfToken = null;

    try {
        // If no tokens, user is not authenticated
        if (!accessToken && !refreshToken) {
            return await resolve(event);
        }

        // If we have an access token, validate it
        if (accessToken) {
            try {
                const response = await fetch(`${PUBLIC_BACKEND_URL}/api/me`, {
                    headers: {
                        cookie: `access_token=${accessToken}`,
                    },
                    credentials: "include",
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.user) {
                        event.locals.user = data.user;
                        event.locals.csrfToken = data.csrfToken;
                        return await resolve(event);
                    }
                }
            } catch (error) {
                console.error("Error validating access token:", error);
                // Continue to refresh token logic
            }
        }

        // If access token is invalid/expired but we have a refresh token, try to refresh
        if (refreshToken) {
            try {
                const response = await fetch(`${PUBLIC_BACKEND_URL}/api/refresh`, {
                    method: "POST",
                    headers: {
                        cookie: `refresh_token=${refreshToken}`,
                    },
                    credentials: "include",
                });

                if (response.ok) {
                    const data = await response.json();

                    // We don't need to set cookies here anymore since the backend handles it
                    // Just get the user and CSRF token from the response
                    event.locals.user = data.user;
                    event.locals.csrfToken = data.csrfToken;
                } else {
                    // If refresh fails, clear the cookies
                    event.cookies.delete("access_token", { path: "/" });
                    event.cookies.delete("refresh_token", { path: "/" });
                }
            } catch (error) {
                console.error("Error refreshing token:", error);
                // Clear cookies on error
                event.cookies.delete("access_token", { path: "/" });
                event.cookies.delete("refresh_token", { path: "/" });
            }
        }
    } catch (error) {
        console.error("Auth error in hooks:", error);
        // Clear cookies on general error
        event.cookies.delete("access_token", { path: "/" });
        event.cookies.delete("refresh_token", { path: "/" });
    }

    return await resolve(event);
};
