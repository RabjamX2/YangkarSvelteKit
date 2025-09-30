import { fail } from "@sveltejs/kit";
const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;

/** @type {import('./$types').Actions} */
export const actions = {
    default: async ({ cookies, request, fetch }) => {
        let username, email, password, passwordHashMethod;

        // Process the form data - whether it's enhanced or not
        console.log("Request content type:", request.headers.get("content-type"));

        const formData = await request.formData();
        console.log("Form data entries:");
        for (const [key, value] of formData.entries()) {
            if (key === "password") {
                console.log(`${key}: [${typeof value}] length=${value.toString().length}`);
            } else {
                console.log(`${key}: ${value}`);
            }
        }

        username = formData.get("username")?.toString() || "";
        email = formData.get("email")?.toString() || "";
        password = formData.get("password")?.toString() || "";
        passwordHashMethod = formData.get("passwordHashMethod")?.toString() || "";

        console.log("Server received form data:", {
            username,
            email,
            passwordLength: password.length,
            hashedPassword: passwordHashMethod === "sha256-client" ? "Yes" : "No",
            passwordFirstChars: password.length > 20 ? password.substring(0, 10) + "..." : "(short password)",
        });

        // Basic validation
        const errors = {};
        if (!username) errors.username = "Username is required";
        if (!email) errors.email = "Email is required";
        if (!password) errors.password = "Password is required";

        if (Object.keys(errors).length > 0) {
            return fail(400, { errors, username, email });
        }

        try {
            // Submit signup request with credentials
            const response = await fetch(`${PUBLIC_BACKEND_URL}/api/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username,
                    email,
                    password,
                    passwordHashMethod, // Pass this to backend if it exists
                }),
            });

            if (!response.ok) {
                let errorMessage = "Signup failed";

                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.message || errorMessage;
                } catch (e) {
                    // If JSON parsing fails, use the status text
                    errorMessage = response.statusText || errorMessage;
                }

                return fail(response.status, {
                    error: errorMessage,
                    username,
                    email,
                });
            }

            // Extract user data from the response
            const userData = await response.json();

            // After successful signup, automatically log the user in
            try {
                // Make a login request with the same credentials
                const loginResponse = await fetch(`${PUBLIC_BACKEND_URL}/api/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        username,
                        password,
                        passwordHashMethod,
                    }),
                });

                if (loginResponse.ok) {
                    const loginData = await loginResponse.json();

                    // Set cookies for auth (same as in login page)
                    if (loginData.accessToken) {
                        cookies.set("access_token", loginData.accessToken, {
                            path: "/",
                            httpOnly: true,
                            secure: true,
                            sameSite: "lax", // Keep it simple for now
                            maxAge: 15 * 60, // 15 minutes
                        });
                    }

                    if (loginData.refreshToken) {
                        cookies.set("refresh_token", loginData.refreshToken, {
                            path: "/",
                            httpOnly: true,
                            secure: true,
                            sameSite: "lax",
                            maxAge: 7 * 24 * 60 * 60, // 7 days
                        });
                    }

                    // Return success with tokens for client-side use
                    return {
                        success: true,
                        message: "Account created and logged in successfully!",
                        // Include tokens and user data for client-side storage
                        accessToken: loginData.accessToken,
                        refreshToken: loginData.refreshToken,
                        csrfToken: loginData.csrfToken,
                        user: loginData.user || {
                            username,
                            id: userData.userId || userData.id,
                            role: userData.role || "USER",
                        },
                    };
                } else {
                    // If auto-login fails, still return success but without tokens
                    return {
                        success: true,
                        message: "Account created successfully! Please log in.",
                    };
                }
            } catch (loginError) {
                console.error("Auto-login error:", loginError);

                // Return basic success without tokens if auto-login fails
                return {
                    success: true,
                    message: "Account created successfully! Please log in.",
                };
            }
        } catch (error) {
            console.error("Signup error:", error);

            return fail(500, {
                error: "An error occurred during sign-up. Please try again.",
                username: username || "",
                email: email || "",
            });
        }
    },
};
