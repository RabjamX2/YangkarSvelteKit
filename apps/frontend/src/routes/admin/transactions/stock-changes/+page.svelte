<script>
    // @ts-nocheck
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import AdminHeader from "$lib/components/AdminHeader.svelte";
    import { createAuthFetch } from "$lib/utils/csrf";
    import { page } from "$app/stores";
    import "../transactionTable.css";

    const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;
    const stockChanges = writable([]);
    const groupedStockChanges = writable([]);
    const productVariants = writable([]);
    const manualStockChange = writable({ variantId: "", change: "", reason: "", user: "" });
    const manualStockChangeError = writable("");
    const loadingTransactions = writable(false);
    const errorTransactions = writable(null);
    const variantSearch = writable("");
    const expandedDates = writable({});

    // Create authenticated fetch with CSRF protection
    $: csrfToken = $page.data?.csrfToken;
    $: fetchAuth = createAuthFetch(csrfToken);

    function groupByDay(changes) {
        const groups = {};
        for (const change of changes) {
            const date = new Date(change.changeTime);
            const day = date.toISOString().slice(0, 10); // YYYY-MM-DD
            if (!groups[day]) groups[day] = [];
            groups[day].push(change);
        }
        // Sort days descending
        return Object.entries(groups)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([day, changes]) => ({ day, changes }));
    }

    async function fetchStockChanges() {
        try {
            const res = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/stock-changes`);
            if (!res.ok) throw new Error("Failed to fetch stock changes");
            const data = await res.json();
            stockChanges.set(data.data || []);
            groupedStockChanges.set(groupByDay(data.data || []));
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

    // Derived store for filtered variants
    import { derived } from "svelte/store";
    const filteredVariants = derived([productVariants, variantSearch], ([$productVariants, $variantSearch]) => {
        if (!$variantSearch) return $productVariants;
        const term = $variantSearch.toLowerCase();
        return $productVariants.filter(
            (v) =>
                v.productName?.toLowerCase().includes(term) ||
                v.sku?.toLowerCase().includes(term) ||
                v.color?.toLowerCase().includes(term) ||
                (v.size && v.size.toLowerCase().includes(term))
        );
    });

    // Derived store for filtered grouped stock changes
    const filteredGroupedStockChanges = derived(
        [groupedStockChanges, variantSearch],
        ([$groupedStockChanges, $variantSearch]) => {
            if (!$variantSearch) return $groupedStockChanges;
            const term = $variantSearch.toLowerCase();
            return $groupedStockChanges
                .map(({ day, changes }) => ({
                    day,
                    changes: changes.filter((change) => {
                        const variant = change.variant || {};
                        return (
                            variant.product?.name?.toLowerCase().includes(term) ||
                            variant.sku?.toLowerCase().includes(term) ||
                            variant.color?.toLowerCase().includes(term) ||
                            (variant.size && variant.size.toLowerCase().includes(term))
                        );
                    }),
                }))
                .filter((group) => group.changes.length > 0);
        }
    );
</script>

<AdminHeader />
<div class="admin-container">
    <h2>Stock Change History</h2>
    <div
        style="margin-bottom:1rem;display:flex;gap:1rem;align-items:center;flex-wrap:wrap;background:var(--color-bg);color:var(--color-link);"
    >
        <form
            on:submit|preventDefault={submitManualStockChange}
            style="display:flex;gap:1rem;flex-wrap:wrap;align-items:end;"
        >
            <div>
                <label for="variant">Variant:</label><br />
                <select id="variant" bind:value={$manualStockChange.variantId} required style="min-width:200px;">
                    <option value="">Select variant...</option>
                    {#each $filteredVariants as v}
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
        <div>
            <label for="variantSearch">Search Variant:</label><br />
            <input
                id="variantSearch"
                type="text"
                bind:value={$variantSearch}
                placeholder="Search by name, SKU, color, size..."
                style="min-width:180px;"
            />
        </div>
    </div>

    {#if $filteredGroupedStockChanges.length === 0}
        <div style="text-align:center;margin-top:2rem;">No stock changes found.</div>
    {:else}
        <div>
            {#each $filteredGroupedStockChanges as group}
                <div style="margin-bottom:1.5rem;">
                    <button
                        type="button"
                        style="width:100%;text-align:left;cursor:pointer;font-weight:bold;background:var(--color-link-bg-hover);color:var(--color-link);padding:0.5rem;border-radius:4px;border:none;"
                        aria-expanded={$expandedDates[group.day] ? "true" : "false"}
                        on:click={() => expandedDates.update((e) => ({ ...e, [group.day]: !e[group.day] }))}
                    >
                        {group.day}
                        <span style="font-weight:normal;color:var(--color-link-hover);margin-left:1rem;"
                            >({group.changes.length} change{group.changes.length > 1 ? "s" : ""})</span
                        >
                        <span style="float:right;"
                            >{#if $expandedDates[group.day]}▼{:else}▶{/if}</span
                        >
                    </button>
                    {#if $expandedDates[group.day]}
                        <table class="admin-table" style="margin-top:0.5rem;">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Product</th>
                                    <th>Variant</th>
                                    <th>Change</th>
                                    <th>Stock After Change</th>
                                    <th>Reason</th>
                                    <th>User</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each group.changes as change}
                                    <tr>
                                        <td>{new Date(change.date || change.changeTime).toLocaleTimeString()}</td>
                                        <td>{change.variant?.product?.name || "-"}</td>
                                        <td>{change.variant?.sku || "-"}</td>
                                        <td>{change.change > 0 ? "+" : ""}{change.change}</td>
                                        <td>{change.variant?.stock ?? "-"}</td>
                                        <td>{change.reason}</td>
                                        <td>{change.user}</td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>
