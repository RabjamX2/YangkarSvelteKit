<script>
    import { productStore } from "$lib/stores/product.store.js";

    const { products, isLoading, hasMore, loadMore } = productStore;

    // Track selected variant for each product
    let selectedVariants = {};

    // Function to select a different variant color
    function selectVariantColor(productId, color) {
        const product = $products.find((p) => p.id === productId);
        if (product && product.variants) {
            // Only consider visible variants
            const variant = product.variants.find((v) => v.color === color && v.visable !== false);
            if (variant) {
                selectedVariants[productId] = variant;
            }
        }
    }

    // --- Intersection Observer for infinite scroll ---
    function observe(node) {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadMore();
                }
            },
            { rootMargin: "200px" } // Load next page when 200px from the bottom
        );
        observer.observe(node);
        return {
            destroy() {
                observer.unobserve(node);
            },
        };
    }

    // Initialize the selected variants with the first visible variant for each product
    $: {
        if ($products) {
            $products.forEach((product) => {
                // Check if product has visible variants
                const visibleVariants = product.variants?.filter((v) => v.visable !== false) || [];

                if (visibleVariants.length > 0 && !selectedVariants[product.id]) {
                    selectedVariants[product.id] = visibleVariants[0];
                }
            });
        }
    }
</script>

<div class="product-grid">
    {#each $products as product (product.id)}
        {#if product.variants && product.variants.filter((v) => v.visable !== false).length > 0}
            <div class="product-card">
                <div class="product-card-media">
                    <a href="/products/{product.skuBase}" class="product-card-img-link">
                        <figure class="product-card-img-holder">
                            <img
                                src={selectedVariants[product.id]?.imgUrl || product.displayImageUrl}
                                alt={product.displayName}
                            />
                        </figure>
                    </a>
                </div>
                <div class="product-card-info">
                    <a href="/products/{product.skuBase}" class="product-card-info-title">{product.displayName}</a>
                    <div class="product-card-meta">
                        {#if selectedVariants[product.id]?.salePrice}
                            <span class="product-card-price">${selectedVariants[product.id].salePrice}</span>
                        {:else if product.minSalePrice}
                            <span class="product-card-price">${product.minSalePrice}</span>
                        {:else}
                            <span class="product-card-price">Coming Soon</span>
                        {/if}
                    </div>
                    {#if product.variants && product.variants.filter((v) => v.visable !== false).length > 1}
                        <div class="product-card-variants">
                            {#each [...new Set(product.variants
                                        .filter((v) => v.visable !== false)
                                        .map((v) => v.color))].slice(0, 4) as color}
                                <button
                                    class="color-swatch"
                                    class:active={selectedVariants[product.id]?.color === color}
                                    style="background-color: {color.toLowerCase()};"
                                    aria-label="Select {color}"
                                    on:click|stopPropagation|preventDefault={() =>
                                        selectVariantColor(product.id, color)}
                                ></button>
                            {/each}
                            {#if [...new Set(product.variants
                                        .filter((v) => v.visable !== false)
                                        .map((v) => v.color))].length > 4}
                                <span class="more-variants">+</span>
                            {/if}
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    {/each}
</div>

{#if $hasMore}
    <div class="sentinel" use:observe></div>
{/if}

{#if $isLoading}
    <div class="loading-indicator">
        <p>Loading more products...</p>
    </div>
{/if}

<style>
    .product-grid {
        display: flex;
        flex-wrap: wrap;
        margin-left: auto;
        margin-right: auto;
        max-width: 1920px;
        border: 1px solid #000000;
        border-right: 0;
        font-family: var(--font-primary);
        font-size: var(--font-size-small);
        letter-spacing: var(--letter-spacing);
        line-height: var(--line-height-normal);
    }
    .product-card {
        flex: 1 0 50%; /* 2 columns by default */
        max-width: 50%;
        box-sizing: border-box;
        text-decoration: none;
        color: inherit;
        border-bottom: 1px solid #000000;
        border-right: 1px solid #000000;
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
        border-bottom: 1px solid #000000;
    }
    .product-card-img-holder {
        width: 100%;
        padding: 0;
        margin: 0;
    }
    .product-card img {
        display: block;
        width: 100%;
        height: auto;
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
    .product-card-meta {
        margin-top: 8px;
    }
    .product-card-price {
        font-size: 14px;
    }
    .product-card-variants {
        display: flex;
        gap: 8px;
        margin-top: 8px;
    }
    .color-swatch {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: 1px solid #ddd;
        padding: 0;
        cursor: pointer;
        transition:
            transform 0.2s,
            border-color 0.2s;
    }
    .color-swatch:hover {
        transform: scale(1.1);
    }
    .color-swatch.active {
        border: 2px solid #000;
    }
    .more-variants {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #eee;
        color: #666;
        font-size: 12px;
        line-height: 1;
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
