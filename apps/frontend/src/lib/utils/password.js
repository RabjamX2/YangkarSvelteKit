/**
 * Password utility functions for client-side security
 *
 * This module provides functions to hash passwords on the client side
 * before sending them to the server. This adds an extra layer of protection
 * against password exposure in transit.
 *
 * NOTE: This is IN ADDITION to server-side hashing, not a replacement.
 */

// Check if the browser supports the Web Crypto API
export const isWebCryptoAvailable = () => {
    // Detailed checking with logging
    const hasWindow = typeof window !== "undefined";
    const hasCrypto = hasWindow && typeof window.crypto !== "undefined";
    const hasSubtle = hasCrypto && typeof window.crypto.subtle !== "undefined";

    // Log the availability for debugging
    console.log("Web Crypto API availability check:", {
        hasWindow,
        hasCrypto,
        hasSubtle,
        isAvailable: hasWindow && hasCrypto && hasSubtle,
    });

    return hasWindow && hasCrypto && hasSubtle;
};

/**
 * Fallback password hashing function for non-secure contexts
 * This uses a simple JavaScript implementation that's not cryptographically secure
 * but better than nothing for development environments
 *
 * @param {string} str - The string to hash
 * @returns {string} - A hex-encoded hash
 */
export function simpleHash(str) {
    let hash = 0;

    if (str.length === 0) return hash.toString(16);

    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    // Add salt and convert to hex
    const salted = hash.toString(16) + "client-side-salt";

    // Generate a more complex hash from the salted string
    let h1 = 0xdeadbeef ^ salted.length;
    let h2 = 0x41c6ce57 ^ salted.length;

    for (let i = 0; i < salted.length; i++) {
        const char = salted.charCodeAt(i);
        h1 = Math.imul(h1 ^ char, 2654435761);
        h2 = Math.imul(h2 ^ char, 1597334677);
    }

    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    // Combine the two hashes and convert to a 32-character hex string
    const finalHash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
    return finalHash.toString(16).padStart(32, "0");
}

/**
 * Hashes a password using SHA-256 or falls back to simpleHash if Web Crypto API is not available
 *
 * @param {string} password - The raw password to hash
 * @returns {Promise<string>} - The hex-encoded hash
 */
export async function hashPassword(password) {
    console.log("hashPassword called");

    if (!password) {
        console.warn("Empty password provided to hashPassword");
        return "";
    }

    // Check if we can use Web Crypto API
    if (isWebCryptoAvailable()) {
        try {
            console.log("Using Web Crypto API for hashing");

            // Convert password string to array buffer
            const encoder = new TextEncoder();
            const data = encoder.encode(password);

            // Generate SHA-256 hash
            const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);

            // Convert to hex string
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

            console.log("Password hashed successfully with Web Crypto API");
            return hashHex;
        } catch (error) {
            console.error("Error with Web Crypto hashing, falling back to simple hash:", error);
            return simpleHash(password);
        }
    } else {
        console.warn("Web Crypto API not available, using fallback simple hash");
        return simpleHash(password);
    }
}

/**
 * Prepares form data for authentication by hashing the password
 *
 * @param {FormData} formData - The form data to prepare
 * @returns {Promise<Object>} - Object with username and hashed password
 */
export async function prepareAuthData(formData) {
    const username = formData.get("username")?.toString() || "";
    const rawPassword = formData.get("password")?.toString() || "";

    try {
        const hashedPassword = await hashPassword(rawPassword);

        return {
            username,
            password: hashedPassword,
            // We indicate that this password is pre-hashed
            passwordHashMethod: "sha256-client",
        };
    } catch (error) {
        console.warn("Client-side password hashing failed, falling back to server-only hashing:", error);

        // Return the data without the hashMethod indicator
        return {
            username,
            password: rawPassword,
        };
    }
}
