<script>
    // @ts-nocheck
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import { page } from "$app/stores";
    import "../transactionTable.css";
    import AdminHeader from "$lib/components/AdminHeader.svelte";
    import { createAuthFetch } from "$lib/utils/csrf";

    const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;
    const customerOrders = writable([]);
    const loadingTransactions = writable(false);
    const errorTransactions = writable(null);
    const expandedOrder = writable(null);
    const editingOrder = writable(null); // order id being edited
    const editForm = writable({}); // temp form state

    let loggedInUser = "";
    $: loggedInUser = $page.data?.user?.name || $page.data?.user?.username || $page.data?.user?.email || "";

    // Create authenticated fetch with CSRF protection
    $: csrfToken = $page.data?.csrfToken;
    $: fetchAuth = createAuthFetch(csrfToken);

    async function startEdit(order) {
        editingOrder.set(order.id);
        editForm.set({
            name: order.customerName || order.customer?.name || "",
            moneyHolder: order.moneyHolder || "",
            status: order.fulfillmentStatus || "",
        });
    }

    function cancelEdit() {
        editingOrder.set(null);
        editForm.set({});
    }

    async function saveEdit(order) {
        let $editForm;
        editForm.subscribe((v) => ($editForm = v))();
        try {
            const res = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/customer-orders/${order.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerName: $editForm.name,
                    moneyHolder: $editForm.moneyHolder,
                    fulfillmentStatus: $editForm.status,
                }),
            });
            if (!res.ok) throw new Error("Failed to update order");
            // Refresh orders
            const custRes = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/customer-orders`);
            if (custRes.ok) {
                const custData = await custRes.json();
                customerOrders.set(custData.data || []);
            }
            editingOrder.set(null);
            editForm.set({});
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        }
    }

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
                        {#if $editingOrder === order.id}
                            <td>
                                <input
                                    type="text"
                                    bind:value={$editForm.name}
                                    placeholder="Customer Name"
                                    style="width:120px;background:var(--color-bg);color:var(--color-link);border:1px solid var(--color-border);border-radius:4px;padding:0.2rem 0.5rem;"
                                />
                                <div style="font-size:0.92em;color:var(--color-link-hover);margin-top:0.2em;">
                                    ({order.customer?.phone || order.customerPhone || "-"})
                                </div>
                            </td>
                            <td>{order.orderDate ? new Date(order.orderDate).toLocaleString() : "-"}</td>
                            <td>{order.total ?? "-"}</td>
                            <td>{order.paymentMethod ?? "-"}</td>
                            <td>
                                <input
                                    type="text"
                                    bind:value={$editForm.moneyHolder}
                                    placeholder="Money Holder"
                                    style="width:90px;background:var(--color-bg);color:var(--color-link);border:1px solid var(--color-border);border-radius:4px;padding:0.2rem 0.5rem;"
                                />
                            </td>
                            <td>
                                <select
                                    bind:value={$editForm.status}
                                    style="background:var(--color-bg);color:var(--color-link);border:1px solid var(--color-border);border-radius:4px;padding:0.2rem 0.5rem;"
                                >
                                    <option value="UNFULFILLED">Unfulfilled</option>
                                    <option value="PROCESSING">Processing</option>
                                    <option value="SHIPPED">Shipped</option>
                                    <option value="DELIVERED">Delivered</option>
                                    <option value="PICKED_UP">Picked Up</option>
                                    <option value="CANCELLED">Cancelled</option>
                                </select>
                            </td>
                            <td style="white-space:nowrap;">
                                <button
                                    on:click={() => saveEdit(order)}
                                    style="background:var(--color-signup-bg);color:var(--color-signup);border:none;border-radius:4px;padding:0.25rem 0.9rem;font-weight:600;box-shadow:0 1px 2px 0 var(--color-shadow);margin-right:0.4rem;cursor:pointer;transition:background 0.18s;"
                                    >💾 Save</button
                                >
                                <button
                                    on:click={cancelEdit}
                                    style="background:var(--color-link-bg-hover);color:var(--color-link);border:none;border-radius:4px;padding:0.25rem 0.9rem;font-weight:500;box-shadow:0 1px 2px 0 var(--color-shadow);cursor:pointer;transition:background 0.18s;"
                                    >✕ Cancel</button
                                >
                            </td>
                        {:else}
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
                                    : order.fulfillmentStatus?.charAt(0) +
                                      order.fulfillmentStatus?.slice(1).toLowerCase()}
                            </td>
                            <td style="white-space:nowrap;">
                                <button
                                    on:click={() => startEdit(order)}
                                    style="background:var(--color-link-bg-hover);color:var(--color-link);border:none;border-radius:4px;padding:0.3rem 1rem;margin-right:0.5rem;cursor:pointer;"
                                    >Edit</button
                                >
                                <button
                                    on:click={() => voidOrder(order.id)}
                                    style="color:red;background:var(--color-bg);border:1px solid var(--color-border);border-radius:4px;padding:0.3rem 1rem;cursor:pointer;"
                                    disabled={order.fulfillmentStatus === "CANCELLED"}
                                >
                                    Void
                                </button>
                            </td>
                        {/if}
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
