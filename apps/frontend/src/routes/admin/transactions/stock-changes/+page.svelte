<script>
    // @ts-nocheck
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import AdminHeader from "$lib/components/AdminHeader.svelte";
    import "../transactionTable.css";

    const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;
    const stockChanges = writable([]);
    const productVariants = writable([]);
    const manualStockChange = writable({ variantId: "", change: "", reason: "", user: "" });
    const manualStockChangeError = writable("");
    const loadingTransactions = writable(false);
    const errorTransactions = writable(null);

    // Helper to include credentials for authentication
    const fetchAuth = (url, options = {}) => {
        return fetch(url, { ...options, credentials: "include" });
    };

    async function fetchStockChanges() {
        try {
            const res = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/stock-changes`);
            if (!res.ok) throw new Error("Failed to fetch stock changes");
            const data = await res.json();
            stockChanges.set(data.data || []);
        } catch (e) {
            errorTransactions.set(e instanceof Error ? e.message : String(e));
        }
    }

    async function fetchProductVariants() {
        try {
            const res = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/products-with-variants?all=true`);
            if (!res.ok) throw new Error("Failed to fetch variants");
            const data = await res.json();
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
        if (!$manualStockChange.variantId || !$manualStockChange.change || !$manualStockChange.reason) {
            manualStockChangeError.set("All fields are required.");
            return;
        }
        try {
            const res = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/stock-changes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productVariantId: $manualStockChange.variantId,
                    change: $manualStockChange.change,
                    reason: $manualStockChange.reason,
                    user: $manualStockChange.user || "Manual",
                }),
            });
            if (!res.ok) throw new Error("Failed to record stock change");
            manualStockChange.set({ variantId: "", change: "", reason: "", user: "" });
            manualStockChangeError.set("");
            fetchStockChanges();
        } catch (e) {
            manualStockChangeError.set(e instanceof Error ? e.message : String(e));
        }
    }

    onMount(() => {
        fetchStockChanges();
        fetchProductVariants();
    });
</script>

<AdminHeader />
<div class="admin-container">
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
</div>
