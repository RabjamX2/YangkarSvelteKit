<script>
    // @ts-nocheck

    import { onMount } from "svelte";
    import { writable, derived } from "svelte/store";
    import AdminHeader from "$lib/components/AdminHeader.svelte";
    import { apiFetch } from "$lib/utils/api.js";
    import { auth } from "$lib/stores/auth.store.js";

    export let data;

    const products = writable([]);
    const variants = writable([]);
    const inventoryBatches = writable([]);
    const cart = writable([]); // [{variant, quantity}]
    const customerPhone = writable("");
    const customerName = writable("");
    const search = writable("");
    const loading = writable(false);
    const error = writable(null);
    const success = writable(null);
    const paymentMethod = writable("CASH");
    const salesChannel = writable("IN_PERSON");
    const orderNotes = writable("");

    // Set CSRF token from server data
    $: if (data?.csrfToken) {
        if ($auth.csrfToken !== data.csrfToken) {
            auth.setCsrfToken(data.csrfToken);
        }
    }

    onMount(async () => {
        loading.set(true);
        try {
            // Fetch products and variants
            const res = await apiFetch(`/api/products-with-variants?all=true`);
            if (!res.ok) throw new Error("Failed to fetch products");
            const resData = await res.json();
            products.set(resData.data);
            let allVariants = [];
            resData.data.forEach((p) => {
                p.variants.forEach((v) => {
                    allVariants.push({ ...v, product: { skuBase: p.skuBase, displayName: p.displayName } });
                });
            });
            variants.set(allVariants);

            // Fetch inventory batches for stock calculation
            const batchRes = await apiFetch(`/api/inventory-batches`);
            if (!batchRes.ok) throw new Error("Failed to fetch inventory batches");
            const batchData = await batchRes.json();
            inventoryBatches.set(batchData.data || []);
        } catch (e) {
            error.set(e.message);
        } finally {
            loading.set(false);
        }
    });

    function addToCart(variant) {
        // Ensure variant has .product property (for cart rendering)
        cart.update((list) => {
            const idx = list.findIndex((item) => item.variant.id === variant.id);
            if (idx !== -1) {
                list[idx].quantity++;
                return [...list];
            }
            // If variant.product is missing, find it from products
            let v = { ...variant };
            if (!v.product) {
                let $products;
                products.subscribe((p) => ($products = p))();
                const parent = $products.find((p) => p.variants.some((vv) => vv.id === v.id));
                if (parent) v.product = { skuBase: parent.skuBase, displayName: parent.displayName };
            }
            // Add default discount and isPreOrder fields
            return [...list, { variant: v, quantity: 1, discount: 0, isPreOrder: false }];
        });
    }
    function updateDiscount(variantId, discount) {
        cart.update((list) =>
            list.map((item) =>
                item.variant.id === variantId ? { ...item, discount: Math.max(0, Number(discount) || 0) } : item
            )
        );
    }

    function updateIsPreOrder(variantId, isPreOrder) {
        cart.update((list) => list.map((item) => (item.variant.id === variantId ? { ...item, isPreOrder } : item)));
    }

    function updateQuantity(variantId, qty) {
        cart.update((list) =>
            list.map((item) => (item.variant.id === variantId ? { ...item, quantity: Math.max(1, qty) } : item))
        );
    }

    function removeFromCart(variantId) {
        cart.update((list) => list.filter((item) => item.variant.id !== variantId));
    }

    const total = derived(cart, ($cart) =>
        $cart.reduce((sum, item) => sum + Number(item.variant.salePrice || 0) * item.quantity, 0)
    );

    // Advanced options state
    const showAdvanced = writable(false);
    const customOrderDate = writable("");
    const paymentStatus = writable("PAID");
    const fulfillmentStatus = writable("PICKED_UP");
    const returnStatus = writable("NONE");
    const shippingRequired = writable(false);
    const shippingAddress = writable({
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "",
    });

    async function completeSale() {
        let $cart,
            $customerPhone,
            $customerName,
            $total,
            $moneyHolder,
            $salesChannel,
            $orderNotes,
            $customOrderDate,
            $paymentStatus,
            $fulfillmentStatus,
            $returnStatus,
            $shippingRequired,
            $shippingAddress;
        cart.subscribe((v) => ($cart = v))();
        customerPhone.subscribe((v) => ($customerPhone = v))();
        customerName.subscribe((v) => ($customerName = v))();
        total.subscribe((v) => ($total = v))();
        let $paymentMethod;
        moneyHolder.subscribe((v) => ($moneyHolder = v))();
        paymentMethod.subscribe((v) => ($paymentMethod = v))();
        salesChannel.subscribe((v) => ($salesChannel = v))();
        orderNotes.subscribe((v) => ($orderNotes = v))();
        customOrderDate.subscribe((v) => ($customOrderDate = v))();
        paymentStatus.subscribe((v) => ($paymentStatus = v))();
        fulfillmentStatus.subscribe((v) => ($fulfillmentStatus = v))();
        returnStatus.subscribe((v) => ($returnStatus = v))();
        shippingRequired.subscribe((v) => ($shippingRequired = v))();
        shippingAddress.subscribe((v) => ($shippingAddress = v))();
        if (!$cart.length) {
            error.set("Cart is empty");
            return;
        }
        if ($shippingRequired) {
            // Validate all address fields
            const requiredFields = ["street", "city", "state", "zipCode", "country"];
            for (const field of requiredFields) {
                if (!$shippingAddress[field] || !$shippingAddress[field].trim()) {
                    error.set("All shipping address fields are required.");
                    return;
                }
            }
        }
        loading.set(true);
        error.set(null);
        success.set(null);
        try {
            const body = {
                customer: { phone: $customerPhone, name: $customerName },
                items: $cart.map((item) => ({
                    productVariantId: item.variant.id,
                    quantity: item.quantity,
                    salePrice: item.variant.salePrice,
                    discount: item.discount,
                    isPreOrder: item.isPreOrder,
                })),
                total: $total,
                moneyHolder: $moneyHolder,
                paymentMethod: $paymentMethod,
                salesChannel: $salesChannel,
                notes: $orderNotes,
            };
            if ($customOrderDate) {
                body.orderDate = new Date($customOrderDate).toISOString();
            }
            if ($paymentStatus) {
                body.paymentStatus = $paymentStatus;
            }
            if ($fulfillmentStatus) {
                body.fulfillmentStatus = $fulfillmentStatus;
            }
            if ($returnStatus) {
                body.returnStatus = $returnStatus;
            }
            if ($shippingRequired) {
                body.shippingAddress = $shippingAddress;
            }
            const res = await apiFetch(`/api/customer-orders`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error("Failed to complete sale");
            cart.set([]);
            customerPhone.set("");
            customerName.set("");
            moneyHolder.set("");
            orderNotes.set("");
            customOrderDate.set("");
            paymentStatus.set("");
            fulfillmentStatus.set("");
            returnStatus.set("");
            shippingRequired.set(false);
            shippingAddress.set({ street: "", city: "", state: "", zipCode: "", country: "" });
            success.set("Sale completed!");
        } catch (e) {
            error.set(e.message);
        } finally {
            loading.set(false);
        }
    }
    const moneyHolder = writable("");

    // Calculate stock per variant from inventory batches
    const variantStockMap = derived(inventoryBatches, ($inventoryBatches) => {
        const map = {};
        for (const batch of $inventoryBatches) {
            if (!batch.productVariantId) continue;
            map[batch.productVariantId] = (map[batch.productVariantId] || 0) + batch.quantity;
        }
        return map;
    });

    const groupedProducts = derived([products, search, variantStockMap], ([$products, $search, $variantStockMap]) => {
        // Sort products alphabetically
        let filtered = $products
            .map((p) => ({
                ...p,
                variants: p.variants
                    .map((v) => ({
                        ...v,
                        stock: $variantStockMap[v.id] || 0,
                    }))
                    .filter((v) => {
                        if (!$search) return true;
                        const s = $search.toLowerCase();
                        return (
                            (v.sku && v.sku.toLowerCase().includes(s)) ||
                            (v.color && v.color.toLowerCase().includes(s)) ||
                            (v.size && v.size.toLowerCase().includes(s)) ||
                            (p.displayName && p.displayName.toLowerCase().includes(s))
                        );
                    })
                    .sort((a, b) => {
                        const colorA = a.color || "";
                        const colorB = b.color || "";
                        if (colorA !== colorB) return colorA.localeCompare(colorB);
                        const sizeA = a.size || "";
                        const sizeB = b.size || "";
                        if (sizeA && sizeB) return sizeA.localeCompare(sizeB);
                        return 0;
                    }),
            }))
            .filter((p) => p.variants.length > 0)
            .sort((a, b) => a.displayName.localeCompare(b.displayName));
        return filtered;
    });
    let cashReceived = "";
</script>

<svelte:head>
    <title>Admin Checkout</title>
</svelte:head>

<AdminHeader />

<div class="checkout-container">
    <h1>Admin Checkout (POS)</h1>
    {#if $error}
        <p style="color:red">{$error}</p>
    {/if}
    {#if $success}
        <p style="color:green">{$success}</p>
    {/if}
    <div class="checkout-flex">
        <div class="product-search">
            <input type="text" placeholder="Search SKU, name, color, size..." bind:value={$search} autofocus />
            <div class="variant-list">
                {#each $groupedProducts as product}
                    <div class="product-group">
                        <div class="product-header">
                            {product.displayName} <span class="sku-base">[{product.skuBase}]</span>
                        </div>
                        <table class="variant-table-pos">
                            <thead>
                                <tr>
                                    <th>SKU</th>
                                    <th>Color</th>
                                    <th>Size</th>
                                    <th>Price</th>
                                    <th>Stock</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each product.variants as variant}
                                    <tr>
                                        <td>{variant.sku}</td>
                                        <td>{variant.color}</td>
                                        <td>{variant.size}</td>
                                        <td>${variant.salePrice}</td>
                                        <td>{variant.stock}</td>
                                        <td>
                                            <button
                                                type="button"
                                                on:click={() => addToCart(variant)}
                                                disabled={variant.stock === 0}
                                            >
                                                Add
                                            </button>
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                {/each}
            </div>
        </div>
        <div class="cart-section">
            <h2>Cart</h2>
            {#if !$cart.length}
                <p>No items in cart.</p>
            {:else}
                <div class="cart-summary">
                    <span>Total Items: {$cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
                    <span style="margin-left:1.5rem;">Total: ${$total}</span>
                </div>
                <div class="change-calc" style="margin-bottom:1rem;display:flex;align-items:center;gap:1.2rem;">
                    <label for="cash-received">Cash Received:</label>
                    <input
                        id="cash-received"
                        type="number"
                        min="0"
                        step="0.01"
                        bind:value={cashReceived}
                        style="width:100px;"
                    />
                    <span
                        >Change: ${cashReceived && $total
                            ? (Number(cashReceived) - Number($total)).toFixed(2)
                            : "0.00"}</span
                    >
                </div>
                <table class="cart-table">
                    <thead>
                        <tr>
                            <th>SKU</th>
                            <th>Name</th>
                            <th>Color</th>
                            <th>Size</th>
                            <th>Price</th>
                            <th>Qty</th>
                            <th>Discount</th>
                            <th>Pre-Order</th>
                            <th>Subtotal</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each $cart as item}
                            <tr>
                                <td>{item.variant.sku}</td>
                                <td>{item.variant.product.displayName}</td>
                                <td>{item.variant.color}</td>
                                <td>{item.variant.size}</td>
                                <td>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={item.variant.salePrice}
                                        on:input={(e) => {
                                            const newPrice = e.target.value;
                                            cart.update((list) =>
                                                list.map((cartItem) =>
                                                    cartItem.variant.id === item.variant.id
                                                        ? {
                                                              ...cartItem,
                                                              variant: { ...cartItem.variant, salePrice: newPrice },
                                                          }
                                                        : cartItem
                                                )
                                            );
                                        }}
                                        style="width:70px;"
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        on:input={(e) => updateQuantity(item.variant.id, +e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={item.discount}
                                        on:input={(e) => updateDiscount(item.variant.id, e.target.value)}
                                        style="width:60px;"
                                    />
                                </td>
                                <td>
                                    <input
                                        type="checkbox"
                                        checked={item.isPreOrder}
                                        on:change={(e) => updateIsPreOrder(item.variant.id, e.target.checked)}
                                    />
                                </td>
                                <td
                                    >{(
                                        (Number(item.variant.salePrice || 0) - (item.discount || 0)) *
                                        item.quantity
                                    ).toFixed(2)}</td
                                >
                                <td><button on:click={() => removeFromCart(item.variant.id)}>Remove</button></td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            {/if}
            <div class="customer-section">
                <h3>Customer</h3>
                <input type="tel" placeholder="Phone number (optional)" bind:value={$customerPhone} />
                <input type="text" placeholder="Name (optional)" bind:value={$customerName} />
                <div style="margin-top:0.7rem;">
                    <label for="money-holder">Who has the money?</label>
                    <select id="money-holder" bind:value={$moneyHolder}>
                        <option value="">Select...</option>
                        <option value="Pema">Pema</option>
                        <option value="Dechen">Dechen</option>
                        <option value="Rabjam">Rabjam</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div style="margin-top:0.7rem;">
                    <label for="payment-method">Payment Method</label>
                    <select id="payment-method" bind:value={$paymentMethod}>
                        <option value="CASH">Cash</option>
                        <option value="CREDIT_CARD">Credit Card</option>
                        <option value="DEBIT_CARD">Debit Card</option>
                        <option value="ZELLE">Zelle</option>
                        <option value="VENMO">Venmo</option>
                        <option value="OTHER">Other</option>
                    </select>
                </div>
                <div style="margin-top:0.7rem;">
                    <label for="sales-channel">Sales Channel</label>
                    <select id="sales-channel" bind:value={$salesChannel}>
                        <option value="IN_PERSON">In Person</option>
                        <option value="ONLINE">Online</option>
                        <option value="SOCIAL">Social</option>
                    </select>
                </div>
                <div style="margin-top:0.7rem;">
                    <label for="order-notes">Order Notes</label>
                    <textarea
                        id="order-notes"
                        bind:value={$orderNotes}
                        rows="2"
                        style="width:100%;border-radius:4px;border:1px solid var(--color-border);padding:0.4rem;"
                    ></textarea>
                </div>
            </div>
            <div class="advanced-toggle" style="margin:1.2rem 0 0.7rem 0;">
                <button
                    type="button"
                    on:click={() => showAdvanced.update((v) => !v)}
                    style="background:none;border:none;color:var(--color-signup-bg,#6366f1);font-weight:600;cursor:pointer;"
                >
                    {#if $showAdvanced}▲ Hide Advanced Options{:else}▼ Show Advanced Options{/if}
                </button>
            </div>
            {#if $showAdvanced}
                <div
                    class="advanced-box"
                    style="border:1px solid var(--color-border);border-radius:8px;padding:1rem 1.2rem;margin-bottom:1.2rem;background:var(--color-user-badge-bg,#f8fafc);"
                >
                    <div style="margin-bottom:0.8rem;">
                        <label for="custom-order-date" style="font-weight:500;">Custom Order Date/Time</label>
                        <input
                            id="custom-order-date"
                            type="datetime-local"
                            bind:value={$customOrderDate}
                            style="margin-left:0.7rem;"
                        />
                        <span style="font-size:0.95em;color:#888;margin-left:0.5rem;"
                            >(Leave blank to use current time)</span
                        >
                    </div>
                    <div style="margin-bottom:0.8rem;">
                        <label for="payment-status" style="font-weight:500;">Payment Status</label>
                        <select id="payment-status" bind:value={$paymentStatus} style="margin-left:0.7rem;">
                            <option value="PAID">Paid (Default)</option>
                            <option value="PENDING">Pending</option>
                            <option value="REFUNDED">Refunded</option>
                            <option value="FAILED">Failed</option>
                        </select>
                    </div>
                    <div style="margin-bottom:0.8rem;">
                        <label for="fulfillment-status" style="font-weight:500;">Fulfillment Status</label>
                        <select id="fulfillment-status" bind:value={$fulfillmentStatus} style="margin-left:0.7rem;">
                            <option value="PICKED_UP">Picked Up (Default)</option>
                            <option value="UNFULFILLED">Unfulfilled</option>
                            <option value="PROCESSING">Processing</option>
                            <option value="SHIPPED">Shipped</option>
                            <option value="DELIVERED">Delivered</option>
                            <option value="CANCELLED">Cancelled</option>
                        </select>
                    </div>
                    <div style="margin-bottom:0.8rem;">
                        <label for="return-status" style="font-weight:500;">Return Status</label>
                        <select id="return-status" bind:value={$returnStatus} style="margin-left:0.7rem;">
                            <option value="NONE">None (Default)</option>
                            <option value="REQUESTED">Requested</option>
                            <option value="APPROVED">Approved</option>
                            <option value="RECEIVED">Received</option>
                            <option value="COMPLETED">Completed</option>
                        </select>
                    </div>
                    <div style="margin-bottom:0.8rem;">
                        <label style="font-weight:500;">
                            <input type="checkbox" bind:checked={$shippingRequired} style="margin-right:0.5em;" />
                            Shipping?
                        </label>
                    </div>
                    {#if $shippingRequired}
                        <div style="margin-bottom:0.8rem;">
                            <label style="font-weight:500;">Shipping Address</label>
                            <div style="display:flex;flex-wrap:wrap;gap:0.7rem;margin-top:0.5rem;">
                                <input
                                    type="text"
                                    placeholder="Street"
                                    bind:value={$shippingAddress.street}
                                    style="flex:2 1 200px;"
                                    required
                                />
                                <input
                                    type="text"
                                    placeholder="City"
                                    bind:value={$shippingAddress.city}
                                    style="flex:1 1 120px;"
                                    required
                                />
                                <input
                                    type="text"
                                    placeholder="State"
                                    bind:value={$shippingAddress.state}
                                    style="flex:1 1 80px;"
                                    required
                                />
                                <input
                                    type="text"
                                    placeholder="Zip Code"
                                    bind:value={$shippingAddress.zipCode}
                                    style="flex:1 1 80px;"
                                    required
                                />
                                <input
                                    type="text"
                                    placeholder="Country"
                                    bind:value={$shippingAddress.country}
                                    style="flex:1 1 120px;"
                                    required
                                />
                            </div>
                        </div>
                    {/if}
                </div>
            {/if}
            <button class="complete-btn" on:click={completeSale} disabled={$loading || !$cart.length}>
                {#if $loading}
                    <span class="spinner"></span> Processing...
                {:else}
                    Complete Sale
                {/if}
            </button>
            <style>
                .spinner {
                    display: inline-block;
                    width: 18px;
                    height: 18px;
                    border: 3px solid #ccc;
                    border-top: 3px solid var(--color-signup-bg, #6366f1);
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    vertical-align: middle;
                    margin-right: 8px;
                }
                @keyframes spin {
                    0% {
                        transform: rotate(0deg);
                    }
                    100% {
                        transform: rotate(360deg);
                    }
                }
                .cart-summary {
                    font-size: 1.08rem;
                    font-weight: 500;
                    margin-bottom: 0.7rem;
                }
            </style>
        </div>
    </div>
</div>

<style>
    .checkout-container {
        max-width: 1200px;
        margin: 2rem auto;
        background: var(--color-bg, #fff);
        border-radius: 16px;
        box-shadow: var(--color-shadow, 0 4px 24px 0 rgba(0, 0, 0, 0.07));
        padding: 2rem;
    }
    .checkout-flex {
        display: flex;
        gap: 2rem;
    }
    .product-search {
        flex: 1;
    }
    .variant-list {
        margin-top: 1rem;
        max-height: 400px;
        overflow-y: auto;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background: var(--color-user-badge-bg, #f9fafb);
    }
    .product-group {
        margin-bottom: 1.2rem;
    }
    .product-header {
        font-weight: 600;
        font-size: 1.08rem;
        background: var(--color-link-bg-hover, #f1f5f9);
        padding: 0.4rem 1rem;
        border-radius: 6px 6px 0 0;
        border-bottom: 1px solid var(--color-border);
        display: flex;
        align-items: center;
        gap: 0.7rem;
    }
    .sku-base {
        font-size: 0.95em;
        color: #888;
    }
    .variant-table-pos {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 0.7rem;
        background: none;
    }
    .variant-table-pos th,
    .variant-table-pos td {
        padding: 0.35rem 0.5rem;
        border-bottom: 1px solid var(--color-border);
        text-align: left;
        font-size: 0.98em;
    }
    .variant-table-pos th {
        background: var(--color-link-bg-hover, #f1f5f9);
        font-weight: 500;
    }
    .variant-table-pos tr:last-child td {
        border-bottom: none;
    }
    .variant-table-pos button {
        background: var(--color-signup-bg, #6366f1);
        color: var(--color-signup, #fff);
        border: none;
        border-radius: 6px;
        padding: 0.3rem 1rem;
        font-size: 1rem;
        cursor: pointer;
    }
    .cart-section {
        flex: 1.2;
        background: var(--color-user-badge-bg, #f8fafc);
        border-radius: 12px;
        padding: 1rem 1.5rem;
        box-shadow: 0 1px 4px 0 var(--color-shadow, rgba(0, 0, 0, 0.03));
    }
    .cart-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 1rem;
    }
    .cart-table th,
    .cart-table td {
        padding: 0.4rem 0.5rem;
        border-bottom: 1px solid var(--color-border);
        text-align: left;
    }
    .cart-table input[type="number"] {
        width: 60px;
        padding: 0.2rem 0.3rem;
        border: 1px solid var(--color-border);
        border-radius: 4px;
    }
    .cart-total {
        font-size: 1.2rem;
        font-weight: 600;
        margin-bottom: 1rem;
    }
    .customer-section {
        margin-bottom: 1rem;
    }
    .complete-btn {
        background: var(--color-signup-bg, #6366f1);
        color: var(--color-signup, #fff);
        border: none;
        border-radius: 6px;
        padding: 0.7rem 2.2rem;
        font-size: 1.1rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
    }
    .complete-btn:disabled {
        background: #d1d5db;
        color: #888;
        cursor: not-allowed;
    }
</style>
