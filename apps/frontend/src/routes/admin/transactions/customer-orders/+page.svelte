<script>
    // @ts-nocheck
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import { page } from "$app/stores";
    import "../transactionTable.css";
    import AdminHeader from "$lib/components/AdminHeader.svelte";

    const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;
    const customerOrders = writable([]);
    const loadingTransactions = writable(false);
    const errorTransactions = writable(null);
    const expandedOrder = writable(null);

    let loggedInUser = "";
    $: loggedInUser = $page.data?.user?.name || $page.data?.user?.username || $page.data?.user?.email || "";

    // Helper to include credentials for authentication
    const fetchAuth = (url, options = {}) => {
        return fetch(url, { ...options, credentials: "include" });
    };

    async function voidOrder(orderId) {
        if (!confirm("Are you sure you want to void this transaction? This cannot be undone.")) return;
        try {
            // Updated endpoint may be /api/customer-orders/:id/void or similar. Adjust as needed.
            const res = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/customer-orders/${orderId}/void`, {
                method: "POST",
            });
            if (!res.ok) throw new Error("Failed to void order");
            // Refresh orders
            const custRes = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/customer-orders`);
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
            const custRes = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/customer-orders`);
            if (!custRes.ok) throw new Error("Failed to fetch customer orders");
            const custData = await custRes.json();
            customerOrders.set(custData.data || []);
        } catch (e) {
            errorTransactions.set(e instanceof Error ? e.message : String(e));
        } finally {
            loadingTransactions.set(false);
        }
    });
</script>

<AdminHeader />
<div class="admin-container">
    <h2>Customer Orders</h2>
    {#if $loadingTransactions}
        <p>Loading transactions...</p>
    {:else if $errorTransactions}
        <p style="color:red">Error: {$errorTransactions}</p>
    {:else}
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
                    <tr class:order-cancelled={order.fulfillmentStatus === "CANCELLED"}>
                        <td>
                            <button on:click={() => expandedOrder.set($expandedOrder === order.id ? null : order.id)}>
                                {#if $expandedOrder === order.id}−{:else}+{/if}
                            </button>
                        </td>
                        <td>{order.id}</td>
                        <td
                            >{order.customer?.name || order.customerName || "-"} ({order.customer?.phone ||
                                order.customerPhone ||
                                "-"})</td
                        >
                        <td>{order.orderDate ? new Date(order.orderDate).toLocaleString() : "-"}</td>
                        <td>{order.total ?? "-"}</td>
                        <td>{order.paymentMethod ?? "-"}</td>
                        <td>{order.moneyHolder ?? "-"}</td>
                        <td>
                            {order.fulfillmentStatus === "CANCELLED"
                                ? "Voided"
                                : order.fulfillmentStatus?.charAt(0) + order.fulfillmentStatus?.slice(1).toLowerCase()}
                        </td>
                        <td>
                            <button
                                on:click={() => voidOrder(order.id)}
                                style="color:red;"
                                disabled={order.fulfillmentStatus === "CANCELLED"}
                            >
                                Void
                            </button>
                        </td>
                    </tr>
                    {#if $expandedOrder === order.id}
                        <tr class:order-cancelled={order.fulfillmentStatus === "CANCELLED"}>
                            <td></td>
                            <td colspan="8">
                                <strong>Items:</strong>
                                <table class="variant-table" style="margin-top:0.5rem;">
                                    <thead>
                                        <tr>
                                            <th>Product</th>
                                            <th>Variant SKU</th>
                                            <th>Quantity</th>
                                            <th>Sale Price</th>
                                            <th>COGS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {#each order.items as item}
                                            <tr>
                                                <td>{item.productName ?? item.variant?.product?.displayName ?? "-"}</td>
                                                <td>{item.productSku ?? item.variant?.sku ?? "-"}</td>
                                                <td>{item.quantity}</td>
                                                <td>{item.salePrice ?? "-"}</td>
                                                <td>{item.cogs ?? "-"}</td>
                                            </tr>
                                        {/each}
                                    </tbody>
                                </table>
                                {#if order.fulfillmentStatus === "CANCELLED"}
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
    {/if}
</div>
