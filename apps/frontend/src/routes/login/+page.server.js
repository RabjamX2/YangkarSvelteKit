import { fail } from "@sveltejs/kit";
const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;

// Environment detection helper
function isProduction(request) {
    // IMPORTANT: For authentication cookies, default to production mode
    // when environment cannot be determined - safer than development mode

    // Multiple ways to detect production:
    // 1. Environment variable - standard way
    // 2. Request host - domain based detection
    // 3. PUBLIC_BACKEND_URL - if it contains production URLs
    // 4. Default to TRUE when PUBLIC_BACKEND_URL uses https (safer default)

    // If no NODE_ENV and we're using https in backend URL, assume production
    const isProductionUrl = PUBLIC_BACKEND_URL?.startsWith("https://");

    return (
        process.env.NODE_ENV === "production" ||
        (request && request.headers.get("host") && request.headers.get("host").includes("yangkarbhoeche.com")) ||
        PUBLIC_BACKEND_URL?.includes("yangkarbhoeche.com") ||
        PUBLIC_BACKEND_URL?.includes("api.yangkarbhoeche") ||
        isProductionUrl || // Default to production mode if using HTTPS
        false
    );
}

// Log our environment information
console.log(`Server environment check:`, {
    NODE_ENV: process.env.NODE_ENV,
    PUBLIC_BACKEND_URL,
    isProduction: isProduction(),
});

export function load({ url }) {
    const success = url.searchParams.get("success");
    return { success };
}

export const actions = {
    // This is the 'default' action for the form
    default: async ({ cookies, request, fetch }) => {
        let username, password, passwordHashMethod;

        // Check if the request is JSON (from our client-side enhance handler)
        const contentType = request.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
            // Handle JSON requests with pre-hashed passwords
            const data = await request.json();
            username = data.username;
            password = data.password; // This is already hashed on client side
            passwordHashMethod = data.passwordHashMethod;
        } else {
            // Handle traditional form submissions (fallback)
            const formData = await request.formData();
            username = formData.get("username")?.toString();
            password = formData.get("password")?.toString();
        }

        // Basic validation
        if (!username || !password) {
            return fail(400, {
                error: "Username and password are required",
                username: username || "",
            });
        }

        try {
            // Direct fetch to backend
            const response = await fetch(`${PUBLIC_BACKEND_URL}/api/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username,
                    password,
                    passwordHashMethod, // Pass this to backend if it exists
                }),
            });

            // Handle authentication failures
            if (!response.ok) {
                return fail(401, {
                    error: "Invalid username or password",
                    username,
                });
            }

            // Handle success
            try {
                const userData = await response.json();

                // Utility function to set cookies with proper cross-domain attributes
                function setSecureCookie(name, value, maxAge) {
                    // Always use secure cross-domain settings in production
                    // This ensures SameSite=None for cross-domain requests
                    cookies.set(name, value, {
                        path: "/",
                        httpOnly: true,
                        secure: true,
                        sameSite: "none", // CRITICAL: Must be "none" for cross-domain
                        maxAge: maxAge,
                    });

                    console.log(`Set cookie ${name} with SameSite=None and Secure=true`);
                }

                // Store tokens as cookies
                // Use our isProduction helper for consistent environment detection
                const productionMode = isProduction(request);

                console.log(`Auth environment: ${productionMode ? "PRODUCTION" : "DEVELOPMENT"}`, {
                    host: request.headers.get("host") || "unknown",
                    NODE_ENV: process.env.NODE_ENV,
                    BACKEND_URL: PUBLIC_BACKEND_URL,
                });

                // Set cookies based on whether we're in production
                if (userData.accessToken) {
                    // In production, ALWAYS use SameSite=None
                    if (productionMode) {
                        // FORCE SameSite=None for cross-domain requests
                        setSecureCookie("access_token", userData.accessToken, 15 * 60); // 15 minutes
                    } else {
                        // Development mode
                        cookies.set("access_token", userData.accessToken, {
                            path: "/",
                            httpOnly: true,
                            secure: true,
                            sameSite: "lax", // Lax is fine for development
                            maxAge: 15 * 60, // 15 minutes
                        });
                    }
                }

                if (userData.refreshToken) {
                    if (productionMode) {
                        // FORCE SameSite=None for cross-domain requests
                        setSecureCookie("refresh_token", userData.refreshToken, 7 * 24 * 60 * 60); // 7 days
                    } else {
                        // Development mode
                        cookies.set("refresh_token", userData.refreshToken, {
                            path: "/",
                            httpOnly: true,
                            secure: true,
                            sameSite: "lax",
                            maxAge: 7 * 24 * 60 * 60, // 7 days
                        });
                    }
                }

                // Debug cookie headers to verify they are set correctly
                try {
                    const setCookieHeaders = cookies.getAll().map((c) => `${c.name}=${c.value}`);
                    console.log("Cookies being set:", setCookieHeaders);
                } catch (e) {
                    console.error("Error inspecting cookies:", e);
                }

                // Return data needed for client-side navigation including tokens for localStorage
                return {
                    success: true,
                    // Include tokens in the response so the client can store them
                    accessToken: userData.accessToken,
                    refreshToken: userData.refreshToken,
                    csrfToken: userData.csrfToken,
                    // Include user data
                    user: {
                        id: userData.userId || userData.id,
                        username: userData.username || username,
                        role: userData.role || "USER",
                    },
                };
            } catch (parseError) {
                return fail(500, {
                    error: "Couldn't process login response",
                    username,
                });
            }
        } catch (error) {
            return fail(500, {
                error: "Connection error. Please try again.",
                username,
            });
        }
    },
};
