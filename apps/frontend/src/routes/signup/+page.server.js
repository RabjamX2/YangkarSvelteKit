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

            // DON'T redirect - instead return success=true
            // This avoids the redirect error while still showing success
            return {
                success: true,
                message: "Account created successfully! Please log in.",
            };
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
