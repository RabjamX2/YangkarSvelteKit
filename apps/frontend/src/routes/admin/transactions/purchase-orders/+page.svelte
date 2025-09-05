<script>
    // @ts-nocheck
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import "../transactionTable.css";

    const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;
    const purchaseOrders = writable([]);
    const expandedBatch = writable([]);
    const batchArrivedChanges = writable({});
    const loadingTransactions = writable(false);
    const errorTransactions = writable(null);

    // Helper to include credentials for authentication
    const fetchAuth = (url, options = {}) => {
        return fetch(url, { ...options, credentials: "include" });
    };

    function toggleArrived(itemId, currentValue) {
        batchArrivedChanges.update((changes) => ({
            ...changes,
            [itemId]: !currentValue,
        }));
    }

    async function submitBatchArrived(batchOrder) {
        let $batchArrivedChanges;
        batchArrivedChanges.subscribe((v) => ($batchArrivedChanges = v))();
        const changedItems = batchOrder.items.filter(
            (item) => $batchArrivedChanges[item.id] !== undefined && $batchArrivedChanges[item.id] !== item.hasArrived
        );
        if (changedItems.length === 0) return;
        try {
            for (const item of changedItems) {
                await fetchAuth(`${PUBLIC_BACKEND_URL}/api/purchase-order-items/${item.id}/arrived`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ hasArrived: $batchArrivedChanges[item.id] }),
                });
            }
            const purchRes = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/purchase-orders`);
            if (purchRes.ok) {
                const purchData = await purchRes.json();
                purchaseOrders.set(purchData.data || []);
            }
            batchArrivedChanges.update((changes) => {
                const newChanges = { ...changes };
                for (const item of batchOrder.items) {
                    delete newChanges[item.id];
                }
                return newChanges;
            });
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        }
    }

    onMount(async () => {
        loadingTransactions.set(true);
        try {
            const purchRes = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/purchase-orders`);
            if (!purchRes.ok) throw new Error("Failed to fetch purchase orders");
            const purchData = await purchRes.json();
            purchaseOrders.set(purchData.data || []);
        } catch (e) {
            errorTransactions.set(e instanceof Error ? e.message : String(e));
        } finally {
            loadingTransactions.set(false);
        }
    });
</script>

<div class="admin-container">
    <h2>Purchase Orders</h2>
    {#if $loadingTransactions}
        <p>Loading transactions...</p>
    {:else if $errorTransactions}
        <p style="color:red">Error: {$errorTransactions}</p>
    {:else}
        <table class="admin-table">
            <thead>
                <tr>
                    <th></th>
                    <th>Batch Number</th>
                    <th>Date</th>
                    <th>Arrived?</th>
                </tr>
            </thead>
            <tbody>
                {#each $purchaseOrders as order}
                    <tr>
                        <td>
                            <button
                                on:click={() => {
                                    expandedBatch.update((ids) =>
                                        ids.includes(order.id)
                                            ? ids.filter((id) => id !== order.id)
                                            : [...ids, order.id]
                                    );
                                }}
                            >
                                {#if $expandedBatch.includes(order.id)}−{:else}+{/if}
                            </button>
                        </td>
                        <td>{order.batchNumber}</td>
                        <td>{order.shipDate ? new Date(order.shipDate).toLocaleString() : "-"}</td>
                        <td>{order.hasArrived ? "Yes" : "No"}</td>
                    </tr>
                    {#if $expandedBatch.includes(order.id)}
                        <tr>
                            <td></td>
                            <td colspan="3">
                                <strong>Items in Batch {order.batchNumber}:</strong>
                                <form on:submit|preventDefault={() => submitBatchArrived(order)}>
                                    <table class="variant-table" style="margin-top:0.5rem;">
                                        <thead>
                                            <tr>
                                                <th>SKU</th>
                                                <th>Product</th>
                                                <th>Color</th>
                                                <th>Size</th>
                                                <th>Quantity</th>
                                                <th>CNY</th>
                                                <th>USD</th>
                                                <th>Arrived?</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {#each order.items as item}
                                                <tr>
                                                    <td>{item.variant?.sku || "-"}</td>
                                                    <td>{item.variant?.product?.name || "-"}</td>
                                                    <td>{item.variant?.color || "-"}</td>
                                                    <td>{item.variant?.size || "-"}</td>
                                                    <td>{item.quantityOrdered}</td>
                                                    <td>{item.costPerItemCny ?? "-"}</td>
                                                    <td>{item.costPerItemUsd ?? "-"}</td>
                                                    <td>
                                                        <input
                                                            type="checkbox"
                                                            checked={batchArrivedChanges[item.id] !== undefined
                                                                ? batchArrivedChanges[item.id]
                                                                : item.hasArrived}
                                                            on:change={() =>
                                                                toggleArrived(
                                                                    item.id,
                                                                    batchArrivedChanges[item.id] !== undefined
                                                                        ? batchArrivedChanges[item.id]
                                                                        : item.hasArrived
                                                                )}
                                                        />
                                                    </td>
                                                </tr>
                                            {/each}
                                        </tbody>
                                    </table>
                                    <button type="submit" style="margin-top:0.7rem;">Submit Arrived Changes</button>
                                </form>
                            </td>
                        </tr>
                    {/if}
                {/each}
            </tbody>
        </table>
    {/if}
</div>
