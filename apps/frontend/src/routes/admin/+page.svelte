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

<h1>Admin Panel</h1>

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
                                                on:input={(e) => handleEdit(variant.id, "salePrice", e.target.value)}
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

<style>
    .admin-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 2rem;
    }
    .admin-table th,
    .admin-table td {
        border: 1px solid #ccc;
        padding: 0.5rem;
    }
    .admin-table input {
        width: 100%;
        box-sizing: border-box;
    }
    .variant-table {
        width: 100%;
        border-collapse: collapse;
        margin: 0.5rem 0;
        background: #fafafa;
    }
    .variant-table th,
    .variant-table td {
        border: 1px solid #ddd;
        padding: 0.25rem;
        font-size: 0.95em;
    }
</style>
