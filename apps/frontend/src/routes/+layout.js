import { browser } from "$app/environment";
import { auth } from "$lib/stores/auth.store.js";
import { get } from "svelte/store";

// Client-side initialization to check localStorage for auth tokens
export const load = async ({ data, fetch }) => {
    // This runs in the browser after SSR
    // We need to check if we have auth tokens in localStorage
    if (browser) {
        const authData = get(auth);

        // If we have auth data in localStorage but not from SSR, we might be authenticated
        if (authData.accessToken && !data.user) {
            console.log("Found tokens in localStorage");

            try {
                // Validate token against backend
                const response = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/me`, {
                    headers: {
                        Authorization: `Bearer ${authData.accessToken}`,
                    },
                });

                if (response.ok) {
                    const userData = await response.json();

                    if (userData.user) {
                        console.log("Successfully validated token from localStorage");

                        // Update store with the fresh data
                        auth.setAuth({
                            accessToken: authData.accessToken,
                            refreshToken: authData.refreshToken,
                            csrfToken: userData.csrfToken,
                            user: userData.user,
                        });

                        // Merge with server data
                        return {
                            ...data,
                            user: userData.user,
                            csrfToken: userData.csrfToken,
                        };
                    }
                } else {
                    // Token invalid, clear it
                    console.log("Token from localStorage is invalid, clearing");
                    auth.clearAuth();
                }
            } catch (error) {
                console.error("Error validating token from localStorage:", error);
            }
        }
    }

    // Return the original data
    return data;
};
