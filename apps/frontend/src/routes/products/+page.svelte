<script>
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";

    // 1. Get the initial data (page 1) from the `load` function.
    export let data;

    // 2. Create local, reactive state based on the initial data.
    // We use `let` because these variables will be updated as we load more.
    let products = data.products;
    let meta = data.meta;
    let sortKey = data.sortKey;

    let isLoading = false; // Prevents fetching multiple pages at once.
    let hasMore = meta.currentPage < meta.totalPages; // Is there more data to load?

    // 3. When `data` from the `load` function changes (i.e., on sort change),
    // we MUST reset the component's state to reflect the new data.
    $: if (data) {
        products = data.products;
        meta = data.meta;
        sortKey = data.sortKey;
        hasMore = meta.currentPage < meta.totalPages;
        // Ensure loading is reset for the new list
        isLoading = false;
    }

    // 4. This function fetches the next page of products.
    async function loadMore() {
        // Don't load if we're already loading or if there are no more pages.
        if (isLoading || !hasMore) return;

        isLoading = true;
        const nextPage = meta.currentPage + 1;

        try {
            // Fetch the next page with the current sort order.
            const response = await fetch(`/api/products?page=${nextPage}&sort=${sortKey}`);
            if (!response.ok) throw new Error("Failed to fetch products");

            const newData = await response.json();

            // Append the new products to our existing list.
            products = [...products, ...newData.data];

            // Update the metadata (current page, total pages).
            meta = newData.meta;

            // Re-evaluate if there are still more pages to load.
            hasMore = meta.currentPage < meta.totalPages;
        } catch (error) {
            console.error("Error loading more products:", error);
            // Optionally show an error message to the user
        } finally {
            isLoading = false;
        }
    }

    // 5. This is a Svelte Action that uses the IntersectionObserver API.
    // It's a clean and reusable way to detect when an element enters the screen.
    function observe(node) {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    // The sentinel is visible, so load more products.
                    loadMore();
                }
            },
            { rootMargin: "200px" } // Optional: start loading 200px before the user reaches the bottom.
        );

        observer.observe(node);

        return {
            destroy() {
                observer.unobserve(node);
            },
        };
    }

    // 6. When a user clicks a sort button, navigate. SvelteKit re-runs `load`.
    function handleSortChange(newSort) {
        // Avoid navigating if the sort is already active.
        if (newSort === sortKey) return;

        // Using `goto` tells SvelteKit to re-run the `load` function on this page.
        // This will fetch page 1 of the new sort order and reset our component.
        goto(`/products?sort=${newSort}`, {
            noScroll: true, // Prevents the page from jumping to the top.
        });
    }
</script>

<!-- UI for changing sort order -->
<div class="sort-controls">
    <span>Sort by:</span>
    <button on:click={() => handleSortChange("default")} class:active={sortKey === "default"}> Newest </button>
    <button on:click={() => handleSortChange("alpha")} class:active={sortKey === "alpha"}> Alphabetical </button>
    <button on:click={() => handleSortChange("price_asc")} class:active={sortKey === "price_asc"}>
        Price: Low to High
    </button>
    <button on:click={() => handleSortChange("price_desc")} class:active={sortKey === "price_desc"}>
        Price: High to Low
    </button>
</div>

<!-- Product grid iterates over our local `products` array -->
<div class="product-grid">
    {#each products as product (product.id)}
        <!-- Your ProductCard component here -->
        <div class="product-card">
            <div class="product-card-media">
                <a href="/products/{product.skuBase}" class="product-card-img-link">
                    <figure class="product-card-img-holder">
                        <img
                            src={product.displayImageUrl || "https://placehold.co/400x400/eee/ccc?text=Product"}
                            alt={product.name}
                        />
                    </figure>
                </a>
            </div>
            <div class="product-card-info">
                <a href="/products/{product.skuBase}" class="product-card-info-title">{product.name}</a>
                <div class="product-card-meta">
                    <span class="product-card-sku">{product.skuBase}</span>
                    <!-- Display the minimum price. Add a check in case a product has no variants with a price yet -->
                    {#if product.minSalePrice}
                        <p>${product.minSalePrice}</p>
                    {:else}
                        <p>Price not available</p>
                    {/if}
                </div>
                <div class="product-card-swatches">
                    {#each product.variants as variant (variant.id)}
                        <span class="product-card-swatch" style="background-color: {variant.color}"></span>
                    {/each}
                </div>
            </div>
        </div>
    {/each}
</div>

<!-- This invisible element is the "sentinel". When it comes into view,
     the `observe` action will call `loadMore`. -->
{#if hasMore}
    <div class="sentinel" use:observe></div>
{/if}

<!-- A loading indicator shown at the bottom while fetching. -->
{#if isLoading}
    <div class="loading-indicator">
        <p>Loading more products...</p>
    </div>
{/if}

<style>
    .sort-controls {
        display: flex;
        justify-content: center;
        gap: 0.5rem;
        margin-bottom: 2rem;
        flex-wrap: wrap;
    }
    .sort-controls button {
        padding: 0.5rem 1rem;
        border: 1px solid #ccc;
        background-color: #fff;
        cursor: pointer;
        border-radius: 999px;
        transition: all 0.2s ease;
    }
    .sort-controls button:hover {
        background-color: #f0f0f0;
        border-color: #999;
    }
    .sort-controls button.active {
        background-color: #333;
        color: #fff;
        border-color: #333;
    }

    .product-grid {
        display: flex;
        flex-wrap: wrap;
        margin-left: auto;
        margin-right: auto;
        max-width: 1920px;
        border: 1px solid #1900ff;
        border-right: 0;
    }
    .product-card {
        flex: 1 0 50%; /* 2 columns by default */
        max-width: 50%;
        box-sizing: border-box;
        text-decoration: none;
        color: inherit;
        border-bottom: 1px solid #1900ff;
        border-right: 1px solid #1900ff;
        padding: 0;
        margin: 0;
    }
    @media (min-width: 732px) and (max-width: 1000px) {
        .product-card {
            flex: 1 0 33.3333%; /* 3 columns */
            max-width: 33.3333%;
        }
    }
    @media (min-width: 1001px) {
        .product-card {
            flex: 1 0 25%; /* 4 columns */
            max-width: 25%;
        }
        .product-grid {
            margin-left: auto;
            margin-right: auto;
            max-width: 1920px;
        }
    }

    .product-card-media {
        width: 100%;
        border-bottom: 1px solid #1900ff;
    }
    .product-card-img-holder {
        width: 100%;
        height: 100%;
        padding: 0 0;
        margin: 0 0;
    }
    .product-card img {
        display: block;
        /* position: absolute; */
        /* top: 0;
        left: 0; */
        width: 100%;
        height: 100%;
        aspect-ratio: 4 / 5;
        object-fit: cover;
        object-position: center center;
    }
    .product-card-info {
        border: 0;
    }

    .loading-indicator,
    .sentinel {
        height: 50px;
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-top: 2rem;
    }
</style>
