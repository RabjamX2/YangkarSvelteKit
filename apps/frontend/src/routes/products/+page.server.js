export const load = async () => {
    console.log("Fetching products...");
    try {
        const response = await fetch("http://localhost:3000/api/products");
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const products = await response.json();
        return {
            products,
        };
    } catch (error) {
        console.error("Failed to fetch products:", error);
        return {
            products: [],
            error: "Could not load products.",
        };
    }
};
