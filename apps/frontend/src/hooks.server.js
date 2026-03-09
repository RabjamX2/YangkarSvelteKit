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

                    // Forward Set-Cookie headers from the backend to the browser.
                    // Since this is a server-side fetch, the browser never sees the response
                    // directly — we must relay the cookies via event.cookies.set().
                    const setCookies =
                        typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
                    for (const cookieStr of setCookies) {
                        const parts = cookieStr.split(";").map((p) => p.trim());
                        const eqIdx = parts[0].indexOf("=");
                        const name = parts[0].slice(0, eqIdx).trim();
                        const value = parts[0].slice(eqIdx + 1);
                        const opts = { path: "/" };
                        for (const part of parts.slice(1)) {
                            const [k, ...vs] = part.split("=");
                            switch (k.trim().toLowerCase()) {
                                case "httponly":
                                    opts.httpOnly = true;
                                    break;
                                case "secure":
                                    opts.secure = true;
                                    break;
                                case "samesite":
                                    opts.sameSite = vs.join("=").trim().toLowerCase();
                                    break;
                                case "max-age":
                                    opts.maxAge = parseInt(vs.join("="));
                                    break;
                                case "domain":
                                    opts.domain = vs.join("=").trim();
                                    break;
                                case "path":
                                    opts.path = vs.join("=").trim();
                                    break;
                            }
                        }
                        event.cookies.set(name, value, opts);
                    }

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
