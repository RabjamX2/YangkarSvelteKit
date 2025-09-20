<script>
    // @ts-nocheck

    const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import AdminHeader from "$lib/components/AdminHeader.svelte";
    import "./productTable.css";

    <script>
        // @ts-nocheck

        const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;
        import { onMount } from "svelte";
        import { writable } from "svelte/store";
        import AdminHeader from "$lib/components/AdminHeader.svelte";
        import "./productTable.css";

        const products = writable([]);
        const expanded = writable({}); // { [productId]: true }
        const search = writable("");
        const loading = writable(true);
        const error = writable(null);
        const edits = writable({}); // { [id]: { field: value } }
        const categories = writable([]);
        const selectedCategory = writable("");
        const searchSkuBase = writable("");
        const searchName = writable("");

        // Store for bulk price edits per product
        const bulkPriceEdits = writable({}); // { [productId]: price }

        async function setAllVariantPrices(productId, price) {
            // Find product and its variants
            let $products;
            products.subscribe((v) => ($products = v))();
            const product = $products.find((p) => p.id === productId);
            if (!product || !product.variants || product.variants.length === 0) return;
            // Update all variants
            const promises = product.variants.map((variant) =>
                fetch(`${PUBLIC_BACKEND_URL}/api/variants/${variant.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ salePrice: price }),
                })
            );
            try {
                await Promise.all(promises);
                // Update local store
                products.update((list) =>
                    list.map((p) =>
                        p.id === productId
                            ? {
                                  ...p,
                                  variants: p.variants.map((v) => ({ ...v, salePrice: price })),
                              }
                            : p
                    )
                );
                bulkPriceEdits.update((edits) => {
                    const { [productId]: _, ...rest } = edits;
                    return rest;
                });
            } catch (e) {
                alert("Failed to update all variant prices");
            }
        }

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
            } catch (e) {
                alert(e instanceof Error ? e.message : String(e));
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
            } catch (e) {
                alert(e instanceof Error ? e.message : String(e));
            }
        }
    </script>
                        >
                    </button>
                    {#if $expanded[product.id]}
                        <div class="variant-grid" id={`variants-${product.id}`}>
                            {#each (() => {
                                const s = $search.toLowerCase();
                                // If product matches, show all variants
                                const productMatch = product.skuBase?.toLowerCase().includes(s) || product.displayName
                                        ?.toLowerCase()
                                        .includes(s) || (categoryIdToName[product.categoryID]
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
                                                        variant.salePrice)}>Save</button
                                        >
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
