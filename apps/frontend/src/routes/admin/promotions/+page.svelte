<script>
    // @ts-nocheck
    import { onMount } from "svelte";
    import { writable, get } from "svelte/store";
    import AdminHeader from "$lib/components/AdminHeader.svelte";
    import AutoComplete from "$lib/components/AutoComplete.svelte";
    import { apiFetch } from "$lib/utils/api.js";
    import { auth } from "$lib/stores/auth.store.js";
    import "./promotions.css";

    export let data;

    // ── Stores ────────────────────────────────────────────────────────
    const promotions = writable([]);
    const allVariants = writable([]); // flat list for variant autocomplete
    const allProducts = writable([]); // list for product autocomplete
    const loading = writable(true);
    const error = writable(null);
    const feedback = writable({}); // { [key]: { type, message } }
    const expanded = writable({}); // { [promoId]: bool }
    const editing = writable({}); // { [promoId]: { name, description, startDate, endDate, isActive } }
    const addItemForms = writable({}); // { [promoId]: { variantId, promotionPrice, resetKey } }
    const addProductForms = writable({}); // { [promoId]: { product, resetKey } }
    const addMode = writable({}); // { [promoId]: "variant" | "product" }
    const promoStats = writable({}); // { [promoId]: { loading, data, error } }

    const newPromoForm = writable({
        show: false,
        name: "",
        description: "",
        startDate: "",
        endDate: "",
        isActive: true,
        discountType: "",
        discountValue: "",
    });

    // ── CSRF ──────────────────────────────────────────────────────────
    $: if (data?.csrfToken && $auth.csrfToken !== data.csrfToken) {
        auth.setCsrfToken(data.csrfToken);
    }

    // ── Helpers ───────────────────────────────────────────────────────
    function showFeedback(key, type, message, timeout = 2500) {
        feedback.update((f) => ({ ...f, [key]: { type, message } }));
        setTimeout(() => {
            feedback.update((f) => {
                const { [key]: _, ...rest } = f;
                return rest;
            });
        }, timeout);
    }

    function toDateInput(dateStr) {
        if (!dateStr) return "";
        return new Date(dateStr).toISOString().split("T")[0];
    }

    function formatDate(dateStr) {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }

    function getStatus(promo) {
        const now = new Date();
        const start = new Date(promo.startDate);
        const end = new Date(promo.endDate);
        if (!promo.isActive) return { label: "Inactive", cls: "status-inactive" };
        if (now < start) return { label: "Scheduled", cls: "status-scheduled" };
        if (now > end) return { label: "Expired", cls: "status-expired" };
        return { label: "Active", cls: "status-active" };
    }

    // Returns variants not already in this promotion's items
    function availableVariants(promoItems) {
        const existingIds = new Set((promoItems || []).map((i) => i.productVariantId));
        return $allVariants.filter((v) => !existingIds.has(v.id));
    }

    // Auto-calculate promo price from salePrice + promotion's default discount
    function calcPromoPrice(salePrice, discountType, discountValue) {
        const price = parseFloat(salePrice);
        const val = parseFloat(discountValue);
        if (!discountType || isNaN(price) || isNaN(val) || val <= 0) return "";
        if (discountType === "PERCENTAGE") return (price * (1 - val / 100)).toFixed(2);
        if (discountType === "FLAT") return Math.max(0, price - val).toFixed(2);
        return "";
    }

    function discountLabel(discountType, discountValue) {
        if (!discountType || discountValue == null) return "";
        if (discountType === "PERCENTAGE") return `${Number(discountValue)}% off`;
        return `$${Number(discountValue).toFixed(2)} off`;
    }

    // Called when a variant is selected in the add-item autocomplete.
    // Reads fresh promo data from the store to avoid stale closure issues.
    function onVariantSelect(promoId, item) {
        const currentPromo = get(promotions).find((p) => p.id === promoId);
        const autoPrice = currentPromo
            ? calcPromoPrice(item.salePrice, currentPromo.discountType, currentPromo.discountValue)
            : "";
        addItemForms.update((f) => ({
            ...f,
            [promoId]: {
                ...(f[promoId] || {}),
                variantId: item.id,
                selectedVariant: item,
                promotionPrice: autoPrice !== "" ? autoPrice : (f[promoId]?.promotionPrice ?? ""),
                isAutoPrice: autoPrice !== "",
            },
        }));
    }

    // ── Data loading ──────────────────────────────────────────────────
    onMount(async () => {
        loading.set(true);
        try {
            const [promoRes, varRes] = await Promise.all([
                apiFetch("/api/promotions"),
                apiFetch("/api/products-with-variants?all=true"),
            ]);

            if (!promoRes.ok) throw new Error("Failed to fetch promotions");
            promotions.set(await promoRes.json());

            if (varRes.ok) {
                const varData = await varRes.json();
                const flat = [];
                const products = [];
                for (const product of varData.data || []) {
                    const productName = product.displayName || product.skuBase || "";
                    const productVariants = (product.variants || []).map((variant) => ({
                        id: variant.id,
                        sku: variant.sku || "",
                        displayColor: variant.displayColor || "",
                        size: variant.size || "",
                        salePrice: variant.salePrice,
                        productName,
                        productId: product.id,
                    }));
                    for (const v of productVariants) flat.push(v);
                    products.push({
                        id: product.id,
                        displayName: productName,
                        skuBase: product.skuBase || "",
                        variants: productVariants,
                    });
                }
                allVariants.set(flat);
                allProducts.set(products);
            }
        } catch (e) {
            error.set(e instanceof Error ? e.message : String(e));
        } finally {
            loading.set(false);
        }
    });

    // ── Promotion CRUD ────────────────────────────────────────────────
    async function createPromotion() {
        const form = $newPromoForm;
        if (!form.name || !form.startDate || !form.endDate) {
            showFeedback("new", "error", "Name, start date, and end date are required");
            return;
        }
        try {
            const res = await apiFetch("/api/promotions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name,
                    description: form.description || null,
                    startDate: form.startDate,
                    endDate: form.endDate,
                    isActive: form.isActive,
                    discountType: form.discountType || null,
                    discountValue: form.discountValue ? parseFloat(form.discountValue) : null,
                }),
            });
            if (!res.ok) throw new Error("Failed to create promotion");
            const created = await res.json();
            promotions.update((list) => [created, ...list]);
            newPromoForm.set({
                show: false,
                name: "",
                description: "",
                startDate: "",
                endDate: "",
                isActive: true,
                discountType: "",
                discountValue: "",
            });
            showFeedback("new", "success", "Promotion created!");
        } catch (e) {
            showFeedback("new", "error", e.message);
        }
    }

    function startEditing(promo) {
        editing.update((ed) => ({
            ...ed,
            [promo.id]: {
                name: promo.name,
                description: promo.description || "",
                startDate: toDateInput(promo.startDate),
                endDate: toDateInput(promo.endDate),
                isActive: promo.isActive,
                discountType: promo.discountType || "",
                discountValue: promo.discountValue != null ? String(promo.discountValue) : "",
            },
        }));
        expanded.update((e) => ({ ...e, [promo.id]: true }));
        fetchStats(promo.id);
    }

    function cancelEditing(id) {
        editing.update((ed) => {
            const { [id]: _, ...rest } = ed;
            return rest;
        });
    }

    async function savePromotion(id) {
        const edit = $editing[id];
        if (!edit) return;
        if (!edit.name || !edit.startDate || !edit.endDate) {
            showFeedback(id, "error", "Name, start date, and end date are required");
            return;
        }
        try {
            const res = await apiFetch(`/api/promotions/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: edit.name,
                    description: edit.description || null,
                    startDate: edit.startDate,
                    endDate: edit.endDate,
                    isActive: edit.isActive,
                    discountType: edit.discountType || null,
                    discountValue: edit.discountValue ? parseFloat(edit.discountValue) : null,
                }),
            });
            if (!res.ok) throw new Error("Failed to update promotion");
            const updated = await res.json();
            promotions.update((list) => list.map((p) => (p.id === id ? { ...p, ...updated } : p)));
            cancelEditing(id);
            showFeedback(id, "success", "Saved!");
        } catch (e) {
            showFeedback(id, "error", e.message);
        }
    }

    async function deletePromotion(id, name) {
        if (!confirm(`Delete promotion "${name}"? This will remove all its items.`)) return;
        try {
            const res = await apiFetch(`/api/promotions/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete promotion");
            promotions.update((list) => list.filter((p) => p.id !== id));
        } catch (e) {
            showFeedback(id, "error", e.message);
        }
    }

    // ── Item management ───────────────────────────────────────────────
    function setAddItemField(promoId, field, value) {
        addItemForms.update((f) => ({
            ...f,
            [promoId]: {
                ...(f[promoId] || {}),
                [field]: value,
                // Clear auto-price flag when user manually edits the price
                ...(field === "promotionPrice" ? { isAutoPrice: false } : {}),
            },
        }));
    }

    // Toggle a promo card open/closed — fetches stats lazily on first open
    function toggleExpand(promoId) {
        expanded.update((e) => {
            const nowOpen = !e[promoId];
            if (nowOpen) fetchStats(promoId);
            return { ...e, [promoId]: nowOpen };
        });
    }

    async function fetchStats(promoId) {
        // Don't re-fetch if already loaded or loading
        const current = get(promoStats)[promoId];
        if (current?.data || current?.loading) return;
        promoStats.update((s) => ({ ...s, [promoId]: { loading: true, data: null, error: null } }));
        try {
            const res = await apiFetch(`/api/promotions/${promoId}/stats`);
            if (!res.ok) throw new Error("Failed to load stats");
            const json = await res.json();
            promoStats.update((s) => ({ ...s, [promoId]: { loading: false, data: json, error: null } }));
        } catch (err) {
            promoStats.update((s) => ({ ...s, [promoId]: { loading: false, data: null, error: err.message } }));
        }
    }

    // Returns variants of a product that aren't already in the promotion
    function availableProductVariants(promoItems, productVariants) {
        const existingIds = new Set((promoItems || []).map((i) => i.productVariantId));
        return (productVariants || []).filter((v) => !existingIds.has(v.id));
    }

    // Add all available variants of a product to the promotion at once
    async function addProductToPromotion(promoId) {
        const form = $addProductForms[promoId] || {};
        if (!form.product) {
            showFeedback(`items-${promoId}`, "error", "Select a product first");
            return;
        }
        const currentPromo = get(promotions).find((p) => p.id === promoId);
        const toAdd = availableProductVariants(currentPromo?.items, form.product.variants);
        if (toAdd.length === 0) {
            showFeedback(`items-${promoId}`, "error", "All variants of this product are already in the promotion");
            return;
        }

        const results = await Promise.allSettled(
            toAdd.map((variant) => {
                const price = calcPromoPrice(
                    variant.salePrice,
                    currentPromo?.discountType,
                    currentPromo?.discountValue,
                );
                if (!price && variant.salePrice == null)
                    return Promise.reject(new Error(`${variant.displayColor} ${variant.size} has no price — skipped`));
                const finalPrice = price !== "" ? price : parseFloat(variant.salePrice);
                if (isNaN(finalPrice))
                    return Promise.reject(new Error(`${variant.displayColor} ${variant.size} has no price — skipped`));
                return apiFetch(`/api/promotions/${promoId}/items`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        productVariantId: variant.id,
                        promotionPrice: parseFloat(finalPrice),
                    }),
                }).then(async (res) => {
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.error || "Failed");
                    }
                    return res.json();
                });
            }),
        );

        const added = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
        const failed = results.filter((r) => r.status === "rejected");

        if (added.length > 0) {
            promotions.update((list) =>
                list.map((p) => (p.id !== promoId ? p : { ...p, items: [...p.items, ...added] })),
            );
        }

        if (failed.length > 0) {
            showFeedback(
                `items-${promoId}`,
                "error",
                `Added ${added.length} variant${added.length !== 1 ? "s" : ""}; ${failed.length} skipped (no price).`,
            );
        } else {
            showFeedback(
                `items-${promoId}`,
                "success",
                `Added ${added.length} variant${added.length !== 1 ? "s" : ""} from "${form.product.displayName}"`,
            );
        }

        // Reset
        addProductForms.update((f) => ({
            ...f,
            [promoId]: { product: null, resetKey: (f[promoId]?.resetKey ?? 0) + 1 },
        }));
    }

    async function addItemToPromotion(promoId) {
        const form = $addItemForms[promoId] || {};
        if (!form.variantId) {
            showFeedback(`items-${promoId}`, "error", "Select a product variant first");
            return;
        }
        if (!form.promotionPrice || isNaN(parseFloat(form.promotionPrice))) {
            showFeedback(`items-${promoId}`, "error", "Enter a valid promotion price");
            return;
        }
        try {
            const res = await apiFetch(`/api/promotions/${promoId}/items`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productVariantId: form.variantId,
                    promotionPrice: parseFloat(form.promotionPrice),
                }),
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Failed to add item");
            }
            const item = await res.json();
            promotions.update((list) => list.map((p) => (p.id !== promoId ? p : { ...p, items: [...p.items, item] })));
            // Reset the form by incrementing resetKey (forces AutoComplete remount)
            addItemForms.update((f) => ({
                ...f,
                [promoId]: {
                    variantId: null,
                    selectedVariant: null,
                    promotionPrice: "",
                    isAutoPrice: false,
                    resetKey: (f[promoId]?.resetKey ?? 0) + 1,
                },
            }));
        } catch (e) {
            showFeedback(`items-${promoId}`, "error", e.message);
        }
    }

    async function updateItemPrice(promoId, itemId, newPrice) {
        if (!newPrice || isNaN(parseFloat(newPrice))) return;
        try {
            const res = await apiFetch(`/api/promotions/${promoId}/items/${itemId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ promotionPrice: parseFloat(newPrice) }),
            });
            if (!res.ok) throw new Error("Failed to update price");
            const updated = await res.json();
            promotions.update((list) =>
                list.map((p) =>
                    p.id !== promoId ? p : { ...p, items: p.items.map((i) => (i.id === itemId ? updated : i)) },
                ),
            );
            showFeedback(`items-${promoId}`, "success", "Price updated");
        } catch (e) {
            showFeedback(`items-${promoId}`, "error", e.message);
        }
    }

    async function removeItem(promoId, itemId) {
        try {
            const res = await apiFetch(`/api/promotions/${promoId}/items/${itemId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to remove item");
            promotions.update((list) =>
                list.map((p) => (p.id !== promoId ? p : { ...p, items: p.items.filter((i) => i.id !== itemId) })),
            );
        } catch (e) {
            showFeedback(`items-${promoId}`, "error", e.message);
        }
    }

    // ── Update edit field helper ──────────────────────────────────────
    function setEditField(id, field, value) {
        editing.update((ed) => ({
            ...ed,
            [id]: { ...ed[id], [field]: value },
        }));
    }
</script>

<AdminHeader />

<div class="promo-page">
    <!-- Page header -->
    <div class="page-header">
        <h1>Promotions</h1>
        <button class="btn btn-primary" on:click={() => newPromoForm.update((f) => ({ ...f, show: !f.show }))}>
            {$newPromoForm.show ? "Cancel" : "+ New Promotion"}
        </button>
    </div>

    <!-- New promotion form -->
    {#if $newPromoForm.show}
        <div class="create-card">
            <h2>New Promotion</h2>

            {#if $feedback["new"]}
                <div class="feedback {$feedback['new'].type}">{$feedback["new"].message}</div>
            {/if}

            <div class="form-grid three-col">
                <div class="form-field">
                    <label for="new-name">Name *</label>
                    <input
                        id="new-name"
                        type="text"
                        placeholder="e.g. Losar Special"
                        value={$newPromoForm.name}
                        on:input={(e) => newPromoForm.update((f) => ({ ...f, name: e.target.value }))}
                    />
                </div>
                <div class="form-field">
                    <label for="new-start">Start Date *</label>
                    <input
                        id="new-start"
                        type="date"
                        value={$newPromoForm.startDate}
                        on:input={(e) => newPromoForm.update((f) => ({ ...f, startDate: e.target.value }))}
                    />
                </div>
                <div class="form-field">
                    <label for="new-end">End Date *</label>
                    <input
                        id="new-end"
                        type="date"
                        value={$newPromoForm.endDate}
                        on:input={(e) => newPromoForm.update((f) => ({ ...f, endDate: e.target.value }))}
                    />
                </div>
                <div class="form-field span-2">
                    <label for="new-desc">Description</label>
                    <textarea
                        id="new-desc"
                        placeholder="Optional description..."
                        value={$newPromoForm.description}
                        on:input={(e) => newPromoForm.update((f) => ({ ...f, description: e.target.value }))}
                    ></textarea>
                </div>
                <div class="form-field">
                    <span class="form-label-text">Active</span>
                    <div class="toggle-row">
                        <input
                            type="checkbox"
                            id="new-active"
                            checked={$newPromoForm.isActive}
                            on:change={(e) => newPromoForm.update((f) => ({ ...f, isActive: e.target.checked }))}
                        />
                        <label for="new-active" style="margin:0; color: var(--color-text);">Promotion is active</label>
                    </div>
                </div>
                <div class="form-field span-2">
                    <label for="new-discount-type">Default Discount</label>
                    <div class="discount-row">
                        <select
                            id="new-discount-type"
                            on:change={(e) =>
                                newPromoForm.update((f) => ({ ...f, discountType: e.target.value, discountValue: "" }))}
                        >
                            <option value="" selected={$newPromoForm.discountType === ""}>No default discount</option>
                            <option value="PERCENTAGE" selected={$newPromoForm.discountType === "PERCENTAGE"}
                                >Percentage off (%)</option
                            >
                            <option value="FLAT" selected={$newPromoForm.discountType === "FLAT"}
                                >Flat amount off ($)</option
                            >
                        </select>
                        {#if $newPromoForm.discountType}
                            <div class="discount-value-wrap">
                                <input
                                    id="new-discount-value"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    aria-label={$newPromoForm.discountType === "PERCENTAGE"
                                        ? "Percentage off value"
                                        : "Flat amount off value"}
                                    placeholder={$newPromoForm.discountType === "PERCENTAGE" ? "e.g. 20" : "e.g. 5.00"}
                                    value={$newPromoForm.discountValue}
                                    on:input={(e) =>
                                        newPromoForm.update((f) => ({ ...f, discountValue: e.target.value }))}
                                />
                                <span class="discount-unit">
                                    {$newPromoForm.discountType === "PERCENTAGE" ? "%" : "$"}
                                </span>
                            </div>
                        {/if}
                    </div>
                </div>
            </div>

            <div class="form-actions">
                <button class="btn btn-secondary" on:click={() => newPromoForm.update((f) => ({ ...f, show: false }))}>
                    Cancel
                </button>
                <button class="btn btn-primary" on:click={createPromotion}>Create Promotion</button>
            </div>
        </div>
    {/if}

    <!-- Loading / error states -->
    {#if $loading}
        <div class="loading-state">Loading promotions…</div>
    {:else if $error}
        <div class="error-state">Error: {$error}</div>
    {:else}
        <!-- Promotions list -->
        <div class="promo-list">
            {#each $promotions as promo (promo.id)}
                {@const status = getStatus(promo)}
                <div class="promo-card">
                    <!-- Card header (click to expand) -->
                    <div
                        class="promo-header"
                        role="button"
                        tabindex="0"
                        on:click={() => toggleExpand(promo.id)}
                        on:keydown={(e) => e.key === "Enter" && toggleExpand(promo.id)}
                    >
                        <span class="chevron">{$expanded[promo.id] ? "▼" : "▶"}</span>
                        <span class="promo-name">{promo.name}</span>
                        <span class="promo-dates">
                            {formatDate(promo.startDate)} → {formatDate(promo.endDate)}
                        </span>
                        <span class="status-badge {status.cls}">{status.label}</span>
                        {#if promo.discountType && promo.discountValue != null}
                            <span class="discount-default-badge">
                                {discountLabel(promo.discountType, promo.discountValue)}
                            </span>
                        {/if}
                        <span class="item-count">{promo.items.length} item{promo.items.length !== 1 ? "s" : ""}</span>
                        <!-- Stop propagation so clicks on buttons don't toggle expand -->
                        <!-- svelte-ignore a11y-click-events-have-key-events -->
                        <div class="header-actions" role="presentation" on:click|stopPropagation>
                            <button class="btn btn-secondary btn-sm" on:click={() => startEditing(promo)}>Edit</button>
                            <button class="btn btn-danger btn-sm" on:click={() => deletePromotion(promo.id, promo.name)}
                                >Delete</button
                            >
                        </div>
                    </div>

                    <!-- Expanded body -->
                    {#if $expanded[promo.id]}
                        <div class="promo-body">
                            <!-- Promotion-level feedback -->
                            {#if $feedback[promo.id]}
                                <div class="feedback {$feedback[promo.id].type}">{$feedback[promo.id].message}</div>
                            {/if}

                            <!-- Default discount info (shown when not editing) -->
                            {#if !$editing[promo.id] && promo.discountType && promo.discountValue != null}
                                <div class="discount-info-row">
                                    <span class="discount-info-label">Default discount:</span>
                                    <span class="discount-info-value">
                                        {promo.discountType === "PERCENTAGE"
                                            ? `${Number(promo.discountValue)}% off — promo price auto-fills when adding variants`
                                            : `$${Number(promo.discountValue).toFixed(2)} off — promo price auto-fills when adding variants`}
                                    </span>
                                </div>
                            {/if}

                            <!-- Sales statistics -->
                            <div class="promo-stats-section">
                                {#if $promoStats[promo.id]?.loading}
                                    <span class="stats-loading">Loading statistics…</span>
                                {:else if $promoStats[promo.id]?.data}
                                    {@const stats = $promoStats[promo.id].data}
                                    {#if stats.totalUnitsSold === 0}
                                        <span class="stats-empty">No orders recorded for this promotion yet.</span>
                                    {:else}
                                        <div class="stats-strip">
                                            <div class="stat-box">
                                                <span class="stat-value">{stats.totalUnitsSold}</span>
                                                <span class="stat-label"
                                                    >unit{stats.totalUnitsSold !== 1 ? "s" : ""} sold</span
                                                >
                                            </div>
                                            <div class="stat-box">
                                                <span class="stat-value">{stats.uniqueOrders}</span>
                                                <span class="stat-label"
                                                    >order{stats.uniqueOrders !== 1 ? "s" : ""}</span
                                                >
                                            </div>
                                            <div class="stat-box">
                                                <span class="stat-value">${Number(stats.totalRevenue).toFixed(2)}</span>
                                                <span class="stat-label">revenue</span>
                                            </div>
                                        </div>
                                        {#if stats.byVariant.length > 1}
                                            <details class="stats-breakdown">
                                                <summary>Breakdown by variant</summary>
                                                <table class="stats-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Color</th>
                                                            <th>Size</th>
                                                            <th>SKU</th>
                                                            <th>Units</th>
                                                            <th>Revenue</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {#each stats.byVariant as v}
                                                            <tr>
                                                                <td>{v.displayColor || "—"}</td>
                                                                <td>{v.size || "—"}</td>
                                                                <td
                                                                    style="font-family: var(--font-mono); font-size: var(--font-size-xs);"
                                                                    >{v.sku || "—"}</td
                                                                >
                                                                <td>{v.unitsSold}</td>
                                                                <td>${Number(v.revenue).toFixed(2)}</td>
                                                            </tr>
                                                        {/each}
                                                    </tbody>
                                                </table>
                                            </details>
                                        {/if}
                                    {/if}
                                {/if}
                            </div>

                            <!-- Edit section -->
                            {#if $editing[promo.id]}
                                <div class="edit-section">
                                    <p class="section-title">Edit Promotion</p>
                                    <div class="form-grid three-col">
                                        <div class="form-field">
                                            <label for="edit-name-{promo.id}">Name *</label>
                                            <input
                                                id="edit-name-{promo.id}"
                                                type="text"
                                                value={$editing[promo.id].name}
                                                on:input={(e) => setEditField(promo.id, "name", e.target.value)}
                                            />
                                        </div>
                                        <div class="form-field">
                                            <label for="edit-start-{promo.id}">Start Date *</label>
                                            <input
                                                id="edit-start-{promo.id}"
                                                type="date"
                                                value={$editing[promo.id].startDate}
                                                on:input={(e) => setEditField(promo.id, "startDate", e.target.value)}
                                            />
                                        </div>
                                        <div class="form-field">
                                            <label for="edit-end-{promo.id}">End Date *</label>
                                            <input
                                                id="edit-end-{promo.id}"
                                                type="date"
                                                value={$editing[promo.id].endDate}
                                                on:input={(e) => setEditField(promo.id, "endDate", e.target.value)}
                                            />
                                        </div>
                                        <div class="form-field span-2">
                                            <label for="edit-desc-{promo.id}">Description</label>
                                            <textarea
                                                id="edit-desc-{promo.id}"
                                                value={$editing[promo.id].description}
                                                on:input={(e) => setEditField(promo.id, "description", e.target.value)}
                                            ></textarea>
                                        </div>
                                        <div class="form-field">
                                            <span class="form-label-text">Active</span>
                                            <div class="toggle-row">
                                                <input
                                                    type="checkbox"
                                                    id="edit-active-{promo.id}"
                                                    checked={$editing[promo.id].isActive}
                                                    on:change={(e) =>
                                                        setEditField(promo.id, "isActive", e.target.checked)}
                                                />
                                                <label
                                                    for="edit-active-{promo.id}"
                                                    style="margin:0; color: var(--color-text);"
                                                >
                                                    Promotion is active
                                                </label>
                                            </div>
                                        </div>
                                        <div class="form-field span-2">
                                            <label for="edit-discount-type-{promo.id}">Default Discount</label>
                                            <div class="discount-row">
                                                <select
                                                    id="edit-discount-type-{promo.id}"
                                                    on:change={(e) => {
                                                        setEditField(promo.id, "discountType", e.target.value);
                                                        setEditField(promo.id, "discountValue", "");
                                                    }}
                                                >
                                                    <option value="" selected={$editing[promo.id].discountType === ""}
                                                        >No default discount</option
                                                    >
                                                    <option
                                                        value="PERCENTAGE"
                                                        selected={$editing[promo.id].discountType === "PERCENTAGE"}
                                                        >Percentage off (%)</option
                                                    >
                                                    <option
                                                        value="FLAT"
                                                        selected={$editing[promo.id].discountType === "FLAT"}
                                                        >Flat amount off ($)</option
                                                    >
                                                </select>
                                                {#if $editing[promo.id].discountType}
                                                    <div class="discount-value-wrap">
                                                        <input
                                                            id="edit-discount-value-{promo.id}"
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            aria-label={$editing[promo.id].discountType === "PERCENTAGE"
                                                                ? "Percentage off value"
                                                                : "Flat amount off value"}
                                                            placeholder={$editing[promo.id].discountType ===
                                                            "PERCENTAGE"
                                                                ? "e.g. 20"
                                                                : "e.g. 5.00"}
                                                            value={$editing[promo.id].discountValue}
                                                            on:input={(e) =>
                                                                setEditField(promo.id, "discountValue", e.target.value)}
                                                        />
                                                        <span class="discount-unit">
                                                            {$editing[promo.id].discountType === "PERCENTAGE"
                                                                ? "%"
                                                                : "$"}
                                                        </span>
                                                    </div>
                                                {/if}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="form-actions">
                                        <button
                                            class="btn btn-secondary btn-sm"
                                            on:click={() => cancelEditing(promo.id)}
                                        >
                                            Cancel
                                        </button>
                                        <button class="btn btn-primary btn-sm" on:click={() => savePromotion(promo.id)}>
                                            Save Changes
                                        </button>
                                    </div>
                                </div>
                            {/if}

                            <!-- Items table -->
                            <p class="section-title">Included Variants</p>

                            {#if promo.items.length === 0}
                                <div class="empty-items">No variants added yet. Use the form below to add items.</div>
                            {:else}
                                <table class="items-table">
                                    <thead>
                                        <tr>
                                            <th>Product</th>
                                            <th>Color / Size</th>
                                            <th>SKU</th>
                                            <th>Regular Price</th>
                                            <th>Promo Price</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {#each promo.items as item (item.id)}
                                            <tr>
                                                <td>{item.variant?.product?.displayName ?? "—"}</td>
                                                <td>
                                                    {item.variant?.displayColor ?? ""}
                                                    {item.variant?.size ? `/ ${item.variant.size}` : ""}
                                                </td>
                                                <td
                                                    style="font-family: var(--font-mono); font-size: var(--font-size-xs);"
                                                >
                                                    {item.variant?.sku ?? "—"}
                                                </td>
                                                <td>
                                                    {item.variant?.salePrice != null
                                                        ? `$${Number(item.variant.salePrice).toFixed(2)}`
                                                        : "—"}
                                                </td>
                                                <td>
                                                    <input
                                                        class="price-input"
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={Number(item.promotionPrice).toFixed(2)}
                                                        on:change={(e) =>
                                                            updateItemPrice(promo.id, item.id, e.target.value)}
                                                    />
                                                </td>
                                                <td>
                                                    <button
                                                        class="btn-ghost"
                                                        title="Remove from promotion"
                                                        on:click={() => removeItem(promo.id, item.id)}>✕</button
                                                    >
                                                </td>
                                            </tr>
                                        {/each}
                                    </tbody>
                                </table>
                            {/if}

                            <!-- Add variant section -->
                            <div class="add-item-section">
                                <!-- Mode tabs -->
                                <div class="add-mode-tabs">
                                    <button
                                        class="add-tab {($addMode[promo.id] ?? 'product') === 'product'
                                            ? 'active'
                                            : ''}"
                                        on:click={() => addMode.update((m) => ({ ...m, [promo.id]: "product" }))}
                                        >All variants of a product</button
                                    >
                                    <button
                                        class="add-tab {($addMode[promo.id] ?? 'product') === 'variant'
                                            ? 'active'
                                            : ''}"
                                        on:click={() => addMode.update((m) => ({ ...m, [promo.id]: "variant" }))}
                                        >Single variant</button
                                    >
                                </div>

                                {#if $feedback[`items-${promo.id}`]}
                                    <div class="feedback {$feedback[`items-${promo.id}`].type}">
                                        {$feedback[`items-${promo.id}`].message}
                                    </div>
                                {/if}

                                <!-- Product mode -->
                                {#if ($addMode[promo.id] ?? "product") === "product"}
                                    <div class="add-item-row">
                                        {#key $addProductForms[promo.id]?.resetKey ?? 0}
                                            <AutoComplete
                                                items={$allProducts}
                                                itemLabel={(p) => p.displayName + (p.skuBase ? ` (${p.skuBase})` : "")}
                                                itemValue={(p) => p.displayName}
                                                placeholder="Search product…"
                                                minLength={1}
                                                on:select={(e) =>
                                                    addProductForms.update((f) => ({
                                                        ...f,
                                                        [promo.id]: { ...(f[promo.id] || {}), product: e.detail.item },
                                                    }))}
                                            />
                                        {/key}
                                        <button
                                            class="btn btn-primary btn-sm"
                                            on:click={() => addProductToPromotion(promo.id)}>+ Add all variants</button
                                        >
                                    </div>
                                    {#if $addProductForms[promo.id]?.product}
                                        {@const preview = availableProductVariants(
                                            promo.items,
                                            $addProductForms[promo.id].product.variants,
                                        )}
                                        {#if preview.length > 0}
                                            <div class="product-preview">
                                                <span class="product-preview-label"
                                                    >{preview.length} variant{preview.length !== 1 ? "s" : ""} will be added:</span
                                                >
                                                <div class="product-preview-chips">
                                                    {#each preview as v}
                                                        <span class="variant-chip">
                                                            {v.displayColor}{v.size ? ` / ${v.size}` : ""}
                                                            {#if v.salePrice != null}
                                                                <span class="chip-price">
                                                                    {#if promo.discountType && promo.discountValue != null && calcPromoPrice(v.salePrice, promo.discountType, promo.discountValue) !== ""}
                                                                        <s>${Number(v.salePrice).toFixed(2)}</s>
                                                                        → ${calcPromoPrice(
                                                                            v.salePrice,
                                                                            promo.discountType,
                                                                            promo.discountValue,
                                                                        )}
                                                                    {:else}
                                                                        ${Number(v.salePrice).toFixed(2)}
                                                                    {/if}
                                                                </span>
                                                            {:else}
                                                                <span class="chip-price chip-no-price">no price</span>
                                                            {/if}
                                                        </span>
                                                    {/each}
                                                </div>
                                            </div>
                                        {:else}
                                            <p class="product-preview-all-added">
                                                All variants of this product are already in the promotion.
                                            </p>
                                        {/if}
                                    {/if}

                                    <!-- Single variant mode -->
                                {:else}
                                    <div class="add-item-row">
                                        {#key $addItemForms[promo.id]?.resetKey ?? 0}
                                            <AutoComplete
                                                items={availableVariants(promo.items)}
                                                itemLabel={(v) =>
                                                    `${v.productName} – ${v.displayColor}${v.size ? " / " + v.size : ""} (${v.sku || "#" + v.id})`}
                                                itemValue={(v) =>
                                                    `${v.productName} – ${v.displayColor}${v.size ? " / " + v.size : ""}`}
                                                placeholder="Search product variant…"
                                                minLength={2}
                                                on:select={(e) => onVariantSelect(promo.id, e.detail.item)}
                                            />
                                        {/key}

                                        <div class="price-input-group">
                                            {#if $addItemForms[promo.id]?.selectedVariant?.salePrice != null}
                                                <span class="regular-price-hint"
                                                    >Regular: ${Number(
                                                        $addItemForms[promo.id].selectedVariant.salePrice,
                                                    ).toFixed(2)}</span
                                                >
                                            {/if}
                                            <input
                                                class="add-price-input"
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                placeholder="Promo price"
                                                value={$addItemForms[promo.id]?.promotionPrice ?? ""}
                                                on:input={(e) =>
                                                    setAddItemField(promo.id, "promotionPrice", e.target.value)}
                                            />
                                            {#if $addItemForms[promo.id]?.isAutoPrice}
                                                <span class="auto-price-badge"
                                                    >✓ Auto-calculated from {discountLabel(
                                                        promo.discountType,
                                                        promo.discountValue,
                                                    )}</span
                                                >
                                            {/if}
                                        </div>

                                        <button
                                            class="btn btn-primary btn-sm"
                                            on:click={() => addItemToPromotion(promo.id)}
                                        >
                                            + Add
                                        </button>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/if}
                </div>
            {/each}

            {#if $promotions.length === 0 && !$loading}
                <div class="empty-state">No promotions yet. Create one above.</div>
            {/if}
        </div>
    {/if}
</div>
