/** @type {import('./$types').PageServerLoad} */
export async function load({ url, fetch }) {
    // 1. Read both sort and category parameters from the page's URL.
    // The 'category' param can be a comma-separated list.
    const sort = url.searchParams.get("sort") || "default";
    const categoriesParam = url.searchParams.get("category");

    // 2. Build the API request URL safely using URLSearchParams.
    const apiParams = new URLSearchParams();
    apiParams.set("page", "1"); // Always fetch page 1 for the initial load
    apiParams.set("sort", sort);

    // Only add the category parameter to the API call if it actually exists.
    if (categoriesParam) {
        apiParams.set("category", categoriesParam);
    }

    try {
        // 3. Fetch the initial products and the list of all categories in parallel.
        // This is more efficient than fetching them one after another.
        const [productResponse, categoriesResponse] = await Promise.all([
            fetch(`http://localhost:3000/api/products?${apiParams.toString()}`),
            fetch(`http://localhost:3000/api/categories`), // You'll need to create this API route
        ]);

        if (!productResponse.ok || !categoriesResponse.ok) {
            throw new Error("Failed to fetch initial data from the API");
        }

        const productData = await productResponse.json();
        const allCategories = await categoriesResponse.json();

        // 4. Return all the data the component needs to render.
        return {
            products: productData.data,
            meta: productData.meta,
            allCategories: allCategories, // The full list for building filter buttons
            sortKey: sort, // The currently active sort
            // Convert the URL parameter string into an array of active categories
            activeCategories: categoriesParam ? categoriesParam.split(",") : [],
        };
    } catch (error) {
        console.error("Error in server load function:", error);
        // Return a safe, empty state if the API call fails
        return {
            products: [],
            meta: { totalPages: 0 },
            allCategories: [],
            sortKey: sort,
            activeCategories: [],
        };
    }
}
