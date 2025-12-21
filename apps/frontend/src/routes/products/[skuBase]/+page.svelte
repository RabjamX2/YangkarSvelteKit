<script>
    import { page } from "$app/stores";
    import { addToCart } from "$lib/stores/cart.store.js";

    /** @type {import('./$types').PageData} */
    export let data;

    // Reactive variables for the selected options
    let selectedColor = data.product.variants[0]?.color;
    let selectedSize = data.product.variants[0]?.size;
    let showToast = false;

    // Reactive statements that derive new values when dependencies change
    $: availableColors = [...new Set(data.product.variants.map((v) => v.color))];
    $: variantsForSelectedColor = data.product.variants.filter((v) => v.color === selectedColor);
    $: availableSizes = [...new Set(variantsForSelectedColor.map((v) => v.size))];
    $: selectedVariant = data.product.variants.find((v) => v.color === selectedColor && v.size === selectedSize);

    function selectColor(color) {
        selectedColor = color;
        const newSizes = [...new Set(data.product.variants.filter((v) => v.color === color).map((v) => v.size))];
        if (!newSizes.includes(selectedSize)) {
            selectedSize = newSizes[0];
        }
    }

    function handleAddToCart() {
        if (selectedVariant) {
            addToCart(data.product, selectedVariant, 1);
            showToast = true;
            setTimeout(() => (showToast = false), 3000); // Hide toast after 3 seconds
        }
    }
</script>

<svelte:head>
    <title>{data.product.name}</title>
</svelte:head>

<div class="product-detail-container">
    <div class="product-gallery">
        <img
            src={selectedVariant?.imgUrl || "/Placeholder4-5.png"}
            alt="{data.product.name} - {selectedVariant?.color}"
        />
    </div>

    <div class="product-info">
        <h1 class="product-title">{data.product.name}</h1>

        {#if selectedVariant}
            <p class="product-price">${selectedVariant.salePrice}</p>
        {:else}
            <p class="product-price">Unavailable</p>
        {/if}

        <div class="variant-selector">
            <p class="selector-label">Color: <span class="selected-value">{selectedColor}</span></p>
            <div class="options">
                {#each availableColors as color (color)}
                    <button
                        class="option-button color-swatch"
                        class:active={color === selectedColor}
                        on:click={() => selectColor(color)}
                        style="background-color: {color.toLowerCase()};"
                        aria-label="Select color {color}"
                    ></button>
                {/each}
            </div>
        </div>

        {#if availableSizes.length > 0 && availableSizes[0] !== null}
            <div class="variant-selector">
                <p class="selector-label">Size: <span class="selected-value">{selectedSize}</span></p>
                <div class="options">
                    {#each availableSizes as size (size)}
                        <button
                            class="option-button size-button"
                            class:active={size === selectedSize}
                            on:click={() => (selectedSize = size)}
                        >
                            {size}
                        </button>
                    {/each}
                </div>
            </div>
        {/if}

        <div class="add-to-cart-section">
            {#if selectedVariant}
                <button class="add-to-cart-btn" on:click={handleAddToCart} disabled={selectedVariant.stock === 0}>
                    {selectedVariant.stock > 0 ? "Add to Cart" : "Out of Stock"}
                </button>
                {#if selectedVariant.stock > 0 && selectedVariant.stock < 10}
                    <p class="stock-info">Only {selectedVariant.stock} left in stock!</p>
                {/if}
            {:else}
                <button class="add-to-cart-btn" disabled>Unavailable</button>
            {/if}
        </div>

        <!-- <div class="product-description">
            <h3>Description</h3>
            <p>{data.product.notes || "No description available."}</p>
        </div> -->
    </div>
</div>

{#if showToast}
    <div class="toast">
        <p>Added to cart!</p>
    </div>
{/if}

<style>
    .product-detail-container {
        display: grid;
        grid-template-columns: 1fr;
        gap: 2rem;
        max-width: 1200px;
        margin: 2rem auto;
        padding: 0 1rem;
    }

    @media (min-width: 768px) {
        .product-detail-container {
            grid-template-columns: 1fr 1fr;
            gap: 4rem;
        }
    }

    .product-gallery img {
        width: 100%;
        height: auto;
        aspect-ratio: 4 / 5;
        object-fit: cover;
        border-radius: 8px;
    }

    .product-info {
        display: flex;
        flex-direction: column;
    }

    .product-title {
        font-size: 2.5rem;
        font-weight: bold;
        margin-bottom: 0.5rem;
    }

    .product-price {
        font-size: var(--font-size-2xl);
        font-weight: var(--font-weight-normal);
        color: var(--color-link-hover);
        margin-bottom: var(--space-8);
    }

    .variant-selector {
        margin-bottom: var(--space-6);
    }

    .selector-label {
        font-size: var(--font-size-medium);
        font-weight: var(--font-weight-medium);
        margin-bottom: var(--space-3);
    }

    .selected-value {
        font-weight: normal;
        color: #666;
    }

    .options {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
    }

    .option-button {
        min-width: 50px;
        height: 50px;
        padding: 0.5rem;
        border: 2px solid #ccc;
        background-color: #fff;
        cursor: pointer;
        border-radius: 8px;
        transition: border-color 0.2s;
    }

    .option-button:hover {
        border-color: #333;
    }

    .option-button.active {
        border-color: var(--color-link-hover);
        box-shadow: 0 0 0 2px var(--color-link-hover);
    }

    .color-swatch {
        border-radius: 50%;
    }

    .add-to-cart-section {
        margin-top: 1rem;
        margin-bottom: 2rem;
    }

    .add-to-cart-btn {
        width: 100%;
        padding: 1rem;
        font-size: 1.1rem;
        font-weight: bold;
        color: var(--color-signup);
        background-color: var(--color-signup-bg);
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .add-to-cart-btn:hover:not(:disabled) {
        background-color: var(--color-signup-bg-hover);
    }

    .add-to-cart-btn:disabled {
        background-color: #ccc;
        cursor: not-allowed;
    }

    .stock-info {
        text-align: center;
        margin-top: var(--space-2);
        color: var(--color-danger);
        font-weight: var(--font-weight-medium);
    }

    .product-description h3 {
        font-size: var(--font-size-large);
        font-weight: var(--font-weight-bold);
        margin-bottom: var(--space-2);
        border-bottom: 1px solid #eee;
        padding-bottom: 0.5rem;
    }

    .product-description p {
        line-height: 1.6;
    }

    .toast {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #333;
        color: white;
        padding: 1rem 2rem;
        border-radius: 8px;
        z-index: 1000;
        animation:
            fadein 0.5s,
            fadeout 0.5s 2.5s;
    }

    @keyframes fadein {
        from {
            bottom: 0;
            opacity: 0;
        }
        to {
            bottom: 20px;
            opacity: 1;
        }
    }

    @keyframes fadeout {
        from {
            bottom: 20px;
            opacity: 1;
        }
        to {
            bottom: 0;
            opacity: 0;
        }
    }
</style>
