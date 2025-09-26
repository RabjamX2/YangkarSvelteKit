import { fail, redirect } from "@sveltejs/kit";
const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;

/** @type {import('./$types').Actions} */
export const actions = {
    // This is the 'default' action for the form
    default: async ({ cookies, request, fetch }) => {
        const data = await request.formData();
        const username = data.get("username");
        const password = data.get("password");

        // 1. Send the login request to your backend API
        const response = await fetch(`${PUBLIC_BACKEND_URL}/api/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
            credentials: "include",
        });

        // 2. If login fails, return an error message
        if (!response.ok) {
            const result = await response.json();
            // The `fail` function sends back a 400-level status
            // and the error data to the form.
            return fail(401, {
                error: result.error || "Login failed",
                username: username, // Send back the username to pre-fill the form
            });
        }

        // 3. Forward the 'set-cookie' header from the API response
        // to the browser.
        const setCookieHeader = response.headers.get("set-cookie");
        if (setCookieHeader) {
            const match = setCookieHeader.match(/session_token=([^;]+)/);
            const sessionToken = match ? match[1] : null;
            if (sessionToken) {
                const isProduction = process.env.NODE_ENV === "production";
                console.log(`Code is running in ${isProduction ? "production" : "development"} mode.`);

                // cookies.set("session_token", sessionToken, {
                //     path: "/",
                //     httpOnly: true,
                //     secure: isProduction ? true : false,
                //     sameSite: isProduction ? "none" : "lax",
                //     domain: isProduction ? ".yangkarbhoeche.com" : undefined,
                //     maxAge: 60 * 60 * 24 * 7, // 1 week
                // });

                cookies.set("session_token", sessionToken, {
                    path: "/",
                    httpOnly: true,
                    secure: true,
                    sameSite: "none",
                    domain: isProduction ? ".yangkarbhoeche.com" : undefined,
                    maxAge: 60 * 60 * 24 * 7, // 1 week
                });
            }
        }
        throw redirect(303, "/");
    },
};
