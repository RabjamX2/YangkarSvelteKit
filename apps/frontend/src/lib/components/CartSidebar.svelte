<script>
    // @ts-nocheck

    import { fly } from "svelte/transition";
    import cart, {
        cartSubtotal,
        updateQuantity,
        removeFromCart,
        isCartOpen,
        validationResults,
        isCartValid,
    } from "$lib/stores/cart.store.js";

    function closeCart() {
        isCartOpen.set(false);
    }
</script>

<button
    class="overlay"
    aria-label="test"
    tabindex="0"
    on:click={closeCart}
    transition:fly={{ duration: 300, x: "100%" }}
></button>

<aside class="cart-sidebar" transition:fly={{ duration: 300, x: "100%" }}>
    <div class="cart-header">
        <a href="/cart" class="cart-link" on:click={closeCart}>Your Cart</a>
        <button on:click={closeCart} class="close-btn" aria-label="Close cart">×</button>
    </div>

    {#if $cart.length === 0}
        <div class="empty-cart">
            <p>Your cart is empty.</p>
        </div>
    {:else}
        <div class="cart-items">
            {#each $cart as item (item.sku)}
                {@const validation = $validationResults[item.id]}
                <div class="cart-item" class:invalid={validation && !validation.isValid}>
                    <img src={item.imgUrl || "/Placeholder4-5.png"} alt={item.name} class="product-image" />
                    <div class="item-details">
                        {#if validation && !validation.isValid}
                            <p class="validation-error">{validation.reason}</p>
                        {/if}
                        <a href="/products/{item.skuBase}" class="product-name" on:click={closeCart}>{item.name}</a>
                        <p class="product-variant">
                            {item.color}{#if item.size}, {item.size}{/if}
                        </p>
                        <div class="quantity-controls">
                            <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                on:change={(e) => updateQuantity(item.sku, parseInt(e.currentTarget.value))}
                                aria-label="Quantity for {item.name}"
                            />
                            <span class="item-price"
                                >${(item.quantity * parseFloat(item.salePrice || "0")).toFixed(2)}</span
                            >
                        </div>
                    </div>
                    <button
                        on:click={() => removeFromCart(item.sku)}
                        class="remove-item-btn"
                        aria-label="Remove {item.name}">×</button
                    >
                </div>
            {/each}
        </div>
    {/if}

    {#if $cart.length > 0}
        <div class="cart-footer">
            <div class="subtotal">
                <span>Subtotal</span>
                <span>${$cartSubtotal.toFixed(2)}</span>
            </div>
            <p class="shipping-note">Shipping & taxes calculated at checkout.</p>
            <button class="checkout-btn" disabled={!$isCartValid}
                >{#if !$isCartValid}
                    Cart has issues
                {:else}
                    <!-- Proceed to Checkout -->
                    Checkout not available yet
                {/if}</button
            >
        </div>
    {/if}
</aside>

<style>
    .overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 1000;
    }

    .cart-sidebar {
        position: fixed;
        top: 0;
        right: 0;
        width: 90%;
        max-width: 400px;
        height: 100%;
        background-color: var(--color-bg);
        z-index: 1001;
        box-shadow: -5px 0 15px rgba(0, 0, 0, 0.2);
        display: flex;
        flex-direction: column;
    }

    .cart-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid var(--color-border);
    }

    .cart-link {
        font-size: 1.25rem;
        font-weight: bold;
        color: var(--color-link);
        text-decoration: none;
    }
    .cart-link:hover {
        text-decoration: underline;
    }

    .close-btn {
        background: none;
        border: none;
        font-size: 2rem;
        cursor: pointer;
        color: var(--color-link);
    }

    .cart-items {
        flex-grow: 1;
        overflow-y: auto;
        padding: 1.5rem;
    }

    .empty-cart {
        padding: 2rem;
        text-align: center;
    }

    .cart-item {
        display: flex;
        gap: 1rem;
        margin-bottom: 1.5rem;
    }

    .product-image {
        width: 80px;
        height: 100px;
        object-fit: cover;
        border-radius: 4px;
    }

    .item-details {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
    }

    .product-name {
        font-weight: 500;
        text-decoration: none;
        color: inherit;
    }

    .product-variant {
        font-size: 0.875rem;
        color: #666;
        margin-bottom: auto;
    }

    .quantity-controls {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 0.5rem;
    }

    .quantity-controls input {
        width: 50px;
        padding: 0.25rem;
        text-align: center;
        border: 1px solid #ccc;
        border-radius: 4px;
    }

    .item-price {
        font-weight: 500;
    }

    .remove-item-btn {
        background: none;
        border: none;
        font-size: 1.25rem;
        color: #999;
        cursor: pointer;
    }

    .cart-footer {
        padding: 1.5rem;
        border-top: 1px solid var(--color-border);
        background-color: var(--color-bg);
    }

    .subtotal {
        display: flex;
        justify-content: space-between;
        font-size: 1.1rem;
        font-weight: bold;
        margin-bottom: 0.5rem;
    }

    .shipping-note {
        font-size: 0.875rem;
        color: #666;
        margin-bottom: 1rem;
        text-align: center;
    }

    .checkout-btn {
        width: 100%;
        padding: 1rem;
        background-color: var(--color-signup-bg);
        color: var(--color-signup);
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: bold;
        cursor: pointer;
    }

    .cart-item.invalid {
        background-color: #fef2f2; /* Example invalid background */
        border: 1px solid #fecaca;
        border-radius: 4px;
    }

    .validation-error {
        color: #e53e3e;
        font-size: 0.875rem;
        margin-top: 0.5rem;
    }

    .checkout-btn:disabled {
        background-color: #ccc;
        cursor: not-allowed;
    }
</style>
