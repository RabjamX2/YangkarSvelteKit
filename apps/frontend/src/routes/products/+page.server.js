/** @type {import('./$types').PageServerLoad} */
export async function load({ url, fetch }) {
    // Get the 'sort' parameter from the URL, e.g., /products?sort=alpha
    const sort = url.searchParams.get("sort") || "default";

    // Always fetch page 1 for the initial server-side render.
    // The `fetch` function here is provided by SvelteKit and can make direct API requests.
    // Ensure the URL points to your running Express backend.
    const response = await fetch(`http://localhost:3000/api/products?page=1&sort=${sort}`);

    if (!response.ok) {
        // Handle errors appropriately, e.g., by returning an error status
        // that you can display in an +error.svelte file.
        console.error(`Failed to fetch initial products: ${response.statusText}`);
        return { products: [], meta: { totalPages: 0 }, sortKey: sort };
    }

    const productData = await response.json();

    // The object returned here is the `data` prop in your +page.svelte component.
    return {
        products: productData.data,
        meta: productData.meta,
        sortKey: sort, // Pass the current sort key to the component
    };
}
