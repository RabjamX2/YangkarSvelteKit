import { browser } from "$app/environment";
import { auth } from "$lib/stores/auth.store.js";
import { apiFetch } from "$lib/utils/api.js";

// Client-side initialization to check for auth session using cookies
export const load = async ({ data, fetch }) => {
    // This runs in the browser after SSR

    // If we already have user data from SSR, use that directly
    if (browser && data.user) {
        // Update the auth store with SSR data
        auth.setAuth({
            user: data.user,
            csrfToken: data.csrfToken,
        });
        return data;
    }

    // Only check with API if we don't have user data and we're in the browser
    if (browser && !data.user) {
        try {
            // Attempt to validate the session using httpOnly cookies
            // Use our custom apiFetch utility that handles token refreshing
            const response = await apiFetch("/api/me");

            if (response.ok) {
                const userData = await response.json();

                if (userData.user) {
                    console.log("Successfully validated cookie-based session");

                    // Update store with user data and CSRF token
                    auth.setAuth({
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
                // No valid session, clear the auth store
                console.log("No valid cookie-based session found");
                auth.clearAuth();
            }
        } catch (error) {
            console.error("Error validating cookie-based session:", error);
        }
    }

    // Return the original data
    return data;
};
