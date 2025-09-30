import { fail } from "@sveltejs/kit";
const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;

console.log(PUBLIC_BACKEND_URL);

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

                // Store tokens as cookies
                if (userData.accessToken) {
                    const isProd = process.env.NODE_ENV === "production";
                    console.log(`Code setting access token cookie in ${isProd ? "production" : "development"} mode`);

                    if (isProd) {
                        cookies.set("access_token", userData.accessToken, {
                            path: "/",
                            httpOnly: true,
                            secure: true,
                            sameSite: "none", // Changed from "lax" to "none" to allow cross-domain
                            maxAge: 15 * 60, // 15 minutes
                        });
                    } else {
                        cookies.set("access_token", userData.accessToken, {
                            path: "/",
                            httpOnly: true,
                            secure: true,
                            sameSite: "lax",
                            maxAge: 15 * 60, // 15 minutes
                        });
                    }
                }

                if (userData.refreshToken) {
                    const isProd = process.env.NODE_ENV === "production";

                    if (isProd) {
                        cookies.set("refresh_token", userData.refreshToken, {
                            path: "/",
                            httpOnly: true,
                            secure: true,
                            sameSite: "none", // Changed to allow cross-domain
                            maxAge: 7 * 24 * 60 * 60, // 7 days
                        });
                    } else {
                        cookies.set("refresh_token", userData.refreshToken, {
                            path: "/",
                            httpOnly: true,
                            secure: true,
                            sameSite: "lax",
                            maxAge: 7 * 24 * 60 * 60, // 7 days
                        });
                    }
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
