import { writable } from "svelte/store";
import { browser } from "$app/environment";

// Initialize the auth store with user data only (no tokens)
function createAuthStore() {
    // Default state - only storing user data, no tokens
    const defaultState = {
        user: null,
        csrfToken: null, // We still keep the CSRF token in memory for requests
        isAuthenticated: false,
    };

    const { subscribe, set, update } = writable(defaultState);

    return {
        subscribe,

        // Set the auth state - only stores user data and CSRF token in memory
        setAuth: (data) => {
            update((state) => {
                return {
                    csrfToken: data.csrfToken || state.csrfToken,
                    user: data.user || state.user,
                    isAuthenticated: !!data.user || state.isAuthenticated,
                };
            });
        },

        // Update user data only
        setUser: (user) => {
            update((state) => {
                return {
                    ...state,
                    user,
                    isAuthenticated: !!user,
                };
            });
        },

        // Update CSRF token
        setCsrfToken: (csrfToken) => {
            update((state) => {
                return { ...state, csrfToken };
            });
        },

        // Clear auth state (logout)
        clearAuth: () => {
            set(defaultState);
        },
    };
}

// Create and export the auth store
export const auth = createAuthStore();
