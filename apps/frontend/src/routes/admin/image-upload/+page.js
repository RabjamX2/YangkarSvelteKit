/** @type {import('./$types').PageLoad} */
export async function load({ fetch }) {
    // Pre-fetch user data using SvelteKit's fetch
    const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;

    try {
        const response = await fetch(`${PUBLIC_BACKEND_URL}/api/me`, {
            credentials: "include",
        });

        if (response.ok) {
            const userData = await response.json();
            return { userData };
        }

        return { userData: null };
    } catch (error) {
        console.error("Error fetching user data:", error);
        return { userData: null };
    }
}
