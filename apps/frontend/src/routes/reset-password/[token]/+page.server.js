import { fail } from "@sveltejs/kit";
const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;

/** @type {import('./$types').Actions} */
export const actions = {
    default: async ({ params, request, fetch }) => {
        const data = await request.formData();
        const password = data.get("password");
        const passwordConfirm = data.get("passwordConfirm");

        try {
            // Basic validation
            if (!password || !passwordConfirm) {
                return fail(400, { error: "Both password fields are required." });
            }
            if (password !== passwordConfirm) {
                return fail(400, { error: "Passwords do not match." });
            }

            // Password strength validation
            if (typeof password === "string") {
                if (password.length < 8) {
                    return fail(400, { error: "Password must be at least 8 characters long." });
                }
                if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
                    return fail(400, {
                        error: "Password must contain at least one lowercase letter, one uppercase letter, and one number.",
                    });
                }
            }

            // Submit reset request
            const response = await fetch(`${PUBLIC_BACKEND_URL}/api/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: params.token, password }),
            });

            if (!response.ok) {
                const result = await response.json();
                return fail(response.status, {
                    error: result.error || "Failed to reset password. The token may be invalid or expired.",
                });
            }

            // Return success status
            return { success: true };
        } catch (error) {
            console.error("Password reset error:", error);
            return fail(500, { error: "An unexpected error occurred. Please try again." });
        }
    },
};
