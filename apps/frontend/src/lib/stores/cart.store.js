import { writable, derived } from "svelte/store";
import { browser } from "$app/environment";

/**
 * @typedef {Object} CartItem
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

// --- Cart Action Methods ---
/**
 * Adds a product variant to the cart.
 * @param {import('$lib/types').ProductWithVariants} product - The main product object.
 * @param {import('$lib/types').ProductVariant} variant - The specific variant to add.
 * @param {number} quantity - The quantity to add.
 */
export function addToCart(product, variant, quantity = 1) {
    cart.update((items) => {
        // @ts-ignore
        const existingItemIndex = items.findIndex((item) => item.sku === variant.sku);

        if (existingItemIndex > -1) {
            // Return a new array with updated quantity
            // @ts-ignore
            return items.map((item, idx) =>
                idx === existingItemIndex ? { ...item, quantity: item.quantity + quantity } : item
            );
        } else {
            const newItem = {
                sku: variant.sku,
                skuBase: product.skuBase,
                name: product.name,
                color: variant.color,
                size: variant.size,
                salePrice: variant.salePrice,
                imgUrl: variant.imgUrl,
                quantity: quantity,
            };
            // Return a new array with the new item added
            // @ts-ignore
            return [...items, newItem];
        }
    });
}

/**
 * Updates the quantity of a specific item in the cart.
 * @param {string} sku - The SKU of the item to update.
 * @param {number} newQuantity - The new quantity.
 */
export function updateQuantity(sku, newQuantity) {
    cart.update((items) => {
        // @ts-ignore
        const itemIndex = items.findIndex((item) => item.sku === sku);
        if (itemIndex > -1) {
            if (newQuantity > 0) {
                // Return a new array with updated quantity
                // @ts-ignore
                return items.map((item, idx) => (idx === itemIndex ? { ...item, quantity: newQuantity } : item));
            } else {
                // Remove the item if quantity is zero or less
                // @ts-ignore
                return items.filter((item) => item.sku !== sku);
            }
        }
        return items;
    });
}

/**
 * Removes an item completely from the cart.
 * @param {string} sku - The SKU of the item to remove.
 */
export function removeFromCart(sku) {
    // @ts-ignore
    cart.update((items) => items.filter((item) => item.sku !== sku));
}

export default cart;
