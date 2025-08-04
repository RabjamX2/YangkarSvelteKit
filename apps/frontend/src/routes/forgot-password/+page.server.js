import { fail } from "@sveltejs/kit";

/** @type {import('./$types').Actions} */
export const actions = {
    default: async ({ request, fetch }) => {
        const data = await request.formData();
        const email = data.get("email");

        if (!email) {
            return fail(400, { error: "Email is required.", email });
        }

        const response = await fetch("http://localhost:3000/api/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
        });

        if (!response.ok) {
            const result = await response.json();
            return fail(response.status, { error: result.error || "An error occurred.", email });
        }

        const result = await response.json();
        return { success: true, message: result.message };
    },
};
