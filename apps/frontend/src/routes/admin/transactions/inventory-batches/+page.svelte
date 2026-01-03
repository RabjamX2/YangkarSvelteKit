<script>
    // @ts-nocheck
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import AdminHeader from "$lib/components/AdminHeader.svelte";
    import { apiFetch } from "$lib/utils/api.js";
    import { auth } from "$lib/stores/auth.store.js";
    import { page } from "$app/stores";
    import "../transactionTable.css";

    // REQUIRED: Receive data prop from layout
    export let data;

    // REQUIRED: Set CSRF token in auth store
    $: if (data?.csrfToken) {
        if ($auth.csrfToken !== data.csrfToken) {
            auth.setCsrfToken(data.csrfToken);
        }
    }

    const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;
    const inventoryBatches = writable([]);
    const loadingBatches = writable(false);
    const errorBatches = writable(null);

    onMount(async () => {
        loadingBatches.set(true);
        errorBatches.set(null);
        try {
            const response = await apiFetch(`/api/inventory-batches`);
            if (!response.ok) {
                throw new Error("Failed to fetch inventory batches.");
            }
            const result = await response.json();
            inventoryBatches.set(result.data);
        } catch (err) {
            errorBatches.set(err.message);
        } finally {
            loadingBatches.set(false);
        }
    });
</script>

<AdminHeader />
<div class="transaction-container">
    <h1>Inventory Batches (FIFO)</h1>
    {#if $loadingBatches}
        <p>Loading...</p>
    {:else if $errorBatches}
        <p class="error">{$errorBatches}</p>
    {:else if $inventoryBatches.length === 0}
        <p>No inventory batches found.</p>
    {:else}
        <table class="transaction-table">
            <thead>
                <tr>
                    <th>Batch ID</th>
                    <th>Product SKU</th>
                    <th>Color</th>
                    <th>Size</th>
                    <th>Quantity</th>
                    <th>Cost (USD)</th>
                    <th>Cost (CNY)</th>
                    <th>Arrival Date</th>
                </tr>
            </thead>
            <tbody>
                {#each $inventoryBatches as batch (batch.id)}
                    <tr>
                        <td>{batch.id}</td>
                        <td>{batch.productVariant?.sku}</td>
                        <td>{batch.productVariant?.color}</td>
                        <td>{batch.productVariant?.size}</td>
                        <td>{batch.quantity}</td>
                        <td>{batch.costUSD ? `$${parseFloat(batch.costUSD).toFixed(2)}` : "-"}</td>
                        <td>{batch.costCNY ? batch.costCNY : "-"}</td>
                        <td
                            >{batch.purchaseOrderItem?.order?.arrivalDate
                                ? new Date(batch.purchaseOrderItem.order.arrivalDate).toLocaleDateString()
                                : "-"}</td
                        >
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
</div>

<style>
    /* Reuse transactionTable.css for consistent styling */
</style>
