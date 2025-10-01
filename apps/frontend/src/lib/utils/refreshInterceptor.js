/**
 * Token refresh interceptor
 * This module sets up a background process to refresh the access token before it expires
 */

import { browser } from "$app/environment";
import { onDestroy } from "svelte";
import { auth } from "$lib/stores/auth.store";
import { get } from "svelte/store";

// How many milliseconds before expiry to refresh the token
// For a 15-minute token, refreshing 2 minutes early is reasonable
const REFRESH_MARGIN = 2 * 60 * 1000; // 2 minutes

// Track the timer ID so we can clear it
let refreshTimerId = null;
let isSetUp = false;

/**
 * Set up the token refresh interceptor
 * Can be called from +layout.svelte to ensure it runs on all pages
 * @param {Function} refreshFn - The function to call to refresh the token
 */
export function setupTokenRefresh(refreshFn) {
    // Only run in the browser and only set up once
    if (!browser || isSetUp) return;

    isSetUp = true;
    console.log("Setting up token refresh interceptor");

    // Set up a subscription to the auth store
    const unsubscribe = auth.subscribe((authState) => {
        // Clear any existing timer
        if (refreshTimerId) {
            clearTimeout(refreshTimerId);
            refreshTimerId = null;
        }

        // If not authenticated, nothing to do
        if (!authState.user || !authState.isAuthenticated) return;

        // Schedule a token refresh
        scheduleTokenRefresh(refreshFn);
    });

    // Clean up when the component is destroyed
    if (typeof onDestroy === "function") {
        onDestroy(() => {
            unsubscribe();
            if (refreshTimerId) {
                clearTimeout(refreshTimerId);
            }
        });
    }

    // Also schedule a refresh now (if authenticated)
    const authState = get(auth);
    if (authState.user && authState.isAuthenticated) {
        scheduleTokenRefresh(refreshFn);
    }
}

/**
 * Schedule a token refresh
 * @param {Function} refreshFn - The function to call to refresh the token
 */
function scheduleTokenRefresh(refreshFn) {
    // Get the current time
    const now = Date.now();

    // Calculate when to refresh the token (10-12 minutes from now)
    // Adding randomness prevents all users from refreshing at the same time
    const refreshTime = Math.floor(10 * 60 * 1000 + Math.random() * 2 * 60 * 1000);

    console.log(`Scheduling token refresh in ${Math.floor(refreshTime / 60000)} minutes`);

    // Set up the timer
    refreshTimerId = setTimeout(() => {
        console.log("Auto-refreshing access token...");
        refreshFn().catch((err) => {
            console.error("Failed to auto-refresh token:", err);
        });

        // Schedule the next refresh
        scheduleTokenRefresh(refreshFn);
    }, refreshTime);

    console.log(`Token refresh scheduled for ${new Date(now + refreshTime).toLocaleTimeString()}`);
}
