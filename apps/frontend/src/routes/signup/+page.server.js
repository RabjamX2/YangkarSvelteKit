import { fail, redirect } from "@sveltejs/kit";
const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;

/** @type {import('./$types').Actions} */
export const actions = {
    default: async ({ cookies, request, fetch }) => {
        const data = await request.formData();
        const username = data.get("username");
        const email = data.get("email");
        const password = data.get("password");

        // Basic validation
        const errors = {};
        if (!username) errors.username = "Username is required";
        if (!email) errors.email = "Email is required";
        if (!password) errors.password = "Password is required";
        if (Object.keys(errors).length > 0) {
            return fail(400, { errors, username, email });
        }

        const response = await fetch(`${PUBLIC_BACKEND_URL}/api/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password }),
        });

        if (!response.ok) {
            const result = await response.json();
            return fail(response.status, {
                error: result.error || "Signup failed",
                username,
                email,
            });
        }

        // Handle successful signup by setting the cookie
        const setCookieHeader = response.headers.get("set-cookie");
        if (setCookieHeader) {
            // SvelteKit's fetch does not automatically handle cookies,
            // so we parse and set it manually.
            const [cookieNameAndValue] = setCookieHeader.split(";");
            const [cookieName, cookieValue] = cookieNameAndValue.split("=");
            if (cookieName === "session_token" && cookieValue) {
                cookies.set(cookieName, cookieValue, {
                    path: "/",
                    httpOnly: true,
                    sameSite: "none",
                    domain: ".yangkarbhoeche.com",
                    secure: true,
                    maxAge: 60 * 60 * 24, // 24 hours
                });
            }
        }

        // Redirect to home page after successful signup
        throw redirect(303, "/");
    },
};
