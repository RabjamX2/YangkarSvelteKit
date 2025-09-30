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
                });

                if (response.ok) {
                    const data = await response.json();

                    // Get tokens directly from response body, not parsing cookies
                    if (data.accessToken) {
                        const isProd = process.env.NODE_ENV === "production";

                        if (isProd) {
                            event.cookies.set("access_token", data.accessToken, {
                                path: "/",
                                httpOnly: true,
                                secure: true,
                                sameSite: "lax",
                                maxAge: 15 * 60, // 15 minutes
                                domain: ".yangkarbhoeche.com",
                            });
                        } else {
                            event.cookies.set("access_token", data.accessToken, {
                                path: "/",
                                httpOnly: true,
                                secure: true,
                                sameSite: "lax",
                                maxAge: 15 * 60, // 15 minutes
                            });
                        }
                    }

                    if (data.refreshToken) {
                        const isProd = process.env.NODE_ENV === "production";

                        if (isProd) {
                            event.cookies.set("refresh_token", data.refreshToken, {
                                path: "/",
                                httpOnly: true,
                                secure: true,
                                sameSite: "lax",
                                maxAge: 7 * 24 * 60 * 60, // 7 days
                                domain: ".yangkarbhoeche.com",
                            });
                        } else {
                            event.cookies.set("refresh_token", data.refreshToken, {
                                path: "/",
                                httpOnly: true,
                                secure: true,
                                sameSite: "lax",
                                maxAge: 7 * 24 * 60 * 60, // 7 days
                            });
                        }
                    }

                    // Set user and CSRF token in locals
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
