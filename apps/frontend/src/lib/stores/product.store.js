// @ts-nocheck
import { writable, derived, get } from "svelte/store";
import { goto } from "$app/navigation";
import { apiFetch } from "$lib/utils/api.js";

function createProductStore() {
    // --- Writable Stores ---
    // These hold the core, modifiable state of our page.
    const products = writable([]);
    const meta = writable({ currentPage: 1, totalPages: 1 });
    const isLoading = writable(false);
    const hasMore = writable(true);

    // Filter and sort state
    const activeCategories = writable(new Set());
    const sortKey = writable("default");
    const allCategories = writable([]);
    const hideOutOfStock = writable(true);

    // --- Derived Stores ---
    // These react to changes in the core state.
    const hasActiveFilters = derived(activeCategories, ($activeCategories) => $activeCategories.size > 0);

    function getVariantStock(variant) {
        if (typeof variant.stock === "number") return variant.stock;
        if (Array.isArray(variant.inventoryBatches)) {
            return variant.inventoryBatches.reduce((sum, b) => sum + (b.quantity ?? 0), 0);
        }
        return 0; // no stock data — treat as out of stock
    }

    const filteredProducts = derived([products, hideOutOfStock], ([$products, $hideOutOfStock]) => {
        if (!$hideOutOfStock) return $products;
        return $products.filter((p) => p.variants?.some((v) => v.visable !== false && getVariantStock(v) > 0));
    });

    // --- Methods ---

    /**
     * Initializes the store with data from the server load function.
     */
    function initialize(initialData) {
        const cats = initialData.allCategories || [];
        const urlCats = initialData.activeCategories || [];
        products.set(initialData.products || []);
        meta.set(initialData.meta || { currentPage: 1, totalPages: 1 });
        allCategories.set(cats);
        sortKey.set(initialData.sortKey || "default");
        // Default to all categories active when no URL filter is present
        activeCategories.set(new Set(urlCats.length > 0 ? urlCats : cats.map((c) => c.name)));
        hasMore.set((initialData.meta?.currentPage || 1) < (initialData.meta?.totalPages || 1));
        isLoading.set(false);
    }

    /**
     * Fetches the next page of products for infinite scrolling.
     */
    async function loadMore() {
        // Use `get` for a one-time synchronous read of the store's value.
        if (get(isLoading) || !get(hasMore)) return;
        isLoading.set(true);

        const currentMeta = get(meta);
        const currentSortKey = get(sortKey);
        const currentActiveCategories = get(activeCategories);

        const nextPage = currentMeta.currentPage + 1;
        const params = new URLSearchParams();
        params.set("page", String(nextPage));
        params.set("sort", currentSortKey);

        if (currentActiveCategories.size > 0) {
            params.set("category", Array.from(currentActiveCategories).join(","));
        }

        try {
            // Use the apiFetch utility to handle token refresh
            const response = await apiFetch(`/api/products?${params.toString()}`);
            if (!response.ok) throw new Error("Failed to fetch more products");

            const newData = await response.json();

            // Update the products store with the new data
            products.update((currentProducts) => [...currentProducts, ...newData.data]);
            meta.set(newData.meta);
            hasMore.set(newData.meta.currentPage < newData.meta.totalPages);
        } catch (error) {
            console.error("Error loading more products:", error);
            hasMore.set(false); // Stop trying if there's an error
        } finally {
            isLoading.set(false);
        }
    }

    /**
     * Navigates to a new URL based on the current filter and sort state.
     * This will trigger a server-side reload of the page data.
     */
    function applyFiltersAndSort() {
        const currentSortKey = get(sortKey);
        const currentActiveCategories = get(activeCategories);
        const allCats = get(allCategories);

        const params = new URLSearchParams();
        params.set("page", "1"); // Always reset to page 1 when filters/sort change
        params.set("sort", currentSortKey);

        // Only send category param if it's a subset — omitting it means "show all"
        if (currentActiveCategories.size > 0 && currentActiveCategories.size < allCats.length) {
            params.set("category", Array.from(currentActiveCategories).join(","));
        }

        goto(`/products?${params.toString()}`, { noScroll: true, keepFocus: true });
    }

    /**
     * Toggles a category in the active filter set and applies the changes.
     * @param {string} categoryName - The name of the category to toggle.
     */
    function toggleCategory(categoryName) {
        activeCategories.update((set) => {
            if (set.has(categoryName)) {
                set.delete(categoryName);
            } else {
                set.add(categoryName);
            }
            // If all deselected, reset to all categories
            if (set.size === 0) {
                get(allCategories).forEach((c) => set.add(c.name));
            }
            return set;
        });
        applyFiltersAndSort();
    }

    /**
     * Updates the sort key and applies the change.
     * @param {string} newSortKey - The new sort key.
     */
    function changeSort(newSortKey) {
        sortKey.set(newSortKey);
        applyFiltersAndSort();
    }

    function toggleHideOutOfStock() {
        hideOutOfStock.update((v) => !v);
    }

    /**
     * Gets product colors for a specific product
     */
    async function getProductColors(productId) {
        try {
            const response = await apiFetch(`/api/products/${productId}/colors`);
            if (!response.ok) throw new Error("Failed to fetch product colors");

            return await response.json();
        } catch (error) {
            console.error("Error loading product colors:", error);
            return [];
        }
    }

    /**
     * Updates images for all variants of a specific product color
     */
    async function updateColorImages(productId, color, imgUrl) {
        try {
            const response = await apiFetch(`/api/product-color-image`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ productId, color, imgUrl }),
            });

            if (!response.ok) throw new Error("Failed to update color images");

            return await response.json();
        } catch (error) {
            console.error("Error updating color images:", error);
            throw error;
        }
    }

    /**
     * Updates image for a specific variant
     */
    async function updateVariantImage(variantId, imgUrl) {
        try {
            const response = await apiFetch(`/api/variants/${variantId}/image`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ imgUrl }),
            });

            if (!response.ok) throw new Error("Failed to update variant image");

            return await response.json();
        } catch (error) {
            console.error("Error updating variant image:", error);
            throw error;
        }
    }

    return {
        // Make the stores available to components
        subscribe: products.subscribe,
        products,
        filteredProducts,
        meta,
        isLoading,
        hasMore,
        activeCategories,
        sortKey,
        allCategories,
        hasActiveFilters,
        hideOutOfStock,

        // Make the methods available
        initialize,
        loadMore,
        toggleCategory,
        changeSort,
        toggleHideOutOfStock,

        // New color/image management methods
        getProductColors,
        updateColorImages,
        updateVariantImage,
    };
}

export const productStore = createProductStore();
