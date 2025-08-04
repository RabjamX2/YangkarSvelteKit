import { fail, redirect } from "@sveltejs/kit";

/** @type {import('./$types').Actions} */
export const actions = {
    default: async ({ params, request, fetch }) => {
        const data = await request.formData();
        const password = data.get("password");
        const passwordConfirm = data.get("passwordConfirm");

        if (!password || !passwordConfirm) {
            return fail(400, { error: "Both password fields are required." });
        }
        if (password !== passwordConfirm) {
            return fail(400, { error: "Passwords do not match." });
        }

        const response = await fetch("http://localhost:3000/api/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: params.token, password }),
        });

        if (!response.ok) {
            const result = await response.json();
            return fail(response.status, { error: result.error || "Failed to reset password." });
        }

        // On success, we don't automatically log them in.
        // We can show a success message. SvelteKit's redirect is a good way
        // to clear the form and show a clean state, but here we'll return a success flag.
        // Or redirect to login with a success message.
        // throw redirect(303, '/login?reset=success');
        return { success: true };
    },
};
