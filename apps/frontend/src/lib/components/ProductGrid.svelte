<script>
    import { productStore } from "$lib/stores/product.store.js";

    const { products, isLoading, hasMore, loadMore } = productStore;

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
</script>

<div class="product-grid">
    {#each $products as product (product.id)}
        <div class="product-card">
            <div class="product-card-media">
                <a href="/products/{product.skuBase}" class="product-card-img-link">
                    <figure class="product-card-img-holder">
                        <img
                            src={product.displayImageUrl || "https://placehold.co/400x500/eee/ccc?text=Product"}
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
