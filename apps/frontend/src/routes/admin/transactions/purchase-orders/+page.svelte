<script>
    // @ts-nocheck
    import { onMount } from "svelte";
    import { writable, derived, get } from "svelte/store";
    import { page } from "$app/stores";
    import { slide, fade } from "svelte/transition";
    import AdminHeader from "$lib/components/AdminHeader.svelte";
    import { apiFetch } from "$lib/utils/api.js";
    import { auth } from "$lib/stores/auth.store.js";
    import "./purchaseOrders.css";
    import "./orderSummary.css";
    import "../transactionTable.css";
    import { browser } from "$app/environment";

    // REQUIRED: Receive data prop from layout
    export let data;

    // REQUIRED: Set CSRF token in auth store
    $: if (data?.csrfToken) {
        if ($auth.csrfToken !== data.csrfToken) {
            auth.setCsrfToken(data.csrfToken);
        }
    }

    const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;

    // Core data stores
    const purchaseOrders = writable([]);
    const expandedOrderId = writable(null);
    const editingItem = writable(null);
    const editForm = writable({});
    const loadingTransactions = writable(false);
    const errorTransactions = writable(null);
    const receivingOrderId = writable(null);

    // Pagination and filtering stores
    const itemsPerPage = writable(10);
    const currentPage = writable(1);
    const searchTerm = writable("");
    const statusFilter = writable("all"); // all, pending, received
    const sortField = writable("batchNumber");
    const sortDirection = writable("asc");

    // Filter and sort orders
    $: filteredAndSortedOrders = derived(
        [purchaseOrders, searchTerm, statusFilter, sortField, sortDirection],
        ([$purchaseOrders, $searchTerm, $statusFilter, $sortField, $sortDirection]) => {
            // Normalize search term
            const normalizedSearchTerm = ($searchTerm || "").toLowerCase().trim();

            // Filter by search term and status
            let filtered = $purchaseOrders.filter((order) => {
                // Status filter check
                const matchesStatus =
                    $statusFilter === "all" ||
                    ($statusFilter === "pending" && !order.hasArrived) ||
                    ($statusFilter === "received" && order.hasArrived);

                // If status doesn't match, skip this order
                if (!matchesStatus) return false;

                // If no search term, include all orders that match status
                if (normalizedSearchTerm === "") return true;

                // Search in batch number
                const batchNumber = String(order.batchNumber || "").toLowerCase();
                if (batchNumber.includes(normalizedSearchTerm)) return true;

                // Search in order notes
                const notes = String(order.notes || "").toLowerCase();
                if (notes.includes(normalizedSearchTerm)) return true;

                // Search in order items
                const matchesInItems = order.items?.some((item) => {
                    // Search in SKU
                    const sku = String(item.variant?.sku || "").toLowerCase();
                    if (sku.includes(normalizedSearchTerm)) return true;

                    // Search in product name
                    const productName = String(item.variant?.product?.name || "").toLowerCase();
                    if (productName.includes(normalizedSearchTerm)) return true;

                    // Search in product display name
                    const displayName = String(item.variant?.product?.displayName || "").toLowerCase();
                    if (displayName.includes(normalizedSearchTerm)) return true;

                    // Search in color
                    const color = String(item.variant?.color || "").toLowerCase();
                    if (color.includes(normalizedSearchTerm)) return true;

                    // Search in size
                    const size = String(item.variant?.size || "").toLowerCase();
                    if (size.includes(normalizedSearchTerm)) return true;

                    return false;
                });

                return matchesInItems;
            });

            // Sort by selected field and direction
            filtered.sort((a, b) => {
                let valueA, valueB;

                switch ($sortField) {
                    case "batchNumber":
                        valueA = String(a.batchNumber || "").toLowerCase();
                        valueB = String(b.batchNumber || "").toLowerCase();
                        break;
                    case "shipDate":
                        valueA = a.shipDate ? new Date(a.shipDate).getTime() : 0;
                        valueB = b.shipDate ? new Date(b.shipDate).getTime() : 0;
                        break;
                    case "arrivalDate":
                        valueA = a.arrivalDate ? new Date(a.arrivalDate).getTime() : 0;
                        valueB = b.arrivalDate ? new Date(b.arrivalDate).getTime() : 0;
                        break;
                    case "totalItems":
                        valueA = (a.items || []).reduce((sum, item) => sum + (item.quantityOrdered || 0), 0);
                        valueB = (b.items || []).reduce((sum, item) => sum + (item.quantityOrdered || 0), 0);
                        break;
                    case "totalCost":
                        valueA = (a.items || []).reduce(
                            (sum, item) => sum + (item.quantityOrdered || 0) * parseFloat(item.costPerItemUsd || 0),
                            0
                        );
                        valueB = (b.items || []).reduce(
                            (sum, item) => sum + (item.quantityOrdered || 0) * parseFloat(item.costPerItemUsd || 0),
                            0
                        );
                        break;
                    default:
                        valueA = String(a.batchNumber || "").toLowerCase();
                        valueB = String(b.batchNumber || "").toLowerCase();
                }

                // Handle comparison with null safety
                let comparison = 0;
                if (typeof valueA === "string" && typeof valueB === "string") {
                    comparison = valueA.localeCompare(valueB);
                } else {
                    comparison = (valueA || 0) - (valueB || 0);
                }

                return $sortDirection === "asc" ? comparison : -comparison;
            });

            return filtered;
        }
    );

    // Paginate orders
    $: paginatedOrders = derived(
        [filteredAndSortedOrders, currentPage, itemsPerPage],
        ([$filteredAndSortedOrders, $currentPage, $itemsPerPage]) => {
            const startIdx = ($currentPage - 1) * $itemsPerPage;
            const endIdx = startIdx + $itemsPerPage;
            return $filteredAndSortedOrders.slice(startIdx, endIdx);
        }
    );

    // Total pages calculation
    $: totalPages = derived([filteredAndSortedOrders, itemsPerPage], ([$filteredAndSortedOrders, $itemsPerPage]) => {
        return Math.ceil($filteredAndSortedOrders.length / $itemsPerPage);
    });

    // Functions
    function toggleSort(field) {
        sortField.update((currentField) => {
            if (currentField === field) {
                sortDirection.update((dir) => (dir === "asc" ? "desc" : "asc"));
                return field;
            } else {
                sortDirection.set("asc");
                return field;
            }
        });
    }

    function toggleOrderExpansion(orderId) {
        expandedOrderId.update((current) => (current === orderId ? null : orderId));
    }

    function editItem(item) {
        editingItem.set(item.id);
        editForm.set({
            color: item.variant?.color || "",
            size: item.variant?.size || "",
            quantity: item.quantityOrdered,
            cost: item.costPerItemUsd,
        });
    }

    function cancelEdit() {
        editingItem.set(null);
        editForm.set({});
    }

    async function saveItemChanges(itemId) {
        const $editForm = get(editForm);
        try {
            // Update color if changed
            if ($editForm.color !== undefined) {
                await apiFetch(`/api/purchase-order-items/${itemId}/color`, {
                    method: "POST",
                    body: JSON.stringify({ color: $editForm.color }),
                });
            }

            // Update size if changed
            if ($editForm.size !== undefined) {
                await apiFetch(`/api/purchase-order-items/${itemId}/size`, {
                    method: "POST",
                    body: JSON.stringify({ size: $editForm.size }),
                });
            }

            // Update quantity if changed
            if ($editForm.quantity !== undefined) {
                await apiFetch(`/api/purchase-order-items/${itemId}/quantity`, {
                    method: "POST",
                    body: JSON.stringify({ quantityOrdered: Number($editForm.quantity) }),
                });
            }

            // Update cost if changed
            if ($editForm.cost !== undefined) {
                await apiFetch(`/api/purchase-order-items/${itemId}/cost`, {
                    method: "POST",
                    body: JSON.stringify({ costPerItemUsd: parseFloat($editForm.cost) }),
                });
            }

            // Update local store
            purchaseOrders.update((orders) => {
                return orders.map((order) => {
                    const updatedItems = order.items.map((item) => {
                        if (item.id === itemId) {
                            return {
                                ...item,
                                quantityOrdered: Number($editForm.quantity) || item.quantityOrdered,
                                costPerItemUsd: parseFloat($editForm.cost) || item.costPerItemUsd,
                                variant: {
                                    ...item.variant,
                                    color: $editForm.color || item.variant?.color,
                                    size: $editForm.size || item.variant?.size,
                                },
                            };
                        }
                        return item;
                    });
                    return { ...order, items: updatedItems };
                });
            });

            // Reset editing state
            editingItem.set(null);
            editForm.set({});
        } catch (error) {
            console.error("Error updating item:", error);
            alert(`Error: ${error.message || "Failed to update item"}`);
        }
    }

    // Function to mark an entire purchase order as received
    async function markAsReceived(orderId) {
        if (
            !confirm(
                "Are you sure you want to mark this entire order as received? This will add all items to inventory."
            )
        ) {
            return;
        }

        receivingOrderId.set(orderId);
        try {
            const response = await apiFetch(`/api/receive-purchase-order/${orderId}`, {
                method: "POST",
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to receive purchase order");
            }

            // After marking as received, refresh purchase orders
            await refreshPurchaseOrders();
        } catch (error) {
            console.error("Error receiving purchase order:", error);
            alert(`Error: ${error.message}`);
        } finally {
            receivingOrderId.set(null);
        }
    }

    // Helper to refresh purchase orders
    async function refreshPurchaseOrders() {
        loadingTransactions.set(true);
        errorTransactions.set(null);
        try {
            console.log("Fetching purchase orders from:", `${PUBLIC_BACKEND_URL}/api/purchase-orders`);

            const response = await apiFetch(`/api/purchase-orders`);

            console.log("Purchase orders response status:", response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Purchase orders error response:", errorText);
                throw new Error(`Failed to fetch purchase orders: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log("Purchase orders data:", result);

            purchaseOrders.set(result.data || []);
        } catch (err) {
            console.error("Error fetching purchase orders:", err);
            errorTransactions.set(err.message || "Failed to fetch purchase orders");
        } finally {
            loadingTransactions.set(false);
        }
    }

    // Initialize data when component mounts
    onMount(async () => {
        await refreshPurchaseOrders();
    });
</script>

<AdminHeader />

<div class="transaction-container">
    <h1>Purchase Orders</h1>

    <!-- Search and Filter Controls -->
    <div class="controls-container">
        <div class="search-filters">
            <div class="search-box">
                <input type="text" placeholder="Search by batch number, SKU or name..." bind:value={$searchTerm} />
            </div>

            <div class="filter-group">
                <label for="status-filter">Status:</label>
                <select id="status-filter" bind:value={$statusFilter}>
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="received">Received</option>
                </select>
            </div>

            <div class="filter-group">
                <label for="items-per-page">Show:</label>
                <select id="items-per-page" bind:value={$itemsPerPage}>
                    <option value={10}>10 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                </select>
            </div>
        </div>

        <button class="refresh-btn" on:click={refreshPurchaseOrders}>
            <span class="icon">↻</span> Refresh
        </button>
    </div>

    {#if $loadingTransactions}
        <div class="loading-container">
            <div class="spinner large"></div>
            <p>Loading purchase orders...</p>
        </div>
    {:else if $errorTransactions}
        <div class="error-container">
            <p class="error">{$errorTransactions}</p>
            <button class="retry-btn" on:click={refreshPurchaseOrders}>Try Again</button>
        </div>
    {:else if $filteredAndSortedOrders.length === 0}
        <div class="empty-container">
            <p>No purchase orders found.</p>
            {#if $searchTerm || $statusFilter !== "all"}
                <p class="hint">Try adjusting your filters.</p>
                <button
                    class="clear-filters-btn"
                    on:click={() => {
                        searchTerm.set("");
                        statusFilter.set("all");
                    }}>Clear Filters</button
                >
            {/if}
        </div>
    {:else}
        <!-- Orders Table -->
        <div class="table-container">
            <table class="transaction-table">
                <thead>
                    <tr>
                        <th></th>
                        <th class="sortable" on:click={() => toggleSort("batchNumber")}>
                            Batch Number
                            {#if $sortField === "batchNumber"}
                                <span class="sort-indicator">{$sortDirection === "asc" ? "↑" : "↓"}</span>
                            {/if}
                        </th>
                        <th class="sortable" on:click={() => toggleSort("shipDate")}>
                            Ship Date
                            {#if $sortField === "shipDate"}
                                <span class="sort-indicator">{$sortDirection === "asc" ? "↑" : "↓"}</span>
                            {/if}
                        </th>
                        <th class="sortable" on:click={() => toggleSort("arrivalDate")}>
                            Arrival Date
                            {#if $sortField === "arrivalDate"}
                                <span class="sort-indicator">{$sortDirection === "asc" ? "↑" : "↓"}</span>
                            {/if}
                        </th>
                        <th class="sortable" on:click={() => toggleSort("totalItems")}>
                            Total Items
                            {#if $sortField === "totalItems"}
                                <span class="sort-indicator">{$sortDirection === "asc" ? "↑" : "↓"}</span>
                            {/if}
                        </th>
                        <th class="sortable" on:click={() => toggleSort("totalCost")}>
                            Items Cost (USD)
                            {#if $sortField === "totalCost"}
                                <span class="sort-indicator">{$sortDirection === "asc" ? "↑" : "↓"}</span>
                            {/if}
                        </th>
                        <th>Extra Fees</th>
                        <th>Total Paid</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#each $paginatedOrders as order (order.id)}
                        <tr
                            class="main-row"
                            class:expanded={$expandedOrderId === order.id}
                            on:click={() => toggleOrderExpansion(order.id)}
                        >
                            <td>
                                <button class="expand-btn" aria-label="Toggle details">
                                    {$expandedOrderId === order.id ? "▼" : "►"}
                                </button>
                            </td>
                            <td>{order.batchNumber}</td>
                            <td>{order.shipDate ? new Date(order.shipDate).toLocaleDateString() : "—"}</td>
                            <td>{order.arrivalDate ? new Date(order.arrivalDate).toLocaleDateString() : "—"}</td>
                            <td>{order.items.reduce((sum, item) => sum + item.quantityOrdered, 0)}</td>
                            <td
                                >${order.items
                                    .reduce(
                                        (sum, item) =>
                                            sum + item.quantityOrdered * parseFloat(item.costPerItemUsd || 0),
                                        0
                                    )
                                    .toFixed(2)}</td
                            >
                            <td>${order.extraFeesUsd ? parseFloat(order.extraFeesUsd).toFixed(2) : "0.00"}</td>
                            <td>${order.totalPaidUsd ? parseFloat(order.totalPaidUsd).toFixed(2) : "—"}</td>
                            <td>
                                <span
                                    class="status"
                                    class:status-pending={!order.hasArrived}
                                    class:status-received={order.hasArrived}
                                >
                                    {order.hasArrived ? "Received" : "Pending"}
                                </span>
                            </td>
                            <td>
                                {#if order.hasArrived}
                                    <span class="action-placeholder">✓ Received</span>
                                {:else}
                                    <button
                                        class="receive-btn"
                                        on:click|stopPropagation={() => markAsReceived(order.id)}
                                        disabled={$receivingOrderId === order.id}
                                    >
                                        {#if $receivingOrderId === order.id}
                                            <span class="spinner"></span> Processing...
                                        {:else}
                                            Mark as Received
                                        {/if}
                                    </button>
                                {/if}
                            </td>
                        </tr>

                        {#if $expandedOrderId === order.id}
                            <tr class="details-row" transition:slide|local={{ duration: 300 }}>
                                <td colspan="10">
                                    <div class="item-details-container">
                                        <div class="order-summary">
                                            <div class="summary-grid">
                                                <div class="summary-section">
                                                    <div class="summary-item">
                                                        <span class="label">Items Cost:</span>
                                                        <span class="value"
                                                            >${order.items
                                                                .reduce(
                                                                    (sum, item) =>
                                                                        sum +
                                                                        item.quantityOrdered *
                                                                            parseFloat(item.costPerItemUsd),
                                                                    0
                                                                )
                                                                .toFixed(2)}</span
                                                        >
                                                    </div>
                                                    <div class="summary-item">
                                                        <span class="label">Shipping Cost:</span>
                                                        <span class="value"
                                                            >${order.shippingCostUsd
                                                                ? parseFloat(order.shippingCostUsd)
                                                                : "0.00"}</span
                                                        >
                                                    </div>

                                                    <div class="summary-item">
                                                        <span class="label">Extra Fees:</span>
                                                        <span class="value"
                                                            >${order.extraFeesUsd
                                                                ? parseFloat(order.extraFeesUsd)
                                                                : "0.00"}</span
                                                        >
                                                    </div>
                                                    <div class="summary-item">
                                                        <span class="label">Total:</span>
                                                        <span class="value"
                                                            >${(
                                                                order.items.reduce(
                                                                    (sum, item) =>
                                                                        sum +
                                                                        item.quantityOrdered *
                                                                            parseFloat(item.costPerItemUsd || 0),
                                                                    0
                                                                ) +
                                                                (order.shippingCostUsd
                                                                    ? parseFloat(order.shippingCostUsd)
                                                                    : 0) +
                                                                (order.extraFeesUsd
                                                                    ? parseFloat(order.extraFeesUsd)
                                                                    : 0)
                                                            ).toFixed(2)}</span
                                                        >
                                                    </div>
                                                </div>

                                                <div class="summary-section">
                                                    <div class="summary-item">
                                                        <span>-</span>
                                                        <span>-</span>
                                                    </div>
                                                    <div class="summary-item">
                                                        <span class="label">CNY per USD Rate:</span>
                                                        <span class="value"
                                                            >{order.usdToCnyRate
                                                                ? parseFloat(order.usdToCnyRate).toFixed(2)
                                                                : "—"}</span
                                                        >
                                                    </div>
                                                    <div class="summary-item">
                                                        <span class="label">Rounding Errors:</span>
                                                        <span class="value"
                                                            >${order.totalPaidUsd
                                                                ? (
                                                                      order.items.reduce(
                                                                          (sum, item) =>
                                                                              sum +
                                                                              item.quantityOrdered *
                                                                                  parseFloat(item.costPerItemUsd || 0),
                                                                          0
                                                                      ) +
                                                                      (order.shippingCostUsd
                                                                          ? parseFloat(order.shippingCostUsd)
                                                                          : 0) +
                                                                      (order.extraFeesUsd
                                                                          ? parseFloat(order.extraFeesUsd)
                                                                          : 0) -
                                                                      parseFloat(order.totalPaidUsd)
                                                                  ).toFixed(2)
                                                                : "—"}</span
                                                        >
                                                    </div>
                                                    <div class="summary-item">
                                                        <span class="label">Total Paid:</span>
                                                        <span class="value"
                                                            >${order.totalPaidUsd
                                                                ? parseFloat(order.totalPaidUsd).toFixed(2)
                                                                : "—"}</span
                                                        >
                                                    </div>
                                                </div>
                                                <div class="summary-notes">
                                                    <span class="label">Notes: </span>
                                                    <span class="value notes">{order.notes || "No notes"}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <table class="nested-table">
                                            <thead>
                                                <tr>
                                                    <th>SKU</th>
                                                    <th>Name</th>
                                                    <th>Color</th>
                                                    <th>Size</th>
                                                    <th>Quantity</th>
                                                    <th>Cost/Item</th>
                                                    <th>Total</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {#each order.items as item (item.id)}
                                                    <tr class:editing={$editingItem === item.id}>
                                                        <td>{item.variant?.sku || "—"}</td>
                                                        <td>{item.variant?.product?.name || "—"}</td>

                                                        {#if $editingItem === item.id}
                                                            <td>
                                                                <input type="text" bind:value={$editForm.color} />
                                                            </td>
                                                            <td>
                                                                <input type="text" bind:value={$editForm.size} />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    bind:value={$editForm.quantity}
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    min="0.01"
                                                                    step="0.01"
                                                                    bind:value={$editForm.cost}
                                                                />
                                                            </td>
                                                            <td>
                                                                ${(
                                                                    $editForm.quantity * parseFloat($editForm.cost)
                                                                ).toFixed(2)}
                                                            </td>
                                                            <td>
                                                                <div class="action-buttons">
                                                                    <button
                                                                        class="save-btn"
                                                                        on:click|stopPropagation={() =>
                                                                            saveItemChanges(item.id)}
                                                                    >
                                                                        Save
                                                                    </button>
                                                                    <button
                                                                        class="cancel-btn"
                                                                        on:click|stopPropagation={cancelEdit}
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        {:else}
                                                            <td>{item.variant?.color || "—"}</td>
                                                            <td>{item.variant?.size || "—"}</td>
                                                            <td>{item.quantityOrdered}</td>
                                                            <td>${parseFloat(item.costPerItemUsd).toFixed(2)}</td>
                                                            <td
                                                                >${(
                                                                    item.quantityOrdered *
                                                                    parseFloat(item.costPerItemUsd)
                                                                ).toFixed(2)}</td
                                                            >
                                                            <td>
                                                                <button
                                                                    class="edit-btn"
                                                                    on:click|stopPropagation={() => editItem(item)}
                                                                >
                                                                    Edit
                                                                </button>
                                                            </td>
                                                        {/if}
                                                    </tr>
                                                {/each}
                                            </tbody>
                                            <tfoot>
                                                <tr>
                                                    <td colspan="4" class="text-right"><strong>Totals:</strong></td>
                                                    <td
                                                        ><strong
                                                            >{order.items.reduce(
                                                                (sum, item) => sum + item.quantityOrdered,
                                                                0
                                                            )}</strong
                                                        ></td
                                                    >
                                                    <td></td>
                                                    <td
                                                        ><strong
                                                            >${order.items
                                                                .reduce(
                                                                    (sum, item) =>
                                                                        sum +
                                                                        item.quantityOrdered *
                                                                            parseFloat(item.costPerItemUsd || 0),
                                                                    0
                                                                )
                                                                .toFixed(2)}</strong
                                                        ></td
                                                    >
                                                    <td></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </td>
                            </tr>
                        {/if}
                    {/each}
                </tbody>
            </table>
        </div>

        <!-- Pagination Controls -->
        {#if $totalPages > 1}
            <div class="pagination">
                <button class="pagination-btn" disabled={$currentPage === 1} on:click={() => currentPage.set(1)}>
                    «
                </button>
                <button
                    class="pagination-btn"
                    disabled={$currentPage === 1}
                    on:click={() => currentPage.update((p) => p - 1)}
                >
                    ‹
                </button>

                <span class="page-info">
                    Page {$currentPage} of {$totalPages}
                </span>

                <button
                    class="pagination-btn"
                    disabled={$currentPage === $totalPages}
                    on:click={() => currentPage.update((p) => p + 1)}
                >
                    ›
                </button>
                <button
                    class="pagination-btn"
                    disabled={$currentPage === $totalPages}
                    on:click={() => currentPage.set($totalPages)}
                >
                    »
                </button>
            </div>
        {/if}

        <div class="results-summary">
            Showing {($currentPage - 1) * $itemsPerPage + 1} - {Math.min(
                $currentPage * $itemsPerPage,
                $filteredAndSortedOrders.length
            )}
            of {$filteredAndSortedOrders.length} orders
            {#if $filteredAndSortedOrders.length !== $purchaseOrders.length}
                (filtered from {$purchaseOrders.length} total)
            {/if}
        </div>
    {/if}
</div>
