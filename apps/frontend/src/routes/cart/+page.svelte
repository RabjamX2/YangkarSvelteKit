<script>
    // @ts-nocheck

    import cart, { cartSubtotal, updateQuantity, removeFromCart } from "$lib/stores/cart.store.js";
    $: cartLength = $cart.length;
</script>

<svelte:head>
    <title>Your Shopping Cart</title>
</svelte:head>

<div class="cart-container">
    <h1>Your Shopping Cart</h1>

    {#if $cart.length === 0}
        <div class="empty-cart">
            <p>Your cart is empty.</p>
            <a href="/products" class="continue-shopping-btn">Continue Shopping</a>
        </div>
    {:else}
        <div class="cart-grid">
            <div class="cart-header">
                <div>Product</div>
                <div>Price</div>
                <div>Quantity</div>
                <div>Total</div>
                <div></div>
            </div>

            {#each $cart as item (item.sku)}
                <div class="cart-item">
                    <div class="product-info">
                        <img src={item.imgUrl || "/Placeholder4-5.png"} alt={item.name} class="product-image" />
                        <div>
                            <a href="/products/{item.skuBase}" class="product-name">{item.name}</a>
                            <p class="product-variant">
                                {item.color}{#if item.size}, {item.size}{/if}
                            </p>
                        </div>
                    </div>
                    <div class="item-price">${item.salePrice}</div>
                    <div class="item-quantity">
                        <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            on:change={(e) => updateQuantity(item.sku, parseInt(e.currentTarget.value))}
                            aria-label="Quantity for {item.name}"
                        />
                    </div>
                    <div class="item-total">${(item.quantity * parseFloat(item.salePrice || "0")).toFixed(2)}</div>
                    <div class="item-remove">
                        <button on:click={() => removeFromCart(item.sku)} aria-label="Remove {item.name}">×</button>
                    </div>
                </div>
            {/each}
        </div>

        <div class="cart-summary">
            <div class="subtotal">
                <span>Subtotal</span>
                <span>${$cartSubtotal.toFixed(2)}</span>
            </div>
            <p class="shipping-note">Shipping & taxes calculated at checkout.</p>
            <button class="checkout-btn">Proceed to Checkout</button>
        </div>
    {/if}
</div>

<style>
    .cart-container {
        max-width: 1100px;
        margin: 2rem auto;
        padding: 0 1rem;
    }

    h1 {
        font-size: 2rem;
        font-weight: bold;
        margin-bottom: 2rem;
        text-align: center;
    }

    .empty-cart {
        text-align: center;
        padding: 4rem 1rem;
        border: 2px dashed #ccc;
        border-radius: 8px;
    }

    .continue-shopping-btn {
        display: inline-block;
        margin-top: 1rem;
        padding: 0.75rem 1.5rem;
        background-color: var(--color-signup-bg);
        color: var(--color-signup);
        text-decoration: none;
        border-radius: 8px;
        font-weight: 500;
    }

    .cart-grid {
        display: flex;
        flex-direction: column;
    }

    .cart-header {
        display: none; /* Hidden on mobile */
    }

    @media (min-width: 768px) {
        .cart-header {
            display: grid;
            grid-template-columns: 3fr 1fr 1fr 1fr 0.5fr;
            gap: 1rem;
            padding-bottom: 1rem;
            margin-bottom: 1rem;
            border-bottom: 1px solid #eee;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 0.875rem;
            color: #666;
        }
        .cart-header > div:nth-child(n + 2) {
            text-align: right;
        }
    }

    .cart-item {
        display: grid;
        grid-template-areas:
            "product price"
            "product quantity"
            "product total"
            "product remove";
        grid-template-columns: 2fr 1fr;
        gap: 1rem;
        padding: 1.5rem 0;
        border-bottom: 1px solid #eee;
    }

    @media (min-width: 768px) {
        .cart-item {
            grid-template-columns: 3fr 1fr 1fr 1fr 0.5fr;
            grid-template-areas: "product price quantity total remove";
            align-items: center;
        }
    }

    .product-info {
        grid-area: product;
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .product-image {
        width: 80px;
        height: 100px;
        object-fit: cover;
        border-radius: 4px;
    }

    .product-name {
        font-weight: bold;
        text-decoration: none;
        color: inherit;
    }

    .product-variant {
        font-size: 0.875rem;
        color: #666;
    }

    .item-price {
        grid-area: price;
    }
    .item-quantity {
        grid-area: quantity;
    }
    .item-total {
        grid-area: total;
        font-weight: bold;
    }
    .item-remove {
        grid-area: remove;
    }

    .item-price,
    .item-quantity,
    .item-total,
    .item-remove {
        display: flex;
        justify-content: flex-end;
        align-items: center;
    }

    .item-quantity input {
        width: 60px;
        padding: 0.5rem;
        text-align: center;
        border: 1px solid #ccc;
        border-radius: 4px;
    }

    .item-remove button {
        background: none;
        border: none;
        font-size: 1.5rem;
        color: #999;
        cursor: pointer;
    }

    .cart-summary {
        margin-top: 2rem;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
    }

    .subtotal {
        font-size: 1.25rem;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        width: 100%;
        max-width: 350px;
        margin-bottom: 0.5rem;
    }

    .shipping-note {
        color: #666;
        margin-bottom: 1rem;
    }

    .checkout-btn {
        padding: 1rem 2rem;
        width: 100%;
        max-width: 350px;
        background-color: var(--color-signup-bg);
        color: var(--color-signup);
        border: none;
        border-radius: 8px;
        font-size: 1.1rem;
        font-weight: bold;
        cursor: pointer;
    }
</style>
