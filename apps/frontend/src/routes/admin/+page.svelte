<script>
    import { onMount } from "svelte";
    import { writable } from "svelte/store";

    const products = writable([]);
    const loading = writable(true);
    const error = writable(null);
    const edits = writable({}); // { [id]: { field: value } }
    const categories = writable([]);
    const selectedCategory = writable("");
    const searchSkuBase = writable("");
    const searchName = writable("");

    onMount(async () => {
        loading.set(true);
        try {
            // Fetch categories
            const catRes = await fetch("http://localhost:3000/api/categories");
            if (catRes.ok) {
                const catData = await catRes.json();
                categories.set(catData);
            }
            // Fetch products with variants
            const res = await fetch("http://localhost:3000/api/products-with-variants");
            if (!res.ok) throw new Error("Failed to fetch products");
            const data = await res.json();
            console.log("Fetched products:", data);
            products.set(data.data);
        } catch (e) {
            error.set(e instanceof Error ? e.message : String(e));
        } finally {
            loading.set(false);
        }
    });

    function handleEdit(id, field, value) {
        edits.update((e) => ({ ...e, [id]: { ...e[id], [field]: value } }));
    }

    async function saveEdit(id) {
        let $edits;
        edits.subscribe((v) => ($edits = v))();
        if (!$edits[id]) return;
        try {
            const res = await fetch(`http://localhost:3000/api/products/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify($edits[id]),
            });
            if (!res.ok) throw new Error("Failed to update");
            products.update((list) => list.map((p) => (p.id === id ? { ...p, ...$edits[id] } : p)));
            edits.update((e) => {
                const { [id]: _, ...rest } = e;
                return rest;
            });
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        }
    }

    async function saveVariantEdit(variantId) {
        let $edits;
        edits.subscribe((v) => ($edits = v))();
        if (!$edits[variantId]) return;
        try {
            const res = await fetch(`http://localhost:3000/api/variants/${variantId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify($edits[variantId]),
            });
            if (!res.ok) throw new Error("Failed to update variant");
            // Update local products store
            products.update((list) =>
                list.map((product) => ({
                    ...product,
                    variants: product.variants.map((v) => (v.id === variantId ? { ...v, ...$edits[variantId] } : v)),
                }))
            );
            edits.update((e) => {
                const { [variantId]: _, ...rest } = e;
                return rest;
            });
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        }
    }
</script>

<svelte:head>
    <title>Admin Panel</title>
</svelte:head>

<div class="admin-container">
    {#if $loading}
        <p>Loading...</p>
    {:else if $error}
        <p style="color:red">Error: {$error}</p>
    {:else}
        <table class="admin-table">
            <thead>
                <tr>
                    <th>SKU Base</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th colspan="3"></th>
                </tr>
                <tr>
                    <th>
                        <input
                            id="sku-search"
                            type="text"
                            placeholder="Search..."
                            style="width: 100%"
                            bind:value={$searchSkuBase}
                        />
                    </th>
                    <th>
                        <input
                            id="name-search"
                            type="text"
                            placeholder="Search..."
                            style="width: 100%"
                            bind:value={$searchName}
                        />
                    </th>
                    <th>
                        <select id="category-select" bind:value={$selectedCategory}>
                            <option value="">All Categories</option>
                            {#each $categories as cat}
                                <option value={cat.name}>{cat.name}</option>
                            {/each}
                        </select>
                    </th>
                    <th colspan="3"></th>
                </tr>
            </thead>
            <tbody>
                {#each $products.filter((p) => (!$selectedCategory || p.categoryName === $selectedCategory) && (!$searchSkuBase || p.skuBase
                                .toLowerCase()
                                .includes($searchSkuBase.toLowerCase())) && (!$searchName || p.name
                                .toLowerCase()
                                .includes($searchName.toLowerCase()))) as product}
                    <tr class="product-row">
                        <td>{product.skuBase}</td>
                        <td>{product.name}</td>
                        <td>{product.categoryName}</td>
                        <td colspan="3">
                            <table class="variant-table">
                                <thead>
                                    <tr>
                                        <th>SKU</th>
                                        <th>Color</th>
                                        <th>Size</th>
                                        <th>Price</th>
                                        <th>Stock</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each product.variants as variant}
                                        <tr>
                                            <td>{variant.sku}</td>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={$edits[variant.id]?.color ?? variant.color}
                                                    on:input={(e) => handleEdit(variant.id, "color", e.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={$edits[variant.id]?.size ?? variant.size}
                                                    on:input={(e) => handleEdit(variant.id, "size", e.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    value={$edits[variant.id]?.salePrice ?? variant.salePrice}
                                                    on:input={(e) =>
                                                        handleEdit(variant.id, "salePrice", e.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    value={$edits[variant.id]?.stock ?? variant.stock}
                                                    on:input={(e) => handleEdit(variant.id, "stock", e.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <button
                                                    class="save-btn"
                                                    on:click={() => saveVariantEdit(variant.id)}
                                                    disabled={!$edits[variant.id]}>Save</button
                                                >
                                            </td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
</div>

<style>
    :global(body) {
        background: #f6f8fa;
        font-family: "Inter", "Segoe UI", Arial, sans-serif;
        color: #222;
        margin: 0;
    }
    .admin-container {
        max-width: 1900px;
        margin: 2rem auto;
        background: var(--color-bg, #fff);
        border-radius: 16px;
        box-shadow: var(--color-shadow, 0 4px 24px 0 rgba(0, 0, 0, 0.07));
        padding: 1.2rem 1.2rem 2rem 1.2rem;
        overflow-x: auto;
    }
    @media (max-width: 1200px) {
        .admin-container {
            max-width: 98vw;
            padding-left: 0.5rem;
            padding-right: 0.5rem;
        }
    }
    @media (max-width: 900px) {
        .admin-container {
            padding: 0.5rem 0.2rem;
        }
        .admin-table th,
        .admin-table td {
            padding: 0.5rem 0.2rem;
        }
        .variant-table th,
        .variant-table td {
            padding: 0.3rem 0.1rem;
        }
        h1 {
            font-size: 1.3rem;
        }
    }
    h1 {
        font-size: 2.2rem;
        font-weight: 700;
        margin-bottom: 1.5rem;
        letter-spacing: -1px;
    }
    .admin-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        border-radius: 0;
        box-shadow: none;
        color: var(--color-link);
        table-layout: auto;
    }
    .admin-table th,
    .admin-table td,
    .variant-table th,
    .variant-table td {
        padding: 0.5rem 0.4rem;
        text-align: left;
        color: var(--color-link);
        border-color: var(--color-border);
        min-width: 0;
        width: auto;
        word-break: break-word;
    }
    .admin-table th.sku,
    .admin-table td.sku,
    .variant-table th.sku,
    .variant-table td.sku {
        white-space: nowrap;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .admin-table th.name,
    .admin-table td.name {
        /* Remove max-width for name so it can wrap */
        overflow: visible;
        text-overflow: unset;
        white-space: normal;
    }
    .admin-table tr.product-row {
        background: var(--color-bg, #fff);
        transition: background 0.2s;
    }
    .admin-table tr.product-row:hover {
        background: var(--color-link-bg-hover, #f9fafb);
    }
    .admin-table input,
    .admin-table select {
        width: 100%;
        box-sizing: border-box;
        padding: 0.4rem 0.5rem;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        font-size: 1rem;
        background: var(--color-user-badge-bg, #f9fafb);
        color: var(--color-link);
        transition:
            border 0.2s,
            box-shadow 0.2s;
    }
    .admin-table input:focus,
    .admin-table select:focus {
        border-color: var(--color-link-hover);
        outline: none;
        box-shadow: 0 0 0 2px var(--color-link-hover, #6366f1) 33;
    }
    .save-btn {
        background: var(--color-signup-bg, #6366f1);
        color: var(--color-signup, #fff);
        border: none;
        border-radius: 6px;
        padding: 0.4rem 1.1rem;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition:
            background 0.2s,
            box-shadow 0.2s;
        box-shadow: 0 1px 4px 0 var(--color-shadow, rgba(99, 102, 241, 0.08));
    }
    .save-btn:disabled {
        background: #d1d5db;
        color: #888;
        cursor: not-allowed;
    }
    .save-btn:not(:disabled):hover {
        background: var(--color-signup-bg-hover, #4f46e5);
    }
    .variant-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        background: var(--color-user-badge-bg, #f8fafc);
        border-radius: 8px;
        margin: 0.5rem 0;
        box-shadow: 0 1px 4px 0 var(--color-shadow, rgba(0, 0, 0, 0.03));
    }
    .variant-table th,
    .variant-table td {
        padding: 0.5rem 0.5rem;
        font-size: 0.98em;
        color: var(--color-link);
        border-color: var(--color-border);
    }
    .variant-table th {
        background: var(--color-link-bg-hover, #f1f5f9);
        font-weight: 500;
        border-bottom: 1.5px solid var(--color-border);
    }
    .variant-table tr {
        background: var(--color-bg, #fff);
        transition: background 0.2s;
    }
    .variant-table tr:hover {
        background: var(--color-link-bg-hover, #f3f4f6);
    }
    .variant-table input {
        width: 100%;
        height: fit-content;
        box-sizing: border-box;
        background: var(--color-link-bg-hover, #f3f4f6);
        border: 1px solid var(--color-border);
        border-radius: 5px;
        font-size: 0.98em;
        padding: 0.3rem 0.5rem;
        color: var(--color-link);
    }
    .variant-table input:focus {
        border-color: var(--color-link-hover);
        outline: none;
        box-shadow: 0 0 0 2px var(--color-link-hover, #6366f1) 33;
    }
</style>
