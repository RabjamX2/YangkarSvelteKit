import { writable, derived, get } from "svelte/store";
import { browser } from "$app/environment";
import { apiFetch } from "$lib/utils/api.js";

// Get backend URL from environment variable
const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;

/**
 * @typedef {Object} CartItem
 * @property {string} id - The unique ID of the product variant.
 * @property {string} sku - The unique SKU of the product variant.
 * @property {string} skuBase - The base SKU of the product.
 * @property {string} name - The product name.
 * @property {string} color - The variant color.
 * @property {string | null} size - The variant size.
 * @property {string | null} salePrice - The price of the variant.
 * @property {string | null} imgUrl - The image URL for the variant.
 * @property {number} quantity - The quantity of this item in the cart.
 */

// --- Core Cart Items Store ---
/** @type {import('svelte/store').Writable<CartItem[]>} */
// @ts-ignore
const initialCart = browser && localStorage.getItem("cart") ? JSON.parse(localStorage.getItem("cart")) : [];
const cart = writable(initialCart);

export const validationResults = writable({});
export const isCartValid = writable(true);

// Subscribe to cart changes and update localStorage
if (browser) {
    cart.subscribe((value) => {
        localStorage.setItem("cart", JSON.stringify(value));
    });
}

// --- Cart Sidebar Visibility Store ---
export const isCartOpen = writable(false);
export const toggleCart = () => isCartOpen.update((n) => !n);

// --- Derived Stores ---

/**
 * @param {CartItem[]} $cart
 * @returns {number}
 */
const calculateItemCount = ($cart) => {
    return $cart.reduce((total, item) => total + item.quantity, 0);
};

/**
 * @param {CartItem[]} $cart
 * @returns {number}
 */
const calculateSubtotal = ($cart) => {
    return $cart.reduce((total, item) => {
        const price = parseFloat(item.salePrice || "0");
        return total + price * item.quantity;
    }, 0);
};

// @ts-ignore
export const cartItemCount = derived(cart, calculateItemCount);
// @ts-ignore
export const cartSubtotal = derived(cart, calculateSubtotal);

/**
 * Validates the current cart against the backend.
 */
async function validateCart() {
    /** @type {CartItem[]} */
    // @ts-ignore
    const currentCart = get(cart); // Ensure we get the array value, not the store
    if (currentCart.length === 0) {
        validationResults.set({});
        isCartValid.set(true);
        return;
    }

    const itemsToValidate = currentCart.map((item) => ({
        productVariantId: item.id, // Assuming variant ID is stored on the item
        quantity: item.quantity,
    }));

    try {
        const response = await apiFetch("/api/cart/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: itemsToValidate }),
        });

        if (!response.ok) {
            throw new Error("Cart validation failed");
        }

        const result = await response.json();
        const resultsMap = result.validationResults.reduce((acc, res) => {
            acc[res.productVariantId] = res;
            return acc;
        }, {});

        validationResults.set(resultsMap);
        isCartValid.set(result.isValid);
    } catch (error) {
        console.error("Error validating cart:", error);
        isCartValid.set(false); // Assume invalid on error
    }
}

/**
 * Adds a product variant to the cart.
 * @param {import('$lib/types').ProductWithVariants} product - The main product object.
 * @param {import('$lib/types').ProductVariant} variant - The specific variant to add.
 * @param {number} quantity - The quantity to add.
 */
export function addToCart(product, variant, quantity = 1) {
    // @ts-ignore
    cart.update((items) => {
        /** @type {CartItem[]} */
        const arr = Array.isArray(items) ? items : [];
        const existingItemIndex = arr.findIndex((item) => item.sku === variant.sku);

        if (existingItemIndex > -1) {
            return arr.map((item, idx) =>
                idx === existingItemIndex ? { ...item, quantity: item.quantity + quantity } : item
            );
        } else {
            const newItem = {
                id: variant.id, // Add variant ID for validation
                sku: variant.sku,
                skuBase: product.skuBase,
                name: product.name,
                color: variant.color,
                size: variant.size,
                salePrice: variant.salePrice,
                imgUrl: variant.imgUrl,
                quantity: quantity,
            };
            return [...arr, newItem];
        }
    });
    validateCart(); // Validate after adding
}

/**
 * Updates the quantity of a specific item in the cart.
 * @param {string} sku - The SKU of the item to update.
 * @param {number} newQuantity - The new quantity.
 */
export function updateQuantity(sku, newQuantity) {
    // @ts-ignore
    cart.update((items) => {
        /** @type {CartItem[]} */
        const arr = Array.isArray(items) ? items : [];
        const itemIndex = arr.findIndex((item) => item.sku === sku);
        if (itemIndex > -1) {
            if (newQuantity > 0) {
                // Return a new array with updated quantity
                return arr.map((item, idx) => (idx === itemIndex ? { ...item, quantity: newQuantity } : item));
            } else {
                // Remove the item if quantity is zero or less
                return arr.filter((item) => item.sku !== sku);
            }
        }
        return arr;
    });
    validateCart(); // Validate after updating
}

/**
 * Removes an item completely from the cart.
 * @param {string} sku - The SKU of the item to remove.
 */
export function removeFromCart(sku) {
    // @ts-ignore
    cart.update((items) => {
        /** @type {CartItem[]} */
        const arr = Array.isArray(items) ? items : [];
        return arr.filter((item) => item.sku !== sku);
    });
    validateCart(); // Validate after updating
}

// Auto-validate when cart opens
isCartOpen.subscribe((open) => {
    if (open) {
        validateCart();
    }
});

export default cart;
