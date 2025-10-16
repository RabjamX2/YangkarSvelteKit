<script>
    // @ts-nocheck
    import { onMount } from "svelte";
    import { writable, derived } from "svelte/store";
    import AdminHeader from "$lib/components/AdminHeader.svelte";
    import { createAuthFetch } from "$lib/utils/csrf.js";
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
    const dateFrom = writable("");
    const dateTo = writable("");
    const orderTypeFilter = writable("");
    const reasonFilter = writable("");
    const userFilter = writable("");
    const selectedOrder = writable(null);
    const showOrderModal = writable(false);
    const loadingOrderDetails = writable(false);
    const orderDetailsError = writable("");

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
        [groupedStockChanges, variantSearch, dateFrom, dateTo, orderTypeFilter, reasonFilter, userFilter],
        ([$groupedStockChanges, $variantSearch, $dateFrom, $dateTo, $orderTypeFilter, $reasonFilter, $userFilter]) => {
            return $groupedStockChanges
                .map(({ day, changes }) => ({
                    day,
                    changes: changes.filter((change) => {
                        const variant = change.variant || {};
                        const changeDate = new Date(change.changeTime || change.date);

                        // Variant search filter
                        if ($variantSearch) {
                            const term = $variantSearch.toLowerCase();
                            const matchesVariant =
                                variant.product?.name?.toLowerCase().includes(term) ||
                                variant.sku?.toLowerCase().includes(term) ||
                                variant.color?.toLowerCase().includes(term) ||
                                (variant.size && variant.size.toLowerCase().includes(term));
                            if (!matchesVariant) return false;
                        }

                        // Date range filters
                        if ($dateFrom && changeDate < new Date($dateFrom)) return false;
                        if ($dateTo) {
                            const toDate = new Date($dateTo);
                            toDate.setHours(23, 59, 59, 999);
                            if (changeDate > toDate) return false;
                        }

                        // Order type filter
                        if ($orderTypeFilter && change.orderType !== $orderTypeFilter) return false;

                        // Reason filter
                        if ($reasonFilter && !change.reason?.toLowerCase().includes($reasonFilter.toLowerCase()))
                            return false;

                        // User filter
                        if ($userFilter && !change.user?.toLowerCase().includes($userFilter.toLowerCase()))
                            return false;

                        return true;
                    }),
                }))
                .filter((group) => group.changes.length > 0);
        }
    );

    // Summary statistics
    const summaryStats = derived([filteredGroupedStockChanges], ([$filteredGroupedStockChanges]) => {
        let totalChanges = 0;
        let totalAdded = 0;
        let totalRemoved = 0;
        let uniqueVariants = new Set();
        let uniqueUsers = new Set();

        for (const group of $filteredGroupedStockChanges) {
            for (const change of group.changes) {
                totalChanges++;
                if (change.change > 0) totalAdded += change.change;
                else totalRemoved += Math.abs(change.change);
                uniqueVariants.add(change.productVariantId);
                if (change.user) uniqueUsers.add(change.user);
            }
        }

        return {
            totalChanges,
            totalAdded,
            totalRemoved,
            netChange: totalAdded - totalRemoved,
            uniqueVariants: uniqueVariants.size,
            uniqueUsers: uniqueUsers.size,
        };
    });

    // Export to CSV function
    function exportToCSV() {
        let csvContent = "Date,Time,Product,SKU,Color,Size,Change,Stock After,Reason,User,Order Type,Order ID\n";

        for (const group of $filteredGroupedStockChanges) {
            for (const change of group.changes) {
                const date = new Date(change.changeTime || change.date);
                const variant = change.variant || {};
                const row = [
                    date.toLocaleDateString(),
                    date.toLocaleTimeString(),
                    variant.product?.name || "-",
                    variant.sku || "-",
                    variant.color || "-",
                    variant.size || "-",
                    change.change,
                    change.variant?.stock ?? "-",
                    change.reason || "-",
                    change.user || "-",
                    change.orderType || "-",
                    change.orderId || "-",
                ]
                    .map((field) => `"${String(field).replace(/"/g, '""')}"`)
                    .join(",");
                csvContent += row + "\n";
            }
        }

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `stock-changes-${new Date().toISOString().split("T")[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Get unique values for filter dropdowns
    const uniqueOrderTypes = derived([stockChanges], ([$stockChanges]) => {
        const types = new Set();
        for (const change of $stockChanges) {
            if (change.orderType) types.add(change.orderType);
        }
        return Array.from(types).sort();
    });

    const uniqueReasons = derived([stockChanges], ([$stockChanges]) => {
        const reasons = new Set();
        for (const change of $stockChanges) {
            if (change.reason) reasons.add(change.reason);
        }
        return Array.from(reasons).sort();
    });

    const uniqueUsers = derived([stockChanges], ([$stockChanges]) => {
        const users = new Set();
        for (const change of $stockChanges) {
            if (change.user) users.add(change.user);
        }
        return Array.from(users).sort();
    });

    // Fetch order details
    async function fetchOrderDetails(orderId, orderType) {
        loadingOrderDetails.set(true);
        orderDetailsError.set("");
        selectedOrder.set(null);

        try {
            let endpoint = "";
            if (orderType === "CUSTOMER") {
                endpoint = `${PUBLIC_BACKEND_URL}/api/customer-orders`;
            } else if (orderType === "PURCHASE") {
                endpoint = `${PUBLIC_BACKEND_URL}/api/purchase-orders`;
            } else {
                throw new Error("Invalid order type");
            }

            const res = await fetchAuth(endpoint);
            if (!res.ok) throw new Error("Failed to fetch order details");
            const data = await res.json();

            // Find the specific order
            const order = data.data.find((o) => o.id === orderId);
            if (!order) throw new Error("Order not found");

            selectedOrder.set({ ...order, orderType });
            showOrderModal.set(true);
        } catch (e) {
            orderDetailsError.set(e instanceof Error ? e.message : String(e));
            console.error("Error fetching order:", e);
        } finally {
            loadingOrderDetails.set(false);
        }
    }

    function closeOrderModal() {
        showOrderModal.set(false);
        selectedOrder.set(null);
        orderDetailsError.set("");
    }
</script>

<AdminHeader />
<div class="admin-container">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
        <h2 style="margin:0;">Stock Change Audit Log</h2>
        <button on:click={exportToCSV} style="background:#28a745;color:white;padding:0.5rem 1rem;">
            📥 Export to CSV
        </button>
    </div>

    <!-- Summary Statistics -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;margin-bottom:1.5rem;">
        <div style="background:var(--color-link-bg-hover);padding:1rem;border-radius:8px;text-align:center;">
            <div style="font-size:2rem;font-weight:bold;color:var(--color-link);">{$summaryStats.totalChanges}</div>
            <div style="color:var(--color-text-light);font-size:0.9rem;">Total Changes</div>
        </div>
        <div style="background:var(--status-received-bg);padding:1rem;border-radius:8px;text-align:center;">
            <div style="font-size:2rem;font-weight:bold;color:var(--status-received-color);">
                +{$summaryStats.totalAdded}
            </div>
            <div style="color:var(--status-received-color);font-size:0.9rem;">Stock Added</div>
        </div>
        <div style="background:var(--order-cancelled-bg);padding:1rem;border-radius:8px;text-align:center;">
            <div style="font-size:2rem;font-weight:bold;color:var(--order-cancelled-color);">
                -{$summaryStats.totalRemoved}
            </div>
            <div style="color:var(--order-cancelled-color);font-size:0.9rem;">Stock Removed</div>
        </div>
        <div
            style="background:{$summaryStats.netChange >= 0
                ? 'var(--status-received-bg)'
                : 'var(--order-cancelled-bg)'};padding:1rem;border-radius:8px;text-align:center;"
        >
            <div
                style="font-size:2rem;font-weight:bold;color:{$summaryStats.netChange >= 0
                    ? 'var(--status-received-color)'
                    : 'var(--order-cancelled-color)'};"
            >
                {$summaryStats.netChange >= 0 ? "+" : ""}{$summaryStats.netChange}
            </div>
            <div
                style="color:{$summaryStats.netChange >= 0
                    ? 'var(--status-received-color)'
                    : 'var(--order-cancelled-color)'};font-size:0.9rem;"
            >
                Net Change
            </div>
        </div>
        <div style="background:var(--color-link-bg-hover);padding:1rem;border-radius:8px;text-align:center;">
            <div style="font-size:2rem;font-weight:bold;color:var(--color-link);">{$summaryStats.uniqueVariants}</div>
            <div style="color:var(--color-text-light);font-size:0.9rem;">Variants Affected</div>
        </div>
        <div style="background:var(--color-link-bg-hover);padding:1rem;border-radius:8px;text-align:center;">
            <div style="font-size:2rem;font-weight:bold;color:var(--color-link);">{$summaryStats.uniqueUsers}</div>
            <div style="color:var(--color-text-light);font-size:0.9rem;">Users Involved</div>
        </div>
    </div>

    <!-- Manual Stock Change Form -->
    <div
        style="background:var(--color-link-bg-hover);padding:1.5rem;border-radius:8px;margin-bottom:1.5rem;border:2px solid var(--color-link);"
    >
        <h3 style="margin-top:0;color:var(--color-link);">📝 Record Manual Stock Change</h3>
        <form
            on:submit|preventDefault={submitManualStockChange}
            style="display:grid;grid-template-columns:2fr 1fr 2fr auto;gap:1rem;align-items:end;"
        >
            <div>
                <label for="variant" style="font-weight:600;">Variant:</label>
                <select id="variant" bind:value={$manualStockChange.variantId} required style="width:100%;">
                    <option value="">Select variant...</option>
                    {#each $filteredVariants as v}
                        <option value={v.id}
                            >{v.productName} | {v.sku} | {v.color}{v.size ? ` (${v.size})` : ""} | Stock: {v.stock}</option
                        >
                    {/each}
                </select>
            </div>
            <div>
                <label for="change" style="font-weight:600;">Change:</label>
                <input id="change" type="number" bind:value={$manualStockChange.change} required style="width:100%;" />
            </div>
            <div>
                <label for="reason" style="font-weight:600;">Reason:</label>
                <input id="reason" type="text" bind:value={$manualStockChange.reason} required style="width:100%;" />
            </div>
            <button type="submit" style="background:#007bff;color:white;padding:0.6rem 1.2rem;white-space:nowrap;">
                ✅ Record Change
            </button>
        </form>
        {#if $manualStockChangeError}
            <div
                style="color:var(--order-cancelled-color);background:var(--order-cancelled-bg);padding:0.5rem;border-radius:4px;margin-top:1rem;"
            >
                ⚠️ {$manualStockChangeError}
            </div>
        {/if}
    </div>

    <!-- Filters Section -->
    <div style="background:var(--color-bg);padding:1.5rem;border-radius:8px;margin-bottom:1.5rem;">
        <h3 style="margin-top:0;color:var(--color-link);">🔍 Filters</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;">
            <div>
                <label for="variantSearch" style="font-weight:600;display:block;margin-bottom:0.3rem;"
                    >Search Variant:</label
                >
                <input
                    id="variantSearch"
                    type="text"
                    bind:value={$variantSearch}
                    placeholder="Name, SKU, color, size..."
                    style="width:100%;"
                />
            </div>
            <div>
                <label for="dateFrom" style="font-weight:600;display:block;margin-bottom:0.3rem;">From Date:</label>
                <input id="dateFrom" type="date" bind:value={$dateFrom} style="width:100%;" />
            </div>
            <div>
                <label for="dateTo" style="font-weight:600;display:block;margin-bottom:0.3rem;">To Date:</label>
                <input id="dateTo" type="date" bind:value={$dateTo} style="width:100%;" />
            </div>
            <div>
                <label for="orderType" style="font-weight:600;display:block;margin-bottom:0.3rem;">Order Type:</label>
                <select id="orderType" bind:value={$orderTypeFilter} style="width:100%;">
                    <option value="">All Types</option>
                    {#each $uniqueOrderTypes as type}
                        <option value={type}>{type}</option>
                    {/each}
                </select>
            </div>
            <div>
                <label for="reason" style="font-weight:600;display:block;margin-bottom:0.3rem;">Reason:</label>
                <select id="reason" bind:value={$reasonFilter} style="width:100%;">
                    <option value="">All Reasons</option>
                    {#each $uniqueReasons as reason}
                        <option value={reason}>{reason}</option>
                    {/each}
                </select>
            </div>
            <div>
                <label for="user" style="font-weight:600;display:block;margin-bottom:0.3rem;">User:</label>
                <select id="user" bind:value={$userFilter} style="width:100%;">
                    <option value="">All Users</option>
                    {#each $uniqueUsers as user}
                        <option value={user}>{user}</option>
                    {/each}
                </select>
            </div>
        </div>
        {#if $variantSearch || $dateFrom || $dateTo || $orderTypeFilter || $reasonFilter || $userFilter}
            <button
                on:click={() => {
                    variantSearch.set("");
                    dateFrom.set("");
                    dateTo.set("");
                    orderTypeFilter.set("");
                    reasonFilter.set("");
                    userFilter.set("");
                }}
                style="margin-top:1rem;background:#6c757d;color:white;padding:0.5rem 1rem;"
            >
                🔄 Clear All Filters
            </button>
        {/if}
    </div>

    <!-- Stock Changes List -->
    {#if $loadingTransactions}
        <div style="text-align:center;padding:2rem;">
            <div style="font-size:2rem;">⏳</div>
            <div>Loading stock changes...</div>
        </div>
    {:else if $errorTransactions}
        <div
            style="background:var(--order-cancelled-bg);color:var(--order-cancelled-color);padding:1rem;border-radius:8px;"
        >
            ⚠️ Error: {$errorTransactions}
        </div>
    {:else if $filteredGroupedStockChanges.length === 0}
        <div style="text-align:center;padding:2rem;background:var(--color-link-bg-hover);border-radius:8px;">
            <div style="font-size:3rem;margin-bottom:1rem;">📭</div>
            <div style="font-size:1.2rem;color:var(--color-text-light);">
                No stock changes found matching your filters
            </div>
        </div>
    {:else}
        <div>
            {#each $filteredGroupedStockChanges as group}
                {@const dayStats = group.changes.reduce(
                    (acc, c) => {
                        acc.total++;
                        if (c.change > 0) acc.added += c.change;
                        else acc.removed += Math.abs(c.change);
                        return acc;
                    },
                    { total: 0, added: 0, removed: 0 }
                )}
                <div style="margin-bottom:1.5rem;">
                    <button
                        type="button"
                        style="width:100%;text-align:left;cursor:pointer;font-weight:bold;background:var(--color-link-bg-hover);color:var(--color-link);padding:1rem;border-radius:8px;border:2px solid var(--color-link);display:flex;justify-content:space-between;align-items:center;"
                        aria-expanded={$expandedDates[group.day] ? "true" : "false"}
                        on:click={() => expandedDates.update((e) => ({ ...e, [group.day]: !e[group.day] }))}
                    >
                        <div>
                            <span style="font-size:1.1rem;"
                                >📅 {new Date(group.day).toLocaleDateString("en-US", {
                                    weekday: "long",
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                })}</span
                            >
                            <span style="font-weight:normal;color:var(--color-text-light);margin-left:1rem;"
                                >({dayStats.total} change{dayStats.total > 1 ? "s" : ""})</span
                            >
                        </div>
                        <div style="display:flex;gap:1rem;align-items:center;">
                            <span
                                style="background:var(--status-received-bg);color:var(--status-received-color);padding:0.3rem 0.6rem;border-radius:4px;"
                                >+{dayStats.added}</span
                            >
                            <span
                                style="background:var(--order-cancelled-bg);color:var(--order-cancelled-color);padding:0.3rem 0.6rem;border-radius:4px;"
                                >-{dayStats.removed}</span
                            >
                            <span style="font-size:1.2rem;"
                                >{#if $expandedDates[group.day]}▼{:else}▶{/if}</span
                            >
                        </div>
                    </button>
                    {#if $expandedDates[group.day]}
                        <div style="margin-top:0.5rem;overflow-x:auto;">
                            <table class="admin-table">
                                <thead>
                                    <tr>
                                        <th>Time</th>
                                        <th>Product</th>
                                        <th>SKU</th>
                                        <th>Color</th>
                                        <th>Size</th>
                                        <th>Change</th>
                                        <th>Stock After</th>
                                        <th>Reason</th>
                                        <th>Order Type</th>
                                        <th>Order ID</th>
                                        <th>User</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each group.changes as change}
                                        {@const isPositive = change.change > 0}
                                        <tr
                                            style="background:{isPositive
                                                ? 'var(--status-received-bg)'
                                                : 'var(--order-cancelled-bg)'};"
                                        >
                                            <td style="white-space:nowrap;">
                                                {new Date(change.date || change.changeTime).toLocaleTimeString()}
                                            </td>
                                            <td style="font-weight:600;">{change.variant?.product?.name || "-"}</td>
                                            <td style="font-family:monospace;">{change.variant?.sku || "-"}</td>
                                            <td>{change.variant?.color || "-"}</td>
                                            <td>{change.variant?.size || "-"}</td>
                                            <td
                                                style="font-weight:bold;font-size:1.1rem;color:{isPositive
                                                    ? 'var(--status-received-color)'
                                                    : 'var(--order-cancelled-color)'};"
                                            >
                                                {isPositive ? "+" : ""}{change.change}
                                            </td>
                                            <td style="font-weight:600;">{change.variant?.stock ?? "-"}</td>
                                            <td>
                                                <span
                                                    style="background:var(--color-link-bg-hover);padding:0.2rem 0.5rem;border-radius:4px;font-size:0.9rem;"
                                                >
                                                    {change.reason || "-"}
                                                </span>
                                            </td>
                                            <td>
                                                {#if change.orderType}
                                                    <span
                                                        style="background:{change.orderType === 'CUSTOMER'
                                                            ? '#ffc107'
                                                            : change.orderType === 'PURCHASE'
                                                              ? '#17a2b8'
                                                              : '#6c757d'};color:white;padding:0.2rem 0.5rem;border-radius:4px;font-size:0.85rem;"
                                                    >
                                                        {change.orderType}
                                                    </span>
                                                {:else}
                                                    -
                                                {/if}
                                            </td>
                                            <td>
                                                {#if change.orderId}
                                                    <button
                                                        type="button"
                                                        on:click={() =>
                                                            fetchOrderDetails(change.orderId, change.orderType)}
                                                        style="background:none;border:none;color:var(--color-link);text-decoration:underline;cursor:pointer;padding:0;font:inherit;"
                                                    >
                                                        #{change.orderId}
                                                    </button>
                                                {:else}
                                                    -
                                                {/if}
                                            </td>
                                            <td style="font-weight:500;">{change.user || "-"}</td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}

    <!-- Order Details Modal -->
    {#if $showOrderModal}
        <div
            class="modal-overlay"
            on:click={closeOrderModal}
            on:keydown={(e) => e.key === "Escape" && closeOrderModal()}
            role="button"
            tabindex="0"
        >
            <div
                class="modal-content"
                on:click|stopPropagation
                on:keydown={(e) => e.key === "Escape" && closeOrderModal()}
                role="dialog"
                aria-modal="true"
                tabindex="-1"
            >
                <div class="modal-header">
                    <h3 style="margin:0;">
                        {$selectedOrder?.orderType === "CUSTOMER" ? "Customer Order" : "Purchase Order"} Details
                    </h3>
                    <button type="button" on:click={closeOrderModal} class="close-button" aria-label="Close modal">
                        ✕
                    </button>
                </div>

                {#if $loadingOrderDetails}
                    <div style="text-align:center;padding:2rem;">
                        <div style="font-size:2rem;">⏳</div>
                        <div>Loading order details...</div>
                    </div>
                {:else if $orderDetailsError}
                    <div
                        style="background:var(--order-cancelled-bg);color:var(--order-cancelled-color);padding:1rem;border-radius:8px;margin:1rem;"
                    >
                        ⚠️ Error: {$orderDetailsError}
                    </div>
                {:else if $selectedOrder}
                    <div class="modal-body">
                        <!-- Order Summary -->
                        <div class="info-section">
                            <h4>Order Information</h4>
                            <div class="info-grid">
                                <div class="info-item">
                                    <span class="info-label">Order ID:</span>
                                    <span class="info-value">#{$selectedOrder.id}</span>
                                </div>
                                {#if $selectedOrder.orderType === "CUSTOMER"}
                                    <div class="info-item">
                                        <span class="info-label">Customer:</span>
                                        <span class="info-value">{$selectedOrder.customerName || "Guest"}</span>
                                    </div>
                                    {#if $selectedOrder.customerPhone}
                                        <div class="info-item">
                                            <span class="info-label">Phone:</span>
                                            <span class="info-value">{$selectedOrder.customerPhone}</span>
                                        </div>
                                    {/if}
                                    <div class="info-item">
                                        <span class="info-label">Order Date:</span>
                                        <span class="info-value"
                                            >{new Date($selectedOrder.orderDate).toLocaleString()}</span
                                        >
                                    </div>
                                    {#if $selectedOrder.moneyHolder}
                                        <div class="info-item">
                                            <span class="info-label">Money Holder:</span>
                                            <span class="info-value">{$selectedOrder.moneyHolder}</span>
                                        </div>
                                    {/if}
                                    <div class="info-item">
                                        <span class="info-label">Payment Method:</span>
                                        <span class="info-value">{$selectedOrder.paymentMethod || "N/A"}</span>
                                    </div>
                                    <div class="info-item">
                                        <span class="info-label">Payment Status:</span>
                                        <span
                                            class="status-badge"
                                            style="background:{$selectedOrder.paymentStatus === 'PAID'
                                                ? 'var(--status-received-bg)'
                                                : 'var(--status-pending-bg)'};color:{$selectedOrder.paymentStatus ===
                                            'PAID'
                                                ? 'var(--status-received-color)'
                                                : 'var(--status-pending-color)'};">{$selectedOrder.paymentStatus}</span
                                        >
                                    </div>
                                    <div class="info-item">
                                        <span class="info-label">Fulfillment Status:</span>
                                        <span
                                            class="status-badge"
                                            style="background:{$selectedOrder.fulfillmentStatus === 'PICKED_UP' ||
                                            $selectedOrder.fulfillmentStatus === 'DELIVERED'
                                                ? 'var(--status-received-bg)'
                                                : $selectedOrder.fulfillmentStatus === 'CANCELLED'
                                                  ? 'var(--order-cancelled-bg)'
                                                  : 'var(--status-pending-bg)'};color:{$selectedOrder.fulfillmentStatus ===
                                                'PICKED_UP' || $selectedOrder.fulfillmentStatus === 'DELIVERED'
                                                ? 'var(--status-received-color)'
                                                : $selectedOrder.fulfillmentStatus === 'CANCELLED'
                                                  ? 'var(--order-cancelled-color)'
                                                  : 'var(--status-pending-color)'};"
                                            >{$selectedOrder.fulfillmentStatus}</span
                                        >
                                    </div>
                                    {#if $selectedOrder.total}
                                        <div class="info-item">
                                            <span class="info-label">Total:</span>
                                            <span class="info-value" style="font-weight:bold;font-size:1.1rem;"
                                                >${parseFloat($selectedOrder.total).toFixed(2)}</span
                                            >
                                        </div>
                                    {/if}
                                {:else if $selectedOrder.orderType === "PURCHASE"}
                                    <div class="info-item">
                                        <span class="info-label">Batch Number:</span>
                                        <span class="info-value">#{$selectedOrder.batchNumber}</span>
                                    </div>
                                    <div class="info-item">
                                        <span class="info-label">Has Arrived:</span>
                                        <span
                                            class="status-badge"
                                            style="background:{$selectedOrder.hasArrived
                                                ? 'var(--status-received-bg)'
                                                : 'var(--status-pending-bg)'};color:{$selectedOrder.hasArrived
                                                ? 'var(--status-received-color)'
                                                : 'var(--status-pending-color)'};"
                                            >{$selectedOrder.hasArrived ? "Yes" : "No"}</span
                                        >
                                    </div>
                                    {#if $selectedOrder.shipDate}
                                        <div class="info-item">
                                            <span class="info-label">Ship Date:</span>
                                            <span class="info-value"
                                                >{new Date($selectedOrder.shipDate).toLocaleDateString()}</span
                                            >
                                        </div>
                                    {/if}
                                    {#if $selectedOrder.arrivalDate}
                                        <div class="info-item">
                                            <span class="info-label">Arrival Date:</span>
                                            <span class="info-value"
                                                >{new Date($selectedOrder.arrivalDate).toLocaleDateString()}</span
                                            >
                                        </div>
                                    {/if}
                                    {#if $selectedOrder.totalPaidUsd}
                                        <div class="info-item">
                                            <span class="info-label">Total Paid (USD):</span>
                                            <span class="info-value" style="font-weight:bold;font-size:1.1rem;"
                                                >${parseFloat($selectedOrder.totalPaidUsd).toFixed(2)}</span
                                            >
                                        </div>
                                    {/if}
                                {/if}
                            </div>
                        </div>

                        <!-- Order Items -->
                        <div class="info-section">
                            <h4>Order Items</h4>
                            <div style="overflow-x:auto;">
                                <table class="modal-table">
                                    <thead>
                                        <tr>
                                            <th>Product</th>
                                            <th>SKU</th>
                                            <th>Color</th>
                                            <th>Size</th>
                                            <th>Quantity</th>
                                            {#if $selectedOrder.orderType === "CUSTOMER"}
                                                <th>Price</th>
                                                <th>Subtotal</th>
                                            {:else}
                                                <th>Cost/Item (USD)</th>
                                                <th>Total</th>
                                            {/if}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {#each $selectedOrder.items || [] as item}
                                            <tr>
                                                <td style="font-weight:600;">
                                                    {item.variant?.product?.name || item.productName || "N/A"}
                                                </td>
                                                <td style="font-family:monospace;">
                                                    {item.variant?.sku || item.productSku || "N/A"}
                                                </td>
                                                <td>{item.variant?.color || "N/A"}</td>
                                                <td>{item.variant?.size || "N/A"}</td>
                                                <td style="text-align:center;">
                                                    {item.quantity || item.quantityOrdered || 0}
                                                </td>
                                                {#if $selectedOrder.orderType === "CUSTOMER"}
                                                    <td style="text-align:right;">
                                                        ${parseFloat(item.salePrice || 0).toFixed(2)}
                                                    </td>
                                                    <td style="text-align:right;font-weight:600;">
                                                        ${(
                                                            parseFloat(item.salePrice || 0) * (item.quantity || 0)
                                                        ).toFixed(2)}
                                                    </td>
                                                {:else}
                                                    <td style="text-align:right;">
                                                        ${parseFloat(item.costPerItemUsd || 0).toFixed(2)}
                                                    </td>
                                                    <td style="text-align:right;font-weight:600;">
                                                        ${(
                                                            parseFloat(item.costPerItemUsd || 0) *
                                                            (item.quantityOrdered || 0)
                                                        ).toFixed(2)}
                                                    </td>
                                                {/if}
                                            </tr>
                                        {/each}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {#if $selectedOrder.notes}
                            <div class="info-section">
                                <h4>Notes</h4>
                                <p
                                    style="margin:0;padding:1rem;background:var(--color-link-bg-hover);border-radius:8px;"
                                >
                                    {$selectedOrder.notes}
                                </p>
                            </div>
                        {/if}
                    </div>

                    <div class="modal-footer">
                        <button type="button" on:click={closeOrderModal} class="btn-secondary"> Close </button>
                        <a
                            href="/admin/transactions/{$selectedOrder.orderType === 'CUSTOMER'
                                ? 'customer-orders'
                                : 'purchase-orders'}"
                            class="btn-primary"
                        >
                            View Full Order Page
                        </a>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .admin-table {
        width: 100%;
        border-collapse: collapse;
        background: var(--color-bg);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        overflow: hidden;
    }

    .admin-table th {
        background: var(--color-link);
        color: var(--color-bg);
        padding: 0.75rem;
        text-align: left;
        font-weight: 600;
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .admin-table td {
        padding: 0.75rem;
        border-bottom: 1px solid var(--color-border);
        color: var(--color-text);
    }

    .admin-table tbody tr:hover {
        background: var(--color-link-bg-hover) !important;
        cursor: pointer;
    }

    .admin-table tbody tr:last-child td {
        border-bottom: none;
    }

    button {
        font-family: inherit;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
    }

    button:hover {
        opacity: 0.9;
        transform: translateY(-1px);
    }

    button:active {
        transform: translateY(0);
    }

    input,
    select {
        padding: 0.5rem;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        font-family: inherit;
        font-size: 1rem;
        background: var(--color-bg);
        color: var(--color-text);
    }

    input:focus,
    select:focus {
        outline: none;
        border-color: var(--color-link);
        box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
    }

    label {
        color: var(--color-text);
    }

    /* Modal Styles */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
        overflow-y: auto;
        animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    .modal-content {
        background: var(--color-bg);
        border-radius: 12px;
        max-width: 900px;
        width: 100%;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease;
    }

    @keyframes slideUp {
        from {
            transform: translateY(20px);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.5rem;
        border-bottom: 2px solid var(--color-border);
        background: var(--color-link-bg-hover);
    }

    .modal-header h3 {
        color: var(--color-link);
        margin: 0;
        font-size: 1.5rem;
    }

    .close-button {
        background: none;
        border: none;
        font-size: 1.8rem;
        cursor: pointer;
        color: var(--color-text);
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: all 0.2s;
    }

    .close-button:hover {
        background: var(--color-danger);
        color: white;
        transform: none;
    }

    .modal-body {
        flex: 1;
        overflow-y: auto;
        padding: 1.5rem;
    }

    .info-section {
        margin-bottom: 2rem;
    }

    .info-section:last-child {
        margin-bottom: 0;
    }

    .info-section h4 {
        margin-top: 0;
        margin-bottom: 1rem;
        color: var(--color-link);
        font-size: 1.2rem;
        padding-bottom: 0.5rem;
        border-bottom: 2px solid var(--color-link-bg-hover);
    }

    .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
    }

    .info-item {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
    }

    .info-label {
        font-size: 0.85rem;
        color: var(--color-text-light);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .info-value {
        font-size: 1rem;
        color: var(--color-text);
        font-weight: 500;
    }

    .status-badge {
        display: inline-block;
        padding: 0.3rem 0.8rem;
        border-radius: 6px;
        font-size: 0.85rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .modal-table {
        width: 100%;
        border-collapse: collapse;
        background: var(--color-bg);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        overflow: hidden;
    }

    .modal-table th {
        background: var(--color-link);
        color: white;
        padding: 0.75rem;
        text-align: left;
        font-weight: 600;
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .modal-table td {
        padding: 0.75rem;
        border-bottom: 1px solid var(--color-border);
        color: var(--color-text);
    }

    .modal-table tbody tr:hover {
        background: var(--color-link-bg-hover);
    }

    .modal-table tbody tr:last-child td {
        border-bottom: none;
    }

    .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 1rem;
        padding: 1.5rem;
        border-top: 2px solid var(--color-border);
        background: var(--color-link-bg-hover);
    }

    .btn-secondary {
        background: #6c757d;
        color: white;
        padding: 0.6rem 1.2rem;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s;
    }

    .btn-secondary:hover {
        background: #5a6268;
        transform: translateY(-1px);
    }

    .btn-primary {
        background: var(--color-primary);
        color: white;
        padding: 0.6rem 1.2rem;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s;
        text-decoration: none;
        display: inline-block;
    }

    .btn-primary:hover {
        background: var(--color-primary-hover);
        transform: translateY(-1px);
    }

    /* Responsive adjustments */
    @media (max-width: 768px) {
        .modal-content {
            max-width: 95%;
            max-height: 95vh;
        }

        .info-grid {
            grid-template-columns: 1fr;
        }

        .modal-footer {
            flex-direction: column;
        }

        .modal-footer button,
        .modal-footer a {
            width: 100%;
        }
    }
</style>
