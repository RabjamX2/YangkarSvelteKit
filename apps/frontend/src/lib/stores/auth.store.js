// auth.store.js - Manages authentication state and tokens
import { writable } from "svelte/store";
import { browser } from "$app/environment";

// Initialize the auth store with values from localStorage if available
function createAuthStore() {
    // Default state
    const defaultState = {
        accessToken: null,
        csrfToken: null,
        user: null,
        isAuthenticated: false,
    };

    // Try to load from localStorage if in browser
    let initialState = defaultState;
    if (browser) {
        try {
            const storedAuth = localStorage.getItem("auth");
            if (storedAuth) {
                initialState = JSON.parse(storedAuth);
                console.log("Auth data loaded from localStorage");
            }
        } catch (e) {
            console.error("Failed to load auth from localStorage:", e);
        }
    }

    const { subscribe, set, update } = writable(initialState);

    return {
        subscribe,

        // Set the full auth state
        setAuth: (data) => {
            update((state) => {
                const newState = {
                    accessToken: data.accessToken || state.accessToken,
                    csrfToken: data.csrfToken || state.csrfToken,
                    user: data.user || state.user,
                    isAuthenticated: !!data.accessToken || state.isAuthenticated,
                };

                // Persist to localStorage if in browser
                if (browser) {
                    try {
                        localStorage.setItem("auth", JSON.stringify(newState));
                    } catch (e) {
                        console.error("Failed to save auth to localStorage:", e);
                    }
                }

                return newState;
            });
        },

        // Update user data only
        setUser: (user) => {
            update((state) => {
                const newState = { ...state, user, isAuthenticated: !!user };

                // Persist to localStorage if in browser
                if (browser) {
                    try {
                        localStorage.setItem("auth", JSON.stringify(newState));
                    } catch (e) {
                        console.error("Failed to save auth to localStorage:", e);
                    }
                }

                return newState;
            });
        },

        // Clear auth state (logout)
        clearAuth: () => {
            set(defaultState);
            if (browser) {
                try {
                    localStorage.removeItem("auth");
                } catch (e) {
                    console.error("Failed to clear auth from localStorage:", e);
                }
            }
        },
    };
}

// Create and export the auth store
export const auth = createAuthStore();
