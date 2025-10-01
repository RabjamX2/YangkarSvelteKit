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
    default: async ({ request, fetch }) => {
        // Note: 'cookies' parameter removed as we no longer need to manually set cookies
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
            // Direct fetch to backend with credentials to receive cookies
            const response = await fetch(`${PUBLIC_BACKEND_URL}/api/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username,
                    password,
                    passwordHashMethod, // Pass this to backend if it exists
                }),
                credentials: "include", // Important to receive and store HttpOnly cookies
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

                // Debug information about cookies in response
                console.log("Login successful: Checking cookies in response");
                const cookieHeader = response.headers.get("set-cookie");
                console.log("Set-Cookie header:", cookieHeader || "No cookies set");

                // Get all headers for debugging
                const allHeaders = {};
                response.headers.forEach((value, key) => {
                    allHeaders[key] = value;
                });
                console.log("Response headers:", allHeaders);

                // Return minimal data needed for client-side navigation
                return {
                    success: true,
                    // Include only CSRF token in the response
                    csrfToken: userData.csrfToken,
                    // Include user data
                    user: {
                        id: userData.id,
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
