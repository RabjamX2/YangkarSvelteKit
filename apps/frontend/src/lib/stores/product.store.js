import { writable, derived, get } from "svelte/store";
import { goto } from "$app/navigation";
import { API_BASE_URL } from "../env.js";

/**
 * @typedef {Object} ProductSummary
 * @property {number} id
 * @property {string} skuBase
 * @property {string} name
 * @property {string} createdAt
 * @property {string | null} minSalePrice - Represented as a string from Prisma Decimal
 * @property {string | null} displayImageUrl
 */

/**
 * @typedef {Object} Category
 * @property {number} id
 * @property {string} name
 */

/**
 * @typedef {Object} MetaData
 * @property {number} currentPage
 * @property {number} totalPages
 */

function createProductStore() {
    // --- Writable Stores ---
    // These hold the core, modifiable state of our page.
    /** @type {import('svelte/store').Writable<ProductSummary[]>} */
    const products = writable([]);
    /** @type {import('svelte/store').Writable<MetaData>} */
    const meta = writable({ currentPage: 1, totalPages: 1 });
    const isLoading = writable(false);
    const hasMore = writable(true);

    // Filter and sort state
    /** @type {import('svelte/store').Writable<Set<string>>} */
    const activeCategories = writable(new Set());
    const sortKey = writable("default");
    /** @type {import('svelte/store').Writable<Category[]>} */
    const allCategories = writable([]);

    // --- Derived Stores ---
    // These react to changes in the core state.
    const hasActiveFilters = derived(activeCategories, ($activeCategories) => $activeCategories.size > 0);

    // --- Methods ---

    /**
     * Initializes the store with data from the server load function.
     * @param {object} initialData - The data object from +page.server.js.
     */
    function initialize(initialData) {
        products.set(initialData.products || []);
        meta.set(initialData.meta || { currentPage: 1, totalPages: 1 });
        allCategories.set(initialData.allCategories || []);
        sortKey.set(initialData.sortKey || "default");
        activeCategories.set(new Set(initialData.activeCategories || []));
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
            // We fetch from the backend API directly here
            const response = await fetch(`${API_BASE_URL}/api/products?${params.toString()}`);
            if (!response.ok) throw new Error("Failed to fetch more products");

            const newData = await response.json();

            products.update((p) => [...p, ...newData.data]);
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

        const params = new URLSearchParams();
        params.set("sort", currentSortKey);

        if (currentActiveCategories.size > 0) {
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

    return {
        // Make the stores available to components
        subscribe: products.subscribe,
        products,
        meta,
        isLoading,
        hasMore,
        activeCategories,
        sortKey,
        allCategories,
        hasActiveFilters,

        // Make the methods available
        initialize,
        loadMore,
        toggleCategory,
        changeSort,
    };
}

export const productStore = createProductStore();
