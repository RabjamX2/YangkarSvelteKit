<script>
    // @ts-nocheck

    const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import AdminHeader from "$lib/components/AdminHeader.svelte";
    import "./productTable.css";

    const products = writable([]);
    const expanded = writable({}); // { [productId]: true }
    const keepExpanded = writable(false);
    // Used to trigger refresh animation
    const refreshAnim = writable({}); // { [productId]: true }
    const search = writable("");
    const loading = writable(true);
    const error = writable(null);
    const edits = writable({}); // { [id]: { field: value } }
    const bulkPrice = writable({}); // { [productId]: price }

    // Feedback messages for actions
    const feedback = writable({}); // { [id]: { type: 'success'|'error', message: string } }

    function showFeedback(id, type, message, timeout = 2000) {
        feedback.update((f) => ({ ...f, [id]: { type, message } }));
        setTimeout(() => {
            feedback.update((f) => {
                const { [id]: _, ...rest } = f;
                return rest;
            });
        }, timeout);
    }
    const categories = writable([]);
    const selectedCategory = writable("");
    const searchSkuBase = writable("");
    const searchName = writable("");
    const sortBy = writable("none"); // "none", "salePriceAsc", "salePriceDesc"

    // Derived: categoryID to name map
    let categoryIdToName = {};
    categories.subscribe((cats) => {
        categoryIdToName = {};
        if (Array.isArray(cats)) {
            cats.forEach((cat) => {
                categoryIdToName[cat.id] = cat.name;
            });
        }
    });

    onMount(async () => {
        loading.set(true);
        try {
            // Fetch categories
            const catRes = await fetch(`${PUBLIC_BACKEND_URL}/api/categories`);
            if (catRes.ok) {
                const catData = await catRes.json();
                categories.set(catData);
            }
            // Fetch products with variants (all for admin)
            const res = await fetch(`${PUBLIC_BACKEND_URL}/api/products-with-variants?all=true`);
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
            const res = await fetch(`${PUBLIC_BACKEND_URL}/api/products/${id}`, {
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
            showFeedback(id, "success", "Saved!");
        } catch (e) {
            showFeedback(id, "error", e instanceof Error ? e.message : String(e));
        }
    }

    async function saveVariantEdit(variantId) {
        let $edits;
        edits.subscribe((v) => ($edits = v))();
        if (!$edits[variantId]) return;
        try {
            const res = await fetch(`${PUBLIC_BACKEND_URL}/api/variants/${variantId}`, {
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
            showFeedback(variantId, "success", "Saved!");
        } catch (e) {
            showFeedback(variantId, "error", e instanceof Error ? e.message : String(e));
        }
    }

    async function setAllVariantPrices(product) {
        let $bulkPrice;
        bulkPrice.subscribe((v) => ($bulkPrice = v))();
        const price = $bulkPrice[product.id];
        if (price === undefined || price === "") return;
        const variantIds = product.variants.map((v) => v.id);
        try {
            // Update all variants in parallel
            await Promise.all(
                variantIds.map(async (variantId) => {
                    const res = await fetch(`${PUBLIC_BACKEND_URL}/api/variants/${variantId}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ salePrice: price }),
                    });
                    if (!res.ok) throw new Error(`Failed to update variant ${variantId}`);
                })
            );
            // Update local store
            products.update((list) =>
                list.map((p) =>
                    p.id === product.id
                        ? {
                              ...p,
                              variants: p.variants.map((v) => ({ ...v, salePrice: price })),
                          }
                        : p
                )
            );
            bulkPrice.update((bp) => ({ ...bp, [product.id]: "" }));
            showFeedback(product.id, "success", "All prices set!");

            // Trigger refresh animation (collapse/expand) regardless of keepExpanded
            refreshAnim.update((r) => ({ ...r, [product.id]: true }));
            setTimeout(() => {
                refreshAnim.update((r) => {
                    const { [product.id]: _, ...rest } = r;
                    return rest;
                });
            }, 400);
        } catch (e) {
            showFeedback(product.id, "error", e instanceof Error ? e.message : String(e));
        }
    }
</script>

<AdminHeader />

<div class="admin-container">
    <h1>Product List</h1>
    <div style="margin-bottom:1rem;display:flex;align-items:center;gap:1.2rem;">
        <input
            type="text"
            class="search-input"
            placeholder="Search SKU, name, color, size..."
            bind:value={$search}
            style="width:100%;max-width:400px;"
        />
        <label style="display:flex;align-items:center;gap:0.4rem;font-size:1rem;">
            <input type="checkbox" bind:checked={$keepExpanded} />
            Keep Expanded
        </label>
        <select bind:value={$selectedCategory} style="font-size:1rem;padding:0.3rem 0.7rem;">
            <option value="">All Categories</option>
            {#each $categories as cat}
                <option value={cat.id}>{cat.name}</option>
            {/each}
        </select>
        <select bind:value={$sortBy} style="font-size:1rem;padding:0.3rem 0.7rem;">
            <option value="none">Sort: None</option>
            <option value="salePriceAsc">Sort by Sale Price (Low → High)</option>
            <option value="salePriceDesc">Sort by Sale Price (High → Low)</option>
        </select>
    </div>
    {#if $loading}
        <p>Loading...</p>
    {:else if $error}
        <p style="color:red">Error: {$error}</p>
    {:else}
        <div class="product-list">
            {#each $products
                .filter((p) => {
                    const s = $search.toLowerCase();
                    // Product-level search
                    const productMatch = p.skuBase?.toLowerCase().includes(s) || p.displayName
                            ?.toLowerCase()
                            .includes(s) || (p.categoryName?.toLowerCase().includes(s) ?? false);
                    // Variant-level search
                    const variants = p.variants.filter((v) => v.sku.toLowerCase().includes(s) || (v.color && v.color
                                    .toLowerCase()
                                    .includes(s)) || (v.size && v.size.toLowerCase().includes(s)));
                    // Category filter
                    if ($selectedCategory && p.categoryId !== Number($selectedCategory)) return false;
                    // Show product if product matches or any variant matches
                    return !$search || productMatch || variants.length > 0;
                })
                .slice() // copy before sort
                .sort((a, b) => {
                    if ($sortBy === "salePriceAsc") {
                        // Sort by lowest variant salePrice
                        const aPrice = Math.min(...a.variants.map((v) => Number(v.salePrice) || Infinity));
                        const bPrice = Math.min(...b.variants.map((v) => Number(v.salePrice) || Infinity));
                        return aPrice - bPrice;
                    } else if ($sortBy === "salePriceDesc") {
                        const aPrice = Math.max(...a.variants.map((v) => Number(v.salePrice) || -Infinity));
                        const bPrice = Math.max(...b.variants.map((v) => Number(v.salePrice) || -Infinity));
                        return bPrice - aPrice;
                    }
                    return 0;
                }) as product}
                <div class="product-card">
                    <div style="display:flex;align-items:center;width:100%;">
                        <button
                            type="button"
                            class="product-main"
                            aria-expanded={($keepExpanded || $expanded[product.id]) && !$refreshAnim[product.id]}
                            aria-controls={`variants-${product.id}`}
                            on:click={() => {
                                if (!$keepExpanded) expanded.update((e) => ({ ...e, [product.id]: !e[product.id] }));
                            }}
                            style="width:100%;text-align:left;background:none;border:none;padding:0;"
                            disabled={$keepExpanded}
                        >
                            <div class="product-info">
                                <span class="sku-base">{product.skuBase}</span>
                                <span class="product-name">{product.displayName ?? product.name}</span>
                                <span class="product-category"
                                    >{categoryIdToName[product.categoryId] ?? "No Category"}</span
                                >
                                <span class="product-price" style="margin-left:1.2rem;color:#059669;font-weight:600;">
                                    {(() => {
                                        const prices = product.variants.map((v) => v.salePrice);
                                        if (prices.length === 0) return "";
                                        const allSame = prices.every((p) => p === prices[0]);
                                        return allSame ? `$${prices[0]}` : "Varies";
                                    })()}
                                </span>
                            </div>
                            <span class="expand-btn-label"
                                >{($keepExpanded || $expanded[product.id]) && !$refreshAnim[product.id]
                                    ? "Hide Variants"
                                    : "Show Variants"}</span
                            >
                        </button>
                        <div style="display:flex;align-items:center;gap:0.7rem;margin-left:1.2rem;">
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Set all variant prices (USD)"
                                class="edit-input price"
                                bind:value={$bulkPrice[product.id]}
                                style="max-width:120px;"
                            />
                            <button
                                class="save-btn"
                                on:click={() => setAllVariantPrices(product)}
                                disabled={!$bulkPrice[product.id] || isNaN(Number($bulkPrice[product.id]))}
                                >Set All Prices</button
                            >
                            {#if $feedback[product.id]}
                                <span
                                    style="margin-left:0.5rem;color:{$feedback[product.id].type === 'success'
                                        ? '#059669'
                                        : 'red'}">{$feedback[product.id].message}</span
                                >
                            {/if}
                        </div>
                    </div>
                    {#if ($keepExpanded || $expanded[product.id]) && !$refreshAnim[product.id]}
                        <div class="variant-grid" id={`variants-${product.id}`}>
                            {#each (() => {
                                const s = $search.toLowerCase();
                                // If product matches, show all variants
                                const productMatch = product.skuBase?.toLowerCase().includes(s) || product.displayName
                                        ?.toLowerCase()
                                        .includes(s) || (categoryIdToName[product.categoryId]
                                        ?.toLowerCase()
                                        .includes(s) ?? false);
                                if (!$search || productMatch) {
                                    return product.variants;
                                }
                                // Otherwise, filter variants by search
                                return product.variants.filter((v) => v.sku
                                            ?.toLowerCase()
                                            .includes(s) || (v.color && v.color
                                                .toLowerCase()
                                                .includes(s)) || (v.size && v.size.toLowerCase().includes(s)));
                            })() as variant}
                                <div class="variant-card">
                                    <div class="variant-header">
                                        <span class="variant-sku" title={variant.sku}>{variant.sku ?? "No SKU"}</span>
                                        {#if variant.imgUrl}
                                            <img src={variant.imgUrl} alt="" class="variant-img" />
                                        {/if}
                                        <span
                                            class="variant-color"
                                            style="background:{variant.colorHex ?? '#eef'};color:{variant.colorHex
                                                ? '#fff'
                                                : 'var(--color-link-hover)'}"
                                        >
                                            {variant.displayColor ?? variant.color ?? "No Color"}
                                        </span>
                                        <span class="variant-size">{variant.size ?? "No Size"}</span>
                                    </div>
                                    <div class="variant-details">
                                        <span class="variant-price">${variant.salePrice}</span>
                                        <span class="variant-stock">
                                            Stock: {Array.isArray(variant.inventoryBatches)
                                                ? variant.inventoryBatches.reduce(
                                                      (sum, b) => sum + (b.quantity ?? 0),
                                                      0
                                                  )
                                                : 0}
                                        </span>
                                    </div>
                                    <div class="variant-edit">
                                        <input
                                            type="text"
                                            value={$edits[variant.id]?.displayColor ??
                                                variant.displayColor ??
                                                $edits[variant.id]?.color ??
                                                variant.color ??
                                                ""}
                                            on:input={(e) =>
                                                handleEdit(variant.id, "displayColor", e.currentTarget.value)}
                                            placeholder="Display Color"
                                            class="edit-input color"
                                        />
                                        <input
                                            type="text"
                                            value={$edits[variant.id]?.size ?? variant.size ?? ""}
                                            on:input={(e) => handleEdit(variant.id, "size", e.currentTarget.value)}
                                            placeholder="Size"
                                            class="edit-input size"
                                        />
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={$edits[variant.id]?.salePrice ?? variant.salePrice ?? ""}
                                            on:input={(e) => handleEdit(variant.id, "salePrice", e.currentTarget.value)}
                                            placeholder="Price (USD)"
                                            class="edit-input price"
                                        />
                                        <button
                                            class="save-btn"
                                            on:click={() => saveVariantEdit(variant.id)}
                                            disabled={!$edits[variant.id] ||
                                                (($edits[variant.id]?.color ?? variant.color) === variant.color &&
                                                    ($edits[variant.id]?.size ?? variant.size) === variant.size &&
                                                    ($edits[variant.id]?.salePrice ?? variant.salePrice) ==
                                                        variant.salePrice)}
                                        >
                                            Save
                                        </button>
                                        {#if $feedback[variant.id]}
                                            <span
                                                style="margin-left:0.7rem;color:{$feedback[variant.id].type ===
                                                'success'
                                                    ? '#059669'
                                                    : 'red'}"
                                            >
                                                {$feedback[variant.id].message}
                                            </span>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .expand-btn-label {
        background: var(--color-signup-bg);
        color: var(--color-signup);
        border: 2px solid var(--color-border);
        border-radius: 6px;
        padding: 0.3rem 1.1rem;
        font-size: 1rem;
        font-weight: 600;
        margin-left: 1rem;
        box-shadow: 0 1px 4px 0 var(--color-shadow);
        display: inline-block;
        vertical-align: middle;
        cursor: pointer;
        user-select: none;
    }
    .search-input {
        border: 1px solid var(--color-border);
        border-radius: 6px;
        padding: 0.5rem 1rem;
        font-size: 1rem;
        background: var(--color-bg);
        color: var(--color-link);
        margin-bottom: 1.2rem;
        box-sizing: border-box;
    }
    .product-list {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }
    .product-card {
        background: var(--color-user-badge-bg);
        border-radius: 14px;
        box-shadow: var(--color-shadow);
        padding: 1.3rem 1.7rem;
        border: 1px solid var(--color-border);
        transition:
            background 0.2s,
            box-shadow 0.2s;
    }
    .product-main {
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        margin-bottom: 0.7rem;
    }
    .product-info {
        display: flex;
        gap: 1.2rem;
        font-size: 1.08rem;
        font-weight: 500;
    }
    .sku-base {
        color: var(--color-link);
        font-size: 0.98em;
    }
    .product-name {
        font-weight: 600;
        color: var(--color-link-hover);
    }
    .product-category {
        background: var(--color-link-bg-hover);
        color: var(--color-link-hover);
        border-radius: 6px;
        padding: 0.2rem 0.7rem;
        font-size: 0.97em;
    }
    .variant-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 1.1rem;
        margin-top: 0.7rem;
    }
    .variant-card {
        background: var(--color-bg);
        border-radius: 10px;
        box-shadow: var(--color-shadow);
        padding: 1rem 1.1rem;
        display: flex;
        flex-direction: column;
        gap: 0.7rem;
        border: 1px solid var(--color-border);
        transition:
            box-shadow 0.2s,
            background 0.2s;
    }
    .variant-card:hover {
        box-shadow: 0 2px 8px 0 var(--color-signup-bg, rgba(99, 102, 241, 0.09));
        background: var(--color-link-bg-hover);
    }
    .variant-header {
        display: flex;
        gap: 0.7rem;
        align-items: center;
        font-size: 1.04rem;
        flex-wrap: wrap;
    }
    .variant-sku {
        font-weight: 500;
        color: var(--color-signup-bg);
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: inline-block;
        vertical-align: middle;
        cursor: pointer;
    }
    .variant-color {
        border-radius: 6px;
        padding: 0.15rem 0.7rem;
        font-size: 0.97em;
        min-width: 48px;
        max-width: 80px;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: inline-block;
        vertical-align: middle;
    }
    .variant-img {
        width: 32px;
        height: 32px;
        object-fit: cover;
        border-radius: 4px;
        margin-right: 0.5rem;
        border: 1px solid var(--color-border);
        background: var(--color-link-bg-hover);
    }
    .variant-size {
        background: #fef9c3;
        color: #92400e;
        border-radius: 6px;
        padding: 0.15rem 0.7rem;
        font-size: 0.97em;
        min-width: 48px;
        max-width: 80px;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: inline-block;
        vertical-align: middle;
    }
    @media (max-width: 500px) {
        .variant-sku {
            max-width: 70px;
        }
        .variant-color,
        .variant-size {
            max-width: 50px;
        }
    }
    .variant-details {
        display: flex;
        gap: 1.2rem;
        font-size: 1.07rem;
        font-weight: 500;
    }
    .variant-price {
        color: #059669;
    }
    .variant-stock {
        color: var(--color-user-badge);
    }
    .variant-edit {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        margin-top: 0.3rem;
        flex-wrap: wrap;
    }
    .edit-input {
        border: 1px solid var(--color-border);
        border-radius: 4px;
        padding: 0.2rem 0.5rem;
        font-size: 0.97em;
        background: var(--color-bg);
        color: var(--color-link);
        min-width: 70px;
    }
    .save-btn {
        background: var(--color-signup-bg);
        color: var(--color-signup);
        border: none;
        border-radius: 6px;
        padding: 0.3rem 1rem;
        font-size: 1rem;
        cursor: pointer;
        transition: background 0.2s;
    }
    .save-btn:disabled {
        background: #d1d5db;
        color: #888;
        cursor: not-allowed;
    }
    @media (max-width: 700px) {
        .variant-grid {
            grid-template-columns: 1fr;
        }
        .product-card {
            padding: 1rem 0.5rem;
        }
    }
</style>
