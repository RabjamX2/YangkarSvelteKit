<script>
    import { API_BASE_URL } from "$lib/env.js";
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import "./productTable.css";

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
            const catRes = await fetch(`${API_BASE_URL}/api/categories`);
            if (catRes.ok) {
                const catData = await catRes.json();
                categories.set(catData);
            }
            // Fetch products with variants (all for admin)
            const res = await fetch(`${API_BASE_URL}/api/products-with-variants?all=true`);
            if (!res.ok) throw new Error("Failed to fetch products");
            const data = await res.json();
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
            const res = await fetch(`${API_BASE_URL}/api/products/${id}`, {
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
            const res = await fetch(`${API_BASE_URL}/api/variants/${variantId}`, {
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

<div class="admin-container">
    <h1>Product List</h1>
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
                                            <td>{variant.color}</td>
                                            <td>{variant.size}</td>
                                            <td>{variant.salePrice}</td>
                                            <td>{variant.stock}</td>
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
