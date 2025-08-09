<script>
    // @ts-nocheck

    const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import { page } from "$app/stores";
    import "./transactionTable.css";

    const customerOrders = writable([]);
    const purchaseOrders = writable([]);
    const stockChanges = writable([]); // For stock change history
    const loadingTransactions = writable(false);
    const errorTransactions = writable(/** @type {string|null} */ (null));
    const activeTab = writable("customer");
    const expandedOrder = writable(null);

    // Get logged-in user from page data
    let loggedInUser = "";
    $: loggedInUser = $page.data?.user?.name || $page.data?.user?.username || $page.data?.user?.email || "";

    // Add for manual stock change
    const productVariants = writable([]);
    // Set user to logged in user by default
    const manualStockChange = writable({ variantId: "", change: "", reason: "", user: loggedInUser });
    const manualStockChangeError = writable("");

    async function fetchStockChanges() {
        try {
            const res = await fetch(`${PUBLIC_BACKEND_URL}/api/stock-changes`);
            if (!res.ok) throw new Error("Failed to fetch stock changes");
            const data = await res.json();
            stockChanges.set(data.data || []);
        } catch (e) {
            errorTransactions.set(e instanceof Error ? e.message : String(e));
        }
    }

    async function voidOrder(orderId) {
        if (!confirm("Are you sure you want to void this transaction? This cannot be undone.")) return;
        try {
            const res = await fetch(`${PUBLIC_BACKEND_URL}/api/customer-orders/${orderId}/void`, { method: "POST" });
            if (!res.ok) throw new Error("Failed to void order");
            // Refresh orders
            const custRes = await fetch(`${PUBLIC_BACKEND_URL}/api/customer-orders`);
            if (custRes.ok) {
                const custData = await custRes.json();
                customerOrders.set(custData.data || []);
            }
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        }
    }

    onMount(async () => {
        loadingTransactions.set(true);
        try {
            const [custRes, purchRes] = await Promise.all([
                fetch(`${PUBLIC_BACKEND_URL}/api/customer-orders`),
                fetch(`${PUBLIC_BACKEND_URL}/api/purchase-orders`),
            ]);
            if (!custRes.ok) throw new Error("Failed to fetch customer orders");
            if (!purchRes.ok) throw new Error("Failed to fetch purchase orders");
            const custData = await custRes.json();
            const purchData = await purchRes.json();
            customerOrders.set(custData.data || []);
            purchaseOrders.set(purchData.data || []);
        } catch (e) {
            errorTransactions.set(e instanceof Error ? e.message : String(e));
        } finally {
            loadingTransactions.set(false);
        }
    });

    async function fetchProductVariants() {
        try {
            const res = await fetch(`${PUBLIC_BACKEND_URL}/api/products-with-variants?all=true`);
            if (!res.ok) throw new Error("Failed to fetch variants");
            const data = await res.json();
            // Flatten all variants into a single array with product info
            const variants = [];
            for (const product of data.data) {
                for (const v of product.variants) {
                    variants.push({
                        id: v.id,
                        sku: v.sku,
                        color: v.color,
                        size: v.size,
                        stock: v.stock,
                        productName: product.name,
                    });
                }
            }
            productVariants.set(variants);
        } catch (e) {
            manualStockChangeError.set(e instanceof Error ? e.message : String(e));
        }
    }

    async function submitManualStockChange() {
        let $manualStockChange;
        manualStockChange.subscribe((v) => ($manualStockChange = v))();
        // Always use logged in user if available
        const userToSend = loggedInUser || $manualStockChange.user || "Manual";
        if (!$manualStockChange.variantId || !$manualStockChange.change || !$manualStockChange.reason) {
            manualStockChangeError.set("All fields are required.");
            return;
        }
        try {
            const res = await fetch(`${PUBLIC_BACKEND_URL}/api/stock-changes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productVariantId: $manualStockChange.variantId,
                    change: $manualStockChange.change,
                    reason: $manualStockChange.reason,
                    user: userToSend,
                }),
            });
            if (!res.ok) throw new Error("Failed to record stock change");
            manualStockChange.set({ variantId: "", change: "", reason: "", user: loggedInUser });
            manualStockChangeError.set("");
            fetchStockChanges();
        } catch (e) {
            manualStockChangeError.set(e instanceof Error ? e.message : String(e));
        }
    }

    $: if ($activeTab === "stock") {
        fetchStockChanges();
        fetchProductVariants();
    }
</script>

<div class="admin-container">
    <div class="admin-tabs">
        <button class:active-tab={$activeTab === "customer"} on:click={() => activeTab.set("customer")}
            >Customer Orders</button
        >
        <button class:active-tab={$activeTab === "purchase"} on:click={() => activeTab.set("purchase")}
            >Purchase Orders</button
        >
        <button class:active-tab={$activeTab === "stock"} on:click={() => activeTab.set("stock")}
            >Stock Change History</button
        >
    </div>
    {#if $loadingTransactions}
        <p>Loading transactions...</p>
    {:else if $errorTransactions}
        <p style="color:red">Error: {$errorTransactions}</p>
    {:else if $activeTab === "customer"}
        <h2>Customer Orders</h2>
        <table class="admin-table">
            <thead>
                <tr>
                    <th></th>
                    <th>ID</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Money Holder</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {#each $customerOrders as order}
                    <tr class:order-cancelled={order.status === "CANCELLED"}>
                        <td>
                            <button on:click={() => expandedOrder.set($expandedOrder === order.id ? null : order.id)}>
                                {#if $expandedOrder === order.id}−{:else}+{/if}
                            </button>
                        </td>
                        <td>{order.id}</td>
                        <td>{order.customer?.name} ({order.customer?.phone})</td>
                        <td>{new Date(order.orderDate).toLocaleString()}</td>
                        <td>{order.total}</td>
                        <td>{order.paymentMethod}</td>
                        <td>{order.moneyHolder}</td>
                        <td>
                            {order.status === "CANCELLED"
                                ? "Voided"
                                : order.status?.charAt(0) + order.status?.slice(1).toLowerCase()}
                        </td>
                        <td>
                            <button
                                on:click={() => voidOrder(order.id)}
                                style="color:red;"
                                disabled={order.status === "CANCELLED"}
                            >
                                Void
                            </button>
                        </td>
                    </tr>
                    {#if $expandedOrder === order.id}
                        <tr class:order-cancelled={order.status === "CANCELLED"}>
                            <td></td>
                            <td colspan="8">
                                <strong>Items:</strong>
                                <table class="variant-table" style="margin-top:0.5rem;">
                                    <thead>
                                        <tr>
                                            <th>Product</th>
                                            <th>Variant</th>
                                            <th>Quantity</th>
                                            <th>Price</th>
                                            <th>Stock After Sale</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {#each order.items as item}
                                            <tr>
                                                <td
                                                    >{item.variant?.product?.name ||
                                                        item.variant?.productName ||
                                                        "-"}</td
                                                >
                                                <td>{item.variant?.sku || "-"}</td>
                                                <td>{item.quantity}</td>
                                                <td>{item.priceAtTimeOfSale}</td>
                                                <td>{item.variant?.stock ?? "-"}</td>
                                            </tr>
                                        {/each}
                                    </tbody>
                                </table>
                                {#if order.status === "CANCELLED"}
                                    <div style="color:red;margin-top:0.5rem;">
                                        <strong>This order has been voided.</strong>
                                    </div>
                                {/if}
                            </td>
                        </tr>
                    {/if}
                {/each}
            </tbody>
        </table>
    {:else if $activeTab === "purchase"}
        <h2>Purchase Orders</h2>
        <table class="admin-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Supplier</th>
                    <th>Date</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                {#each $purchaseOrders as order}
                    <tr>
                        <td>{order.id}</td>
                        <td>{order.supplier?.name}</td>
                        <td>{new Date(order.orderDate).toLocaleString()}</td>
                        <td>{order.total}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {:else}
        <h2>Stock Change History</h2>
        <form
            on:submit|preventDefault={submitManualStockChange}
            style="margin-bottom:1.5rem;display:flex;gap:1rem;flex-wrap:wrap;align-items:end;"
        >
            <div>
                <label for="variant">Variant:</label><br />
                <select id="variant" bind:value={$manualStockChange.variantId} required style="min-width:200px;">
                    <option value="">Select variant...</option>
                    {#each $productVariants as v}
                        <option value={v.id}
                            >{v.productName} | {v.sku} | {v.color}{v.size ? ` (${v.size})` : ""} | Stock: {v.stock}</option
                        >
                    {/each}
                </select>
            </div>
            <div>
                <label for="change">Change:</label><br />
                <input id="change" type="number" bind:value={$manualStockChange.change} required style="width:100px;" />
            </div>
            <div>
                <label for="reason">Reason:</label><br />
                <input id="reason" type="text" bind:value={$manualStockChange.reason} required style="width:180px;" />
            </div>
            <!-- User field is now hidden, filled automatically -->
            <button type="submit" style="height:2.2rem;">Record Stock Change</button>
            {#if $manualStockChangeError}
                <span style="color:red;">{$manualStockChangeError}</span>
            {/if}
        </form>
        <table class="admin-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th>Variant</th>
                    <th>Change</th>
                    <th>Stock After Change</th>
                    <th>Reason</th>
                    <th>User</th>
                </tr>
            </thead>
            <tbody>
                {#each $stockChanges as change}
                    <tr>
                        <td>{new Date(change.date).toLocaleString()}</td>
                        <td>{change.variant?.product?.name || "-"}</td>
                        <td>{change.variant?.sku || "-"}</td>
                        <td>{change.change > 0 ? "+" : ""}{change.change}</td>
                        <td>{change.variant?.stock ?? "-"}</td>
                        <td>{change.reason}</td>
                        <td>{change.user}</td>
                    </tr>
                {:else}
                    <tr><td colspan="7" style="text-align:center;">No stock changes yet.</td></tr>
                {/each}
            </tbody>
        </table>
    {/if}
</div>

<style>
    .admin-tabs {
        display: flex;
        gap: 1rem;
        margin-bottom: 1.5rem;
        padding-left: 0;
    }
    .admin-tabs button {
        background: var(--color-bg, #fff);
        color: var(--color-link);
        border: 1.5px solid var(--color-border);
        border-radius: 8px 8px 0 0;
        padding: 0.7rem 2.2rem;
        font-size: 1.1rem;
        font-weight: 600;
        cursor: pointer;
        transition:
            background 0.2s,
            color 0.2s,
            border 0.2s;
        outline: none;
    }
    .admin-tabs button.active-tab {
        background: var(--color-link-bg-hover, #f1f5f9);
        color: var(--color-link-hover, #6366f1);
        border-bottom: 2.5px solid var(--color-link-hover, #6366f1);
        z-index: 2;
    }
    .variant-table th,
    .variant-table td {
        padding: 0.3rem 0.5rem;
    }
    .variant-table {
        margin-bottom: 0;
    }
    .order-cancelled {
        background: var(--order-cancelled-bg, #ffeaea);
        color: var(--order-cancelled-color, #b91c1c);
        opacity: 0.7;
    }
</style>
