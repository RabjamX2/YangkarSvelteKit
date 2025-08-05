import { error } from "@sveltejs/kit";

/** @type {import('./$types').PageServerLoad} */
export async function load({ params, fetch }) {
    const { skuBase } = params;

    const response = await fetch(`http://localhost:3000/api/products/${skuBase}`);

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
