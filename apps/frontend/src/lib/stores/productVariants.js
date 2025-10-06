import { writable } from "svelte/store";

export const productVariants = writable([]);

export async function fetchProductVariants(backendUrl, fetchAuth) {
    try {
        const res = await fetchAuth(`${backendUrl}/api/products-with-variants?limit=1000`);
        if (!res.ok) throw new Error("Failed to fetch product variants");
        const data = await res.json();
        // Flatten all variants from all products
        const variants = (data.data || []).flatMap((product) =>
            product.variants.map((v) => ({
                ...v,
                displayName: product.displayName,
                skuBase: product.skuBase,
            }))
        );
        productVariants.set(variants);
        return variants;
    } catch (e) {
        productVariants.set([]);
        return [];
    }
}
