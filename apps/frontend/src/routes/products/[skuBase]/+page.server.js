import { error } from "@sveltejs/kit";
import { API_BASE_URL } from "$lib/env.js";

/** @type {import('./$types').PageServerLoad} */
export async function load({ params, fetch }) {
    const { skuBase } = params;

    const response = await fetch(`${API_BASE_URL}/api/products/${skuBase}`);

    if (!response.ok) {
        if (response.status === 404) {
            throw error(404, {
                message: "Product not found",
            });
        }
        throw error(response.status, "Sorry, something went wrong while loading this product.");
    }

    /** @type {import('$lib/types').ProductWithVariants} */
    const product = await response.json();

    return {
        product,
    };
}
