<script>
    // @ts-nocheck

    import cart, { cartSubtotal, updateQuantity, removeFromCart } from "$lib/stores/cart.store.js";
    import { apiFetch } from "$lib/utils/api.js";
    import { fly } from "svelte/transition";
    import { get } from "svelte/store";

    $: cartLength = $cart.length;

    // --- Order Request state ---
    let showRequestForm = false;
    let submitting = false;
    let submitSuccess = false;
    let submitError = "";

    let formName = "";
    let formEmail = "";
    let formPhone = "";
    let formInstagram = "";
    let formNotes = "";

    function openRequestForm() {
        showRequestForm = true;
        submitSuccess = false;
        submitError = "";
    }

    function closeRequestForm() {
        showRequestForm = false;
    }

    async function submitOrderRequest() {
        submitting = true;
        submitError = "";
        if (!formEmail && !formPhone && !formInstagram) {
            submitError = "Please provide at least one contact method: email, phone, or Instagram.";
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
                throw new Error(err.message || "Failed to submit order request.");
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
                    </div>
                    <div class="item-total">${(item.quantity * parseFloat(item.salePrice || "0")).toFixed(2)}</div>
                    <div class="item-remove">
                        <button
                            on:click={() => removeFromCart(item.sku)}
                            class="remove-btn"
                            aria-label="Remove {item.name}"
                        >
                            <svg
                                width="16"
                                height="16"
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
                </div>
            {/each}
        </div>

        <div class="cart-summary">
            <div class="subtotal">
                <span>Subtotal</span>
                <span>${$cartSubtotal.toFixed(2)}</span>
            </div>
            <p class="shipping-note">Shipping & taxes calculated at checkout.</p>
            {#if submitSuccess}
                <div class="success-banner" in:fly={{ y: 8, duration: 300 }}>
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg
                    >
                    Order request submitted! We'll be in touch soon.
                </div>
            {:else}
                <button class="checkout-btn" on:click={openRequestForm}>Request Order</button>
            {/if}
        </div>
    {/if}
</div>

{#if showRequestForm}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="modal-overlay" on:click|self={closeRequestForm} transition:fly={{ duration: 200, opacity: 0, y: 10 }}>
        <div class="modal">
            <div class="modal-header">
                <h2>Request Order</h2>
                <button class="modal-close-btn" on:click={closeRequestForm} aria-label="Close">
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg
                    >
                </button>
            </div>

            <p class="modal-desc">
                Leave your contact info so we can confirm prices and availability before finalising your order.
            </p>

            <div class="modal-items-summary">
                {#each $cart as item (item.sku)}
                    <div class="summary-row">
                        <span class="summary-name"
                            >{item.name}
                            <span class="summary-variant"
                                >({item.color}{#if item.size}, {item.size}{/if})</span
                            ></span
                        >
                        <span class="summary-qty">× {item.quantity}</span>
                        <span class="summary-price"
                            >${(item.quantity * parseFloat(item.salePrice || "0")).toFixed(2)}</span
                        >
                    </div>
                {/each}
                <div class="summary-total-row">
                    <span>Total</span>
                    <span>${$cartSubtotal.toFixed(2)}</span>
                </div>
            </div>

            <form on:submit|preventDefault={submitOrderRequest} class="modal-form">
                <div class="field">
                    <label for="req-name">Name <span class="optional">(optional)</span></label>
                    <input id="req-name" type="text" bind:value={formName} placeholder="Your name" />
                </div>
                <p class="contact-hint">Provide at least one way to reach you:</p>
                <div class="field">
                    <label for="req-phone">Phone</label>
                    <input id="req-phone" type="tel" bind:value={formPhone} placeholder="e.g. +1 555 000 0000" />
                </div>
                <div class="field">
                    <label for="req-email">Email</label>
                    <input id="req-email" type="email" bind:value={formEmail} placeholder="Email address" />
                </div>
                <div class="field">
                    <label for="req-instagram">Instagram</label>
                    <input id="req-instagram" type="text" bind:value={formInstagram} placeholder="@yourhandle" />
                </div>
                <div class="field">
                    <label for="req-notes">Notes <span class="optional">(optional)</span></label>
                    <textarea
                        id="req-notes"
                        bind:value={formNotes}
                        rows="3"
                        placeholder="Any special requests, questions, or delivery preferences…"
                    ></textarea>
                </div>

                {#if submitError}
                    <p class="submit-error">{submitError}</p>
                {/if}

                <div class="modal-actions">
                    <button type="button" class="cancel-btn" on:click={closeRequestForm} disabled={submitting}
                        >Cancel</button
                    >
                    <button type="submit" class="submit-btn" disabled={submitting}>
                        {submitting ? "Submitting…" : "Submit Request"}
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

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
        border: 2px dashed var(--color-border);
        border-radius: 8px;
        color: var(--color-text-light);
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
            border-bottom: 1px solid var(--color-border);
            font-weight: bold;
            text-transform: uppercase;
            font-size: 0.875rem;
            color: var(--color-text-light);
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
        border-bottom: 1px solid var(--color-border);
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
        color: var(--color-text-light);
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

    .qty-stepper {
        display: inline-flex;
        align-items: center;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        overflow: hidden;
    }

    .qty-btn {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: none;
        border: none;
        font-size: 1rem;
        cursor: pointer;
        color: var(--color-text);
        transition: background-color 0.15s;
        padding: 0;
    }
    .qty-btn:hover {
        background-color: var(--color-link-bg-hover);
    }

    .qty-num {
        min-width: 36px;
        text-align: center;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text);
        border-left: 1px solid var(--color-border);
        border-right: 1px solid var(--color-border);
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .remove-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: none;
        border: none;
        color: var(--color-text-light);
        cursor: pointer;
        border-radius: 50%;
        transition:
            color 0.15s,
            background-color 0.15s;
        padding: 0;
    }
    .remove-btn:hover {
        color: var(--color-danger);
        background-color: rgba(229, 62, 62, 0.1);
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
        color: var(--color-text-light);
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
        transition: background-color 0.2s;
    }
    .checkout-btn:hover {
        background-color: var(--color-signup-bg-hover);
    }

    .success-banner {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.875rem 1.25rem;
        background-color: rgba(21, 87, 36, 0.1);
        color: var(--color-success);
        border: 1px solid var(--color-success);
        border-radius: 8px;
        font-size: 0.925rem;
        font-weight: 500;
        width: 100%;
        max-width: 350px;
    }

    /* ── Modal ── */
    .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
    }

    .modal {
        background: var(--color-bg);
        border: 1px solid var(--color-border);
        border-radius: 12px;
        width: 100%;
        max-width: 520px;
        max-height: 90vh;
        overflow-y: auto;
        padding: 1.75rem;
        box-shadow: 0 8px 40px rgba(0, 0, 0, 0.25);
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }

    .modal-header h2 {
        font-size: 1.25rem;
        font-weight: 700;
        margin: 0;
        color: var(--color-text);
    }

    .modal-close-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: none;
        background: none;
        color: var(--color-text-light);
        cursor: pointer;
        transition:
            background-color 0.15s,
            color 0.15s;
    }
    .modal-close-btn:hover {
        background-color: var(--color-link-bg-hover);
        color: var(--color-text);
    }

    .modal-desc {
        font-size: 0.875rem;
        color: var(--color-text-light);
        margin-bottom: 1.25rem;
    }

    .modal-items-summary {
        background: var(--color-link-bg-hover);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 0.875rem 1rem;
        margin-bottom: 1.5rem;
        font-size: 0.875rem;
    }

    .summary-row {
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
        padding: 0.25rem 0;
    }

    .summary-name {
        flex: 1;
        color: var(--color-text);
        font-weight: 500;
    }

    .summary-variant {
        font-weight: 400;
        color: var(--color-text-light);
    }

    .summary-qty {
        color: var(--color-text-light);
        white-space: nowrap;
    }

    .summary-price {
        font-weight: 600;
        color: var(--color-text);
        white-space: nowrap;
        min-width: 60px;
        text-align: right;
    }

    .summary-total-row {
        display: flex;
        justify-content: space-between;
        font-weight: 700;
        font-size: 0.925rem;
        color: var(--color-text);
        margin-top: 0.5rem;
        padding-top: 0.5rem;
        border-top: 1px solid var(--color-border);
    }

    .modal-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }

    .field label {
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-light);
    }

    .optional {
        font-weight: 400;
        text-transform: none;
        letter-spacing: 0;
    }

    .contact-hint {
        font-size: 0.8rem;
        color: var(--color-text-light);
        margin: 0.25rem 0 0;
    }

    .field input,
    .field textarea {
        padding: 0.6rem 0.875rem;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-bg);
        color: var(--color-text);
        font-size: 0.925rem;
        font-family: inherit;
        transition: border-color 0.15s;
        resize: vertical;
    }
    .field input:focus,
    .field textarea:focus {
        outline: none;
        border-color: var(--color-link-hover);
        box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2);
    }

    .submit-error {
        color: var(--color-danger);
        font-size: 0.875rem;
        margin: 0;
    }

    .modal-actions {
        display: flex;
        gap: 0.75rem;
        justify-content: flex-end;
        margin-top: 0.5rem;
    }

    .cancel-btn {
        padding: 0.7rem 1.25rem;
        background: none;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        color: var(--color-text);
        font-size: 0.925rem;
        cursor: pointer;
        transition: background-color 0.15s;
    }
    .cancel-btn:hover:not(:disabled) {
        background: var(--color-link-bg-hover);
    }

    .submit-btn {
        padding: 0.7rem 1.5rem;
        background-color: var(--color-signup-bg);
        color: var(--color-signup);
        border: none;
        border-radius: 8px;
        font-size: 0.925rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .submit-btn:hover:not(:disabled) {
        background-color: var(--color-signup-bg-hover);
    }
    .submit-btn:disabled,
    .cancel-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>
