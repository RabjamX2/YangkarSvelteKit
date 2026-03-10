<script>
    // @ts-nocheck

    import { fly, fade } from "svelte/transition";
    import { get } from "svelte/store";
    import cart, {
        cartSubtotal,
        updateQuantity,
        removeFromCart,
        isCartOpen,
        validationResults,
        isCartValid,
    } from "$lib/stores/cart.store.js";
    import { apiFetch } from "$lib/utils/api.js";

    function closeCart() {
        isCartOpen.set(false);
    }

    // --- Order Request ---
    let showRequestForm = false;
    let submitting = false;
    let submitSuccess = false;
    let submitError = "";
    let formName = "",
        formEmail = "",
        formPhone = "",
        formInstagram = "",
        formNotes = "";

    function openRequestForm() {
        showRequestForm = true;
        submitSuccess = false;
        submitError = "";
    }

    async function submitOrderRequest() {
        submitting = true;
        submitError = "";
        if (!formEmail && !formPhone && !formInstagram) {
            submitError = "Please provide at least one contact method.";
            submitting = false;
            return;
        }
        try {
            const response = await apiFetch("/api/order-requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerName: formName || null,
                    customerEmail: formEmail || null,
                    customerPhone: formPhone || null,
                    customerInstagram: formInstagram || null,
                    notes: formNotes || null,
                    items: get(cart),
                }),
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.message || "Failed to submit.");
            }
            submitSuccess = true;
            showRequestForm = false;
        } catch (e) {
            submitError = e.message;
        } finally {
            submitting = false;
        }
    }
</script>

<button class="overlay" aria-label="Close cart" tabindex="-1" on:click={closeCart} transition:fade={{ duration: 200 }}
></button>

<aside class="cart-sidebar" transition:fly={{ duration: 300, x: "100%" }}>
    <div class="cart-header">
        <a href="/cart" class="cart-title" on:click={closeCart}>Cart ({$cart.length})</a>
        <button on:click={closeCart} class="close-btn" aria-label="Close cart">
            <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
            >
                <path d="M18 6 6 18M6 6l12 12" />
            </svg>
        </button>
    </div>

    {#if $cart.length === 0}
        <div class="empty-cart">
            <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.2"
                class="empty-icon"
            >
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <p>Your cart is empty</p>
            <a href="/products" class="browse-btn" on:click={closeCart}>Browse products</a>
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
                            <div class="qty-stepper">
                                <button
                                    class="qty-btn"
                                    on:click={() => updateQuantity(item.sku, item.quantity - 1)}
                                    aria-label="Decrease quantity">−</button
                                >
                                <span class="qty-num">{item.quantity}</span>
                                <button
                                    class="qty-btn"
                                    on:click={() => updateQuantity(item.sku, item.quantity + 1)}
                                    aria-label="Increase quantity">+</button
                                >
                            </div>
                            <span class="item-price"
                                >${(item.quantity * parseFloat(item.salePrice || "0")).toFixed(2)}</span
                            >
                        </div>
                    </div>
                    <button
                        on:click={() => removeFromCart(item.sku)}
                        class="remove-item-btn"
                        aria-label="Remove {item.name}"
                    >
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                            stroke-linecap="round"
                        >
                            <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            {/each}
        </div>
    {/if}

    {#if $cart.length > 0}
        <div class="cart-footer">
            {#if showRequestForm}
                <form
                    class="request-form"
                    on:submit|preventDefault={submitOrderRequest}
                    transition:fly={{ y: 8, duration: 200 }}
                >
                    <p class="form-title">Your contact info</p>
                    <input class="form-input" type="text" bind:value={formName} placeholder="Name (optional)" />
                    <p class="form-hint">At least one contact method required:</p>
                    <input class="form-input" type="tel" bind:value={formPhone} placeholder="Phone" />
                    <input class="form-input" type="email" bind:value={formEmail} placeholder="Email" />
                    <input
                        class="form-input"
                        type="text"
                        bind:value={formInstagram}
                        placeholder="Instagram (@handle)"
                    />
                    <textarea
                        class="form-input form-textarea"
                        bind:value={formNotes}
                        rows="2"
                        placeholder="Notes (optional)"
                    ></textarea>
                    {#if submitError}
                        <p class="form-error">{submitError}</p>
                    {/if}
                    <div class="form-actions">
                        <button
                            type="button"
                            class="form-cancel-btn"
                            on:click={() => (showRequestForm = false)}
                            disabled={submitting}>Cancel</button
                        >
                        <button type="submit" class="checkout-btn" disabled={submitting || !$isCartValid}>
                            {submitting ? "Submitting…" : "Submit Request"}
                        </button>
                    </div>
                </form>
            {:else}
                <div class="subtotal">
                    <span>Subtotal</span>
                    <span>${$cartSubtotal.toFixed(2)}</span>
                </div>
                <p class="shipping-note">Shipping & taxes calculated at checkout.</p>
                {#if submitSuccess}
                    <div class="success-note" in:fly={{ y: 6, duration: 250 }}>
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg
                        >
                        Request submitted! We'll be in touch.
                    </div>
                {:else}
                    <button class="checkout-btn" on:click={openRequestForm} disabled={!$isCartValid}>
                        {#if !$isCartValid}Cart has issues{:else}Request Order{/if}
                    </button>
                {/if}
            {/if}
        </div>
    {/if}
</aside>

<style>
    .overlay {
        position: fixed;
        inset: 0;
        background-color: rgba(0, 0, 0, 0.45);
        z-index: 1000;
        border: none;
        cursor: default;
        padding: 0;
    }

    .cart-sidebar {
        position: fixed;
        top: 0;
        right: 0;
        width: min(420px, 95vw);
        height: 100%;
        background-color: var(--color-bg);
        z-index: 1001;
        box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
    }

    .cart-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid var(--color-border);
    }

    .cart-title {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--color-text);
        text-decoration: none;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }
    .cart-title:hover {
        color: var(--color-link-hover);
    }

    .close-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        background: none;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        color: var(--color-text);
        transition: background-color 0.15s;
    }
    .close-btn:hover {
        background-color: var(--color-link-bg-hover);
    }

    .cart-items {
        flex-grow: 1;
        overflow-y: auto;
        padding: 0 1.5rem;
    }

    .empty-cart {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 4rem 1.5rem;
        text-align: center;
    }

    .empty-icon {
        opacity: 0.25;
        color: var(--color-text);
    }

    .empty-cart p {
        color: var(--color-text-light);
        margin: 0;
    }

    .browse-btn {
        display: inline-block;
        margin-top: 0.5rem;
        padding: 0.6rem 1.25rem;
        background-color: var(--color-signup-bg);
        color: var(--color-signup);
        border-radius: 6px;
        font-size: 0.875rem;
        font-weight: 500;
        text-decoration: none;
        transition: background-color 0.2s;
    }
    .browse-btn:hover {
        background-color: var(--color-signup-bg-hover);
        color: var(--color-signup);
    }

    .cart-item {
        display: flex;
        gap: 1rem;
        padding: 1.25rem 0;
        border-bottom: 1px solid var(--color-border);
        align-items: flex-start;
    }

    .product-image {
        width: 70px;
        height: 88px;
        object-fit: cover;
        border-radius: 4px;
        flex-shrink: 0;
    }

    .item-details {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .product-name {
        font-size: 0.875rem;
        font-weight: 500;
        text-decoration: none;
        color: var(--color-text);
        line-height: 1.35;
    }
    .product-name:hover {
        color: var(--color-link-hover);
    }

    .product-variant {
        font-size: 0.8rem;
        color: var(--color-text-light);
        margin: 0.2rem 0 0.6rem;
    }

    .quantity-controls {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: auto;
    }

    .qty-stepper {
        display: inline-flex;
        align-items: center;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        overflow: hidden;
    }

    .qty-btn {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: none;
        border: none;
        font-size: 1rem;
        cursor: pointer;
        color: var(--color-text);
        transition: background-color 0.15s;
        line-height: 1;
        padding: 0;
    }
    .qty-btn:hover {
        background-color: var(--color-link-bg-hover);
    }

    .qty-num {
        min-width: 28px;
        text-align: center;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text);
        border-left: 1px solid var(--color-border);
        border-right: 1px solid var(--color-border);
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .item-price {
        font-weight: 500;
        font-size: 0.875rem;
        color: var(--color-text);
    }

    .remove-item-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        background: none;
        border: none;
        color: var(--color-text-light);
        cursor: pointer;
        border-radius: 50%;
        transition:
            color 0.15s,
            background-color 0.15s;
        flex-shrink: 0;
        padding: 0;
    }
    .remove-item-btn:hover {
        color: var(--color-danger);
        background-color: rgba(229, 62, 62, 0.1);
    }

    .cart-footer {
        padding: 1.25rem 1.5rem;
        border-top: 1px solid var(--color-border);
        background-color: var(--color-bg);
    }

    .subtotal {
        display: flex;
        justify-content: space-between;
        font-size: 1rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
        color: var(--color-text);
    }

    .shipping-note {
        font-size: 0.8rem;
        color: var(--color-text-light);
        margin-bottom: 1rem;
        text-align: center;
    }

    .checkout-btn {
        width: 100%;
        padding: 0.875rem;
        background-color: var(--color-signup-bg);
        color: var(--color-signup);
        border: none;
        border-radius: 8px;
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        letter-spacing: 0.03em;
        transition: background-color 0.2s;
    }
    .checkout-btn:hover:not(:disabled) {
        background-color: var(--color-signup-bg-hover);
    }

    .success-note {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-success);
        padding: 0.5rem 0;
    }

    /* Inline request form */
    .request-form {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .form-title {
        font-size: 0.85rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-light);
        margin: 0 0 0.25rem;
    }

    .form-hint {
        font-size: 0.75rem;
        color: var(--color-text-light);
        margin: 0.1rem 0;
    }

    .form-input {
        padding: 0.55rem 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-bg);
        color: var(--color-text);
        font-size: 0.875rem;
        font-family: inherit;
        transition: border-color 0.15s;
        resize: vertical;
    }
    .form-input:focus {
        outline: none;
        border-color: var(--color-link-hover);
        box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.15);
    }

    .form-textarea {
        min-height: 56px;
    }

    .form-error {
        color: var(--color-danger);
        font-size: 0.8rem;
        margin: 0;
    }

    .form-actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.25rem;
    }

    .form-cancel-btn {
        flex: 1;
        padding: 0.7rem;
        background: none;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        color: var(--color-text);
        font-size: 0.875rem;
        cursor: pointer;
        transition: background-color 0.15s;
    }
    .form-cancel-btn:hover:not(:disabled) {
        background: var(--color-link-bg-hover);
    }
    .form-actions .checkout-btn {
        flex: 2;
    }
    .checkout-btn:disabled,
    .form-cancel-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .cart-item.invalid {
        background-color: rgba(229, 62, 62, 0.05);
        border-radius: 4px;
        padding-left: 0.5rem;
        padding-right: 0.5rem;
        margin-left: -0.5rem;
        margin-right: -0.5rem;
    }

    .validation-error {
        color: var(--color-danger);
        font-size: 0.8rem;
        margin-bottom: 0.25rem;
    }

    .checkout-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>
