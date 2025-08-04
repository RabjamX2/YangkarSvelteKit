<script>
    import { goto } from "$app/navigation";

    export let data;

    // --- Component State ---
    let products = data.products;
    let meta = data.meta;
    let isLoading = false;
    let hasMore = data.meta.currentPage < data.meta.totalPages;

    // --- Filter & Sort State ---
    // Use a Set for efficient management of active categories
    let activeCategories = new Set(data.activeCategories);
    let sortKey = data.sortKey;
    let allCategories = data.allCategories;

    // This reactive block resets the component's state when navigation occurs
    $: if (data) {
        products = data.products;
        meta = data.meta;
        hasMore = meta.currentPage < meta.totalPages;
        isLoading = false;
        sortKey = data.sortKey;
        // Re-initialize the Set from the new `data` prop
        activeCategories = new Set(data.activeCategories);
    }

    // --- Data Fetching ---
    async function loadMore() {
        if (isLoading || !hasMore) return;
        isLoading = true;

        const nextPage = meta.currentPage + 1;
        const params = new URLSearchParams();
        params.set("page", String(nextPage));
        params.set("sort", sortKey);

        if (activeCategories.size > 0) {
            params.set("category", Array.from(activeCategories).join(","));
        }

        const response = await fetch(`/api/products?${params.toString()}`);
        const newData = await response.json();

        products = [...products, ...newData.data];
        meta = newData.meta;
        hasMore = meta.currentPage < meta.totalPages;
        isLoading = false;
    }

    // --- Navigation ---
    function handleFilterChange() {
        const params = new URLSearchParams();
        params.set("sort", sortKey);

        if (activeCategories.size > 0) {
            params.set("category", Array.from(activeCategories).join(","));
        }

        // Use goto to re-run the `load` function with the new URL
        goto(`?${params.toString()}`, { noScroll: true, keepFocus: true });
    }

    function handleSortChange(newSort) {
        sortKey = newSort;
        handleFilterChange(); // Re-run the filter change to navigate
    }

    function toggleCategory(categoryName) {
        if (activeCategories.has(categoryName)) {
            activeCategories.delete(categoryName);
        } else {
            activeCategories.add(categoryName);
        }
        // After changing the category, trigger navigation
        handleFilterChange();
    }

    // --- Intersection Observer ---
    function observe(node) {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadMore();
                }
            },
            { rootMargin: "200px" }
        );
        observer.observe(node);
        return {
            destroy() {
                observer.unobserve(node);
            },
        };
    }
</script>

<!-- UI for Category Filters -->
<div class="filter-controls">
    <span>Category:</span>
    {#each allCategories as category (category.id)}
        <button on:click={() => toggleCategory(category.name)} class:active={activeCategories.has(category.name)}>
            {category.name}
        </button>
    {/each}
</div>

<!-- UI for changing sort order -->
<div class="sort-controls">
    <button on:click={() => handleSortChange("default")} class:active={sortKey === "default"}> Newest </button>
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
                    <p class="product-card-sku">{product.skuBase}</p>
                    {#if product.minSalePrice}
                        <span class="product-card-price">${product.minSalePrice}</span>
                    {:else}
                        <span class="product-card-price">Coming Soon</span>
                    {/if}
                </div>
            </div>
        </div>
    {/each}
</div>

{#if hasMore}
    <div class="sentinel" use:observe></div>
{/if}

{#if isLoading}
    <div class="loading-indicator">
        <p>Loading more products...</p>
    </div>
{/if}

<style>
    .filter-controls,
    .sort-controls {
        display: flex;
        justify-content: center;
        gap: 0.5rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
    }
    button {
        padding: 0.5rem 1rem;
        border: 1px solid #ccc;
        background-color: #fff;
        cursor: pointer;
        border-radius: 999px;
        transition: all 0.2s ease;
    }
    button:hover {
        background-color: #f0f0f0;
        border-color: #999;
    }
    button.active {
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
        font-family: var(--font-primary);
        font-size: 14px;
        letter-spacing: var(--custom-letter-spacing);
        line-height: 1.58333;
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
    }
    .product-card-media {
        width: 100%;
        border-bottom: 1px solid #1900ff;
    }
    .product-card-img-holder {
        width: 100%;
        height: 100%;
        padding: 0;
        margin: 0;
    }
    .product-card img {
        display: block;
        width: 100%;
        height: 100%;
        aspect-ratio: 4 / 5;
        object-fit: cover;
        object-position: center center;
    }
    .product-card-info {
        padding: 15px 15px;
        word-wrap: break-word;
        word-break: break-word;
    }
    .product-card-info-title {
        font-weight: bold;
        text-decoration: none;
        color: inherit;
        display: block;
        font-size: 14px;
    }
    .product-card-sku {
        font-size: 14px;
        color: #666;
    }
    .product-card-price {
        font-weight: bold;
        font-size: 14px;
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
