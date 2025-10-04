<script>
    // @ts-nocheck
    import { onMount } from "svelte";
    import { writable, derived } from "svelte/store";
    import { page } from "$app/stores";
    import { slide, fade } from "svelte/transition";
    import AdminHeader from "$lib/components/AdminHeader.svelte";
    import { createAuthFetch } from "$lib/utils/csrf.js";
    import "../transactionTable.css";
    import { browser } from "$app/environment";

    const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;
    const customerOrders = writable([]);
    const filteredOrders = writable([]);
    const loadingTransactions = writable(false);
    const errorTransactions = writable(null);
    const expandedOrder = writable(null);
    const editingOrder = writable(null); // order id being edited
    const editForm = writable({}); // temp form state

    // Pagination
    const itemsPerPage = writable(10);
    const currentPage = writable(1);
    const totalPages = derived([filteredOrders, itemsPerPage], ([$filteredOrders, $itemsPerPage]) =>
        Math.ceil($filteredOrders.length / $itemsPerPage)
    );

    // Filters
    const searchQuery = writable("");
    const statusFilter = writable("ALL");
    const dateSort = writable("newest");

    // Calculated paged results
    const pagedOrders = derived(
        [filteredOrders, currentPage, itemsPerPage],
        ([$filteredOrders, $currentPage, $itemsPerPage]) => {
            const startIndex = ($currentPage - 1) * $itemsPerPage;
            const endIndex = startIndex + $itemsPerPage;
            return $filteredOrders.slice(startIndex, endIndex);
        }
    );

    let loggedInUser = "";
    $: loggedInUser = $page.data?.user?.name || $page.data?.user?.username || $page.data?.user?.email || "";

    // Create authenticated fetch with CSRF protection
    $: csrfToken = $page.data?.csrfToken;
    $: fetchAuth = createAuthFetch(csrfToken);

    // Status options for dropdown
    const statusOptions = [
        { value: "UNFULFILLED", label: "Unfulfilled" },
        { value: "PROCESSING", label: "Processing" },
        { value: "SHIPPED", label: "Shipped" },
        { value: "DELIVERED", label: "Delivered" },
        { value: "PICKED_UP", label: "Picked Up" },
        { value: "CANCELLED", label: "Cancelled" },
    ];

    // Payment methods for dropdown
    const paymentMethods = [
        { value: "CASH", label: "Cash" },
        { value: "CREDIT_CARD", label: "Credit Card" },
        { value: "DEBIT_CARD", label: "Debit Card" },
        { value: "ZELLE", label: "Zelle" },
        { value: "VENMO", label: "Venmo" },
        { value: "OTHER", label: "Other" },
    ];

    // Format currency
    function formatCurrency(value) {
        if (!value && value !== 0) return "-";
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(value);
    }

    // Format date
    function formatDate(dateString) {
        if (!dateString) return "-";
        const date = new Date(dateString);
        return new Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
        }).format(date);
    }

    // Apply filters to orders
    function applyFilters() {
        let $searchQuery, $statusFilter, $dateSort, $customerOrders;
        searchQuery.subscribe((v) => ($searchQuery = v))();
        statusFilter.subscribe((v) => ($statusFilter = v))();
        dateSort.subscribe((v) => ($dateSort = v))();
        customerOrders.subscribe((v) => ($customerOrders = v))();

        let result = [...$customerOrders];

        // Filter by search query
        if ($searchQuery) {
            const query = $searchQuery.toLowerCase();
            result = result.filter(
                (order) =>
                    (order.customerName || "").toLowerCase().includes(query) ||
                    (order.customer?.name || "").toLowerCase().includes(query) ||
                    (order.customer?.phone || "").toLowerCase().includes(query) ||
                    (order.customerPhone || "").toLowerCase().includes(query) ||
                    order.id.toString().includes(query) ||
                    (order.moneyHolder || "").toLowerCase().includes(query)
            );
        }

        // Filter by status
        if ($statusFilter !== "ALL") {
            result = result.filter((order) => order.fulfillmentStatus === $statusFilter);
        }

        // Sort by date
        result.sort((a, b) => {
            const dateA = new Date(a.orderDate || a.createdAt).getTime();
            const dateB = new Date(b.orderDate || b.createdAt).getTime();
            return $dateSort === "newest" ? dateB - dateA : dateA - dateB;
        });

        filteredOrders.set(result);
        currentPage.set(1); // Reset to first page when filters change
    }

    // Watch for filter changes
    $: {
        if (browser && $customerOrders.length) {
            applyFilters();
        }
    }

    // Reset filters
    function resetFilters() {
        searchQuery.set("");
        statusFilter.set("ALL");
        dateSort.set("newest");
        applyFilters();
    }

    // Pagination navigation
    function goToPage(pageNum) {
        let $totalPages;
        totalPages.subscribe((v) => ($totalPages = v))();
        if (pageNum < 1) pageNum = 1;
        if (pageNum > $totalPages) pageNum = $totalPages;
        currentPage.set(pageNum);
    }

    async function startEdit(order) {
        editingOrder.set(order.id);
        editForm.set({
            name: order.customerName || order.customer?.name || "",
            phone: order.customerPhone || order.customer?.phone || "",
            moneyHolder: order.moneyHolder || "",
            status: order.fulfillmentStatus || "",
            paymentMethod: order.paymentMethod || "",
            notes: order.notes || "",
        });
    }

    function cancelEdit() {
        editingOrder.set(null);
        editForm.set({});
    }

    async function saveEdit(order) {
        let $editForm;
        editForm.subscribe((v) => ($editForm = v))();
        try {
            const res = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/customer-orders/${order.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerName: $editForm.name,
                    customerPhone: $editForm.phone,
                    moneyHolder: $editForm.moneyHolder,
                    fulfillmentStatus: $editForm.status,
                    paymentMethod: $editForm.paymentMethod,
                    notes: $editForm.notes,
                }),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || "Failed to update order");
            }

            // Show success message
            showToast("Order updated successfully", "success");

            // Refresh orders
            await refreshOrders();

            editingOrder.set(null);
            editForm.set({});
        } catch (e) {
            showToast(e instanceof Error ? e.message : String(e), "error");
        }
    }

    // Toast notification system
    const toast = writable(null);
    let toastTimeout;

    function showToast(message, type = "info") {
        if (toastTimeout) clearTimeout(toastTimeout);
        toast.set({ message, type });
        toastTimeout = setTimeout(() => toast.set(null), 5000);
    }

    // Refresh order data
    async function refreshOrders() {
        try {
            const custRes = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/customer-orders`);
            if (!custRes.ok) throw new Error("Failed to fetch customer orders");
            const custData = await custRes.json();
            customerOrders.set(custData.data || []);
            applyFilters(); // Re-apply filters to update filtered list
            return true;
        } catch (e) {
            errorTransactions.set(e instanceof Error ? e.message : String(e));
            return false;
        }
    }

    // Toggle money collected status
    async function toggleMoneyCollected(order) {
        try {
            const res = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/customer-orders/${order.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    moneyCollected: !order.moneyCollected,
                }),
            });

            if (!res.ok) throw new Error("Failed to update money collection status");
            showToast(`Money ${!order.moneyCollected ? "collected" : "marked as uncollected"}`, "success");
            await refreshOrders();
        } catch (e) {
            showToast(e instanceof Error ? e.message : String(e), "error");
        }
    }

    async function voidOrder(orderId) {
        if (!confirm("Are you sure you want to void this transaction? This cannot be undone.")) return;
        try {
            const res = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/customer-orders/${orderId}/void`, {
                method: "POST",
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || "Failed to void order");
            }

            showToast("Order voided successfully", "success");
            await refreshOrders();
        } catch (e) {
            showToast(e instanceof Error ? e.message : String(e), "error");
        }
    }

    // Export order as CSV
    function exportOrdersAsCSV() {
        let $filteredOrders;
        filteredOrders.subscribe((v) => ($filteredOrders = v))();

        // Create CSV header
        const headers = [
            "Order ID",
            "Customer Name",
            "Customer Phone",
            "Order Date",
            "Total",
            "Payment Method",
            "Money Holder",
            "Money Collected",
            "Status",
            "Notes",
        ].join(",");

        // Create CSV rows
        const rows = $filteredOrders.map((order) =>
            [
                order.id,
                `"${(order.customerName || order.customer?.name || "").replace(/"/g, '""')}"`,
                `"${(order.customerPhone || order.customer?.phone || "").replace(/"/g, '""')}"`,
                order.orderDate ? new Date(order.orderDate).toISOString() : "",
                order.total || 0,
                order.paymentMethod || "",
                `"${(order.moneyHolder || "").replace(/"/g, '""')}"`,
                order.moneyCollected ? "Yes" : "No",
                order.fulfillmentStatus || "",
                `"${(order.notes || "").replace(/"/g, '""')}"`,
            ].join(",")
        );

        // Combine and download
        const csv = [headers, ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `customer-orders-${new Date().toISOString().split("T")[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Calculate summary data
    const orderSummary = derived(filteredOrders, ($filteredOrders) => {
        const total = $filteredOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);

        const countByStatus = {};
        statusOptions.forEach((status) => {
            countByStatus[status.value] = $filteredOrders.filter(
                (order) => order.fulfillmentStatus === status.value
            ).length;
        });

        const moneyUncollected = $filteredOrders
            .filter((order) => !order.moneyCollected && order.moneyHolder && order.fulfillmentStatus !== "CANCELLED")
            .reduce((sum, order) => sum + Number(order.total || 0), 0);

        return {
            total,
            countByStatus,
            totalOrders: $filteredOrders.length,
            moneyUncollected,
        };
    });

    onMount(async () => {
        loadingTransactions.set(true);
        try {
            await refreshOrders();
        } catch (e) {
            errorTransactions.set(e instanceof Error ? e.message : String(e));
        } finally {
            loadingTransactions.set(false);
        }
    });
</script>

<AdminHeader />

{#if $toast}
    <div class="toast toast-{$toast.type}" transition:slide={{ y: -20, duration: 300 }}>
        <span>{$toast.message}</span>
        <button on:click={() => toast.set(null)}>✕</button>
    </div>
{/if}

<div class="admin-container">
    <div class="admin-header">
        <h2>Customer Orders</h2>
        <div class="controls">
            <button class="btn btn-primary" on:click={exportOrdersAsCSV}>
                <span class="icon">↓</span> Export to CSV
            </button>
        </div>
    </div>

    <!-- Summary Cards -->
    {#if !$loadingTransactions && !$errorTransactions}
        <div class="summary-cards">
            <div class="summary-card">
                <h4>Total Orders</h4>
                <p>{$orderSummary.totalOrders}</p>
            </div>
            <div class="summary-card">
                <h4>Total Value</h4>
                <p>{formatCurrency($orderSummary.total)}</p>
            </div>
            <div class="summary-card uncollected">
                <h4>Uncollected Money</h4>
                <p>{formatCurrency($orderSummary.moneyUncollected)}</p>
            </div>
        </div>
    {/if}

    <!-- Filters -->
    <div class="filters">
        <div class="filter-group">
            <label for="search">Search:</label>
            <input type="text" id="search" bind:value={$searchQuery} placeholder="Search by customer, ID, phone..." />
        </div>

        <div class="filter-group">
            <label for="status">Status:</label>
            <select id="status" bind:value={$statusFilter}>
                <option value="ALL">All Statuses</option>
                {#each statusOptions as status}
                    <option value={status.value}>{status.label}</option>
                {/each}
            </select>
        </div>

        <div class="filter-group">
            <label for="sort">Sort:</label>
            <select id="sort" bind:value={$dateSort}>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
            </select>
        </div>

        <button class="filter-button" on:click={resetFilters}>Reset Filters</button>
    </div>

    {#if $loadingTransactions}
        <div class="loading-spinner">
            <div class="spinner"></div>
            <p>Loading transactions...</p>
        </div>
    {:else if $errorTransactions}
        <div class="error-message">
            <span class="icon">⚠️</span>
            <p>Error: {$errorTransactions}</p>
            <button on:click={refreshOrders}>Retry</button>
        </div>
    {:else}
        <div class="results-info">
            <span>Showing {$pagedOrders.length} of {$filteredOrders.length} orders</span>

            <div class="pagination-controls">
                <label for="perPage">Per page:</label>
                <select id="perPage" bind:value={$itemsPerPage}>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                </select>
            </div>
        </div>

        <table class="admin-table">
            <thead>
                <tr>
                    <th></th>
                    <th>ID</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Money Holder</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {#each $pagedOrders as order}
                    <tr class:order-cancelled={order.fulfillmentStatus === "CANCELLED"}>
                        <td>
                            <button
                                class="expand-button"
                                on:click={() => expandedOrder.set($expandedOrder === order.id ? null : order.id)}
                                aria-label={$expandedOrder === order.id
                                    ? "Collapse order details"
                                    : "Expand order details"}
                            >
                                {#if $expandedOrder === order.id}−{:else}+{/if}
                            </button>
                        </td>
                        <td>{order.id}</td>
                        {#if $editingOrder === order.id}
                            <td class="editing-cell">
                                <div class="edit-field">
                                    <label for="customer-name">Name:</label>
                                    <input
                                        id="customer-name"
                                        type="text"
                                        bind:value={$editForm.name}
                                        placeholder="Customer Name"
                                        class="form-input"
                                    />
                                </div>
                                <div class="edit-field">
                                    <label for="customer-phone">Phone:</label>
                                    <input
                                        id="customer-phone"
                                        type="text"
                                        bind:value={$editForm.phone}
                                        placeholder="Phone Number"
                                        class="form-input"
                                    />
                                </div>
                            </td>
                            <td>{formatDate(order.orderDate)}</td>
                            <td>{formatCurrency(order.total)}</td>
                            <td>
                                <select bind:value={$editForm.paymentMethod} class="form-select">
                                    <option value="">Select payment method</option>
                                    {#each paymentMethods as method}
                                        <option value={method.value}>{method.label}</option>
                                    {/each}
                                </select>
                            </td>
                            <td>
                                <input
                                    type="text"
                                    bind:value={$editForm.moneyHolder}
                                    placeholder="Money Holder"
                                    class="form-input"
                                />
                                <div class="checkbox-field">
                                    <label>
                                        <input type="checkbox" bind:checked={order.moneyCollected} />
                                        Collected
                                    </label>
                                </div>
                            </td>
                            <td>
                                <select bind:value={$editForm.status} class="form-select">
                                    {#each statusOptions as status}
                                        <option value={status.value}>{status.label}</option>
                                    {/each}
                                </select>
                            </td>
                            <td class="actions-cell">
                                <div class="action-buttons">
                                    <button on:click={() => saveEdit(order)} class="btn btn-save">
                                        <span class="icon">💾</span> Save
                                    </button>
                                    <button on:click={cancelEdit} class="btn btn-cancel">
                                        <span class="icon">✕</span> Cancel
                                    </button>
                                </div>
                            </td>
                        {:else}
                            <td class="customer-cell">
                                <div class="customer-name">{order.customer?.name || order.customerName || "—"}</div>
                                <div class="customer-phone">{order.customer?.phone || order.customerPhone || "—"}</div>
                            </td>
                            <td>{formatDate(order.orderDate)}</td>
                            <td class="total-cell">{formatCurrency(order.total)}</td>
                            <td>
                                <span class="payment-method">{order.paymentMethod || "—"}</span>
                            </td>
                            <td class="money-holder-cell">
                                <div class="money-holder">{order.moneyHolder || "—"}</div>
                                <div class="money-status">
                                    {#if order.moneyCollected}
                                        <span class="money-collected">Collected</span>
                                    {:else if order.moneyHolder}
                                        <span class="money-pending">Pending</span>
                                    {/if}
                                </div>
                            </td>
                            <td>
                                <span class="status-badge status-{order.fulfillmentStatus?.toLowerCase()}">
                                    {order.fulfillmentStatus === "CANCELLED"
                                        ? "Voided"
                                        : order.fulfillmentStatus === "UNFULFILLED"
                                          ? "Unfulfilled"
                                          : order.fulfillmentStatus === "PROCESSING"
                                            ? "Processing"
                                            : order.fulfillmentStatus === "SHIPPED"
                                              ? "Shipped"
                                              : order.fulfillmentStatus === "DELIVERED"
                                                ? "Delivered"
                                                : order.fulfillmentStatus === "PICKED_UP"
                                                  ? "Picked Up"
                                                  : order.fulfillmentStatus || "—"}
                                </span>
                            </td>
                            <td class="actions-cell">
                                <div class="action-buttons">
                                    <button on:click={() => startEdit(order)} class="btn btn-edit" title="Edit order">
                                        <span class="icon">✏️</span>
                                    </button>

                                    <button
                                        on:click={() => toggleMoneyCollected(order)}
                                        class="btn {order.moneyCollected ? 'btn-collected' : 'btn-collect'}"
                                        title={order.moneyCollected ? "Mark as uncollected" : "Mark as collected"}
                                        disabled={!order.moneyHolder || order.fulfillmentStatus === "CANCELLED"}
                                    >
                                        <span class="icon">{order.moneyCollected ? "💰" : "💸"}</span>
                                    </button>

                                    <button
                                        on:click={() => voidOrder(order.id)}
                                        class="btn btn-void"
                                        title="Void this order"
                                        disabled={order.fulfillmentStatus === "CANCELLED"}
                                    >
                                        <span class="icon">❌</span>
                                    </button>
                                </div>
                            </td>
                        {/if}
                    </tr>
                    {#if $expandedOrder === order.id}
                        <tr class:order-cancelled={order.fulfillmentStatus === "CANCELLED"} class="expanded-row">
                            <td></td>
                            <td colspan="8" class="expanded-content" transition:slide={{ duration: 300 }}>
                                <div class="expanded-section">
                                    <h4>Order Details</h4>
                                    <div class="order-details">
                                        <div class="detail-item">
                                            <span class="detail-label">Created:</span>
                                            <span class="detail-value">{formatDate(order.createdAt)}</span>
                                        </div>
                                        <div class="detail-item">
                                            <span class="detail-label">Last Updated:</span>
                                            <span class="detail-value">{formatDate(order.updatedAt)}</span>
                                        </div>
                                        {#if order.staffId}
                                            <div class="detail-item">
                                                <span class="detail-label">Staff:</span>
                                                <span class="detail-value">{order.staff?.name || order.staffId}</span>
                                            </div>
                                        {/if}
                                        {#if order.notes}
                                            <div class="detail-item detail-notes">
                                                <span class="detail-label">Notes:</span>
                                                <span class="detail-value">{order.notes}</span>
                                            </div>
                                        {/if}
                                    </div>
                                </div>

                                <div class="expanded-section">
                                    <h4>Order Items</h4>
                                    <table class="variant-table">
                                        <thead>
                                            <tr>
                                                <th>Product</th>
                                                <th>Variant</th>
                                                <th>Quantity</th>
                                                <th>Sale Price</th>
                                                <th>Subtotal</th>
                                                <th>COGS</th>
                                                <th>Profit</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {#each order.items as item}
                                                <tr>
                                                    <td
                                                        >{item.productName ??
                                                            item.variant?.product?.displayName ??
                                                            "-"}</td
                                                    >
                                                    <td>
                                                        <div>{item.variant?.color || "-"}</div>
                                                        <div class="variant-sku">
                                                            {item.productSku ?? item.variant?.sku ?? "-"}
                                                        </div>
                                                    </td>
                                                    <td>{item.quantity}</td>
                                                    <td>{formatCurrency(item.salePrice)}</td>
                                                    <td>{formatCurrency(item.salePrice * item.quantity)}</td>
                                                    <td>{item.cogs ? formatCurrency(item.cogs) : "-"}</td>
                                                    <td>
                                                        {item.cogs
                                                            ? formatCurrency(
                                                                  item.salePrice * item.quantity -
                                                                      item.cogs * item.quantity
                                                              )
                                                            : "-"}
                                                    </td>
                                                </tr>
                                            {/each}
                                            <tr class="totals-row">
                                                <td colspan="4" class="right-align"><strong>Totals:</strong></td>
                                                <td>
                                                    <strong>
                                                        {formatCurrency(
                                                            order.items.reduce(
                                                                (sum, item) => sum + item.salePrice * item.quantity,
                                                                0
                                                            )
                                                        )}
                                                    </strong>
                                                </td>
                                                <td>
                                                    <strong>
                                                        {formatCurrency(
                                                            order.items.reduce(
                                                                (sum, item) => sum + (item.cogs || 0) * item.quantity,
                                                                0
                                                            )
                                                        )}
                                                    </strong>
                                                </td>
                                                <td>
                                                    <strong>
                                                        {formatCurrency(
                                                            order.items.reduce(
                                                                (sum, item) =>
                                                                    sum +
                                                                    (item.salePrice * item.quantity -
                                                                        (item.cogs || 0) * item.quantity),
                                                                0
                                                            )
                                                        )}
                                                    </strong>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {#if order.fulfillmentStatus === "CANCELLED"}
                                    <div class="order-cancelled-notice">
                                        <span class="icon">⚠️</span>
                                        <strong>This order has been voided.</strong>
                                    </div>
                                {/if}
                            </td>
                        </tr>
                    {/if}
                {/each}
            </tbody>
        </table>

        <!-- Pagination -->
        {#if $totalPages > 1}
            <div class="pagination">
                <button class="pagination-button" disabled={$currentPage === 1} on:click={() => goToPage(1)}>
                    &laquo;
                </button>

                <button
                    class="pagination-button"
                    disabled={$currentPage === 1}
                    on:click={() => goToPage($currentPage - 1)}
                >
                    &lsaquo;
                </button>

                {#each Array(Math.min($totalPages, 5)) as _, i}
                    {#if $totalPages <= 5 || ($currentPage <= 3 && i < 5) || ($currentPage > $totalPages - 3 && i >= $totalPages - 5) || (i >= $currentPage - 3 && i <= $currentPage + 1)}
                        <button
                            class="pagination-button {$currentPage === i + 1 ? 'active' : ''}"
                            on:click={() => goToPage(i + 1)}
                        >
                            {i + 1}
                        </button>
                    {:else if i === 2 && $currentPage > 3}
                        <span class="pagination-ellipsis">...</span>
                    {:else if i === $totalPages - 3 && $currentPage < $totalPages - 3}
                        <span class="pagination-ellipsis">...</span>
                    {/if}
                {/each}

                <button
                    class="pagination-button"
                    disabled={$currentPage === $totalPages}
                    on:click={() => goToPage($currentPage + 1)}
                >
                    &rsaquo;
                </button>

                <button
                    class="pagination-button"
                    disabled={$currentPage === $totalPages}
                    on:click={() => goToPage($totalPages)}
                >
                    &raquo;
                </button>
            </div>
        {/if}

        {#if $filteredOrders.length === 0}
            <div class="no-orders">
                <p>No orders found matching your filters.</p>
                <button class="btn btn-primary" on:click={resetFilters}>Reset Filters</button>
            </div>
        {/if}
    {/if}
</div>

<style>
    /* Toast notifications */
    .toast {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        min-width: 300px;
        max-width: 500px;
        animation: slideIn 0.3s ease;
    }

    .toast-success {
        background-color: var(--status-received-bg);
        color: var(--status-received-color);
        border-left: 4px solid var(--color-success);
    }

    .toast-error {
        background-color: var(--order-cancelled-bg);
        color: var(--order-cancelled-color);
        border-left: 4px solid var(--color-danger);
    }

    .toast-info {
        background-color: #e0f7fa;
        color: #006064;
        border-left: 4px solid #00b8d4;
    }

    .toast button {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 1.2rem;
        padding: 0;
        margin-left: auto;
    }

    /* Admin header with controls */
    .admin-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
    }

    .controls {
        display: flex;
        gap: 1rem;
    }

    /* Summary cards */
    .summary-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
    }

    .summary-card {
        background: var(--color-link-bg-hover);
        border-radius: 8px;
        padding: 1rem;
        text-align: center;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .summary-card h4 {
        margin: 0 0 0.5rem;
        font-weight: 500;
    }

    .summary-card p {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 600;
    }

    .summary-card.uncollected p {
        color: var(--color-warning);
    }

    /* Filters */
    .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        margin-bottom: 1.5rem;
        padding: 1rem;
        background: var(--color-link-bg-hover);
        border-radius: 8px;
    }

    .filter-group {
        display: flex;
        flex-direction: column;
        min-width: 180px;
    }

    .filter-group label {
        margin-bottom: 0.3rem;
        font-weight: 500;
        font-size: 0.85rem;
    }

    .filter-group input,
    .filter-group select {
        padding: 0.5rem;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background: var(--color-bg);
        color: var(--color-text);
        font-size: 0.9rem;
    }

    .filter-button {
        align-self: flex-end;
        background: var(--color-bg);
        color: var(--color-link);
        border: 1px solid var(--color-border);
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        margin-top: auto;
        font-size: 0.9rem;
    }

    .filter-button:hover {
        background: var(--color-link-bg-hover);
    }

    /* Loading spinner */
    .loading-spinner {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 3rem 0;
    }

    .spinner {
        border: 4px solid rgba(0, 0, 0, 0.1);
        border-radius: 50%;
        border-top: 4px solid var(--color-primary);
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin-bottom: 1rem;
    }

    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }

    /* Error message */
    .error-message {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 2rem;
        background: var(--order-cancelled-bg);
        border-radius: 8px;
        color: var(--order-cancelled-color);
    }

    .error-message .icon {
        font-size: 2rem;
        margin-bottom: 1rem;
    }

    .error-message button {
        margin-top: 1rem;
        background: var(--color-bg);
        border: 1px solid var(--color-border);
        padding: 0.5rem 1.5rem;
        border-radius: 6px;
        cursor: pointer;
    }

    /* Results info and per page control */
    .results-info {
        display: flex;
        justify-content: space-between;
        margin-bottom: 1rem;
        font-size: 0.9rem;
    }

    .pagination-controls {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .pagination-controls select {
        padding: 0.25rem;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background: var(--color-bg);
    }

    /* Improved table styling */
    .customer-cell {
        display: flex;
        flex-direction: column;
    }

    .customer-name {
        font-weight: 500;
    }

    .customer-phone {
        font-size: 0.85rem;
        color: var(--color-text-light);
    }

    .total-cell {
        font-weight: 600;
    }

    .money-holder-cell {
        display: flex;
        flex-direction: column;
    }

    .money-status {
        font-size: 0.8rem;
        margin-top: 0.2rem;
    }

    .money-collected {
        color: var(--color-success);
        background: var(--status-received-bg);
        padding: 0.1rem 0.4rem;
        border-radius: 4px;
        font-weight: 500;
    }

    .money-pending {
        color: var(--color-warning);
        background: var(--status-pending-bg);
        padding: 0.1rem 0.4rem;
        border-radius: 4px;
        font-weight: 500;
    }

    /* Status badges */
    .status-badge {
        display: inline-block;
        padding: 0.3rem 0.6rem;
        border-radius: 4px;
        font-size: 0.85rem;
        font-weight: 500;
    }

    .status-unfulfilled {
        background: var(--status-pending-bg);
        color: var(--color-warning);
    }

    .status-processing {
        background: #e6f7ff;
        color: #0070f3;
    }

    .status-shipped {
        background: #edf7ed;
        color: #2e7d32;
    }

    .status-delivered,
    .status-picked_up {
        background: var(--status-received-bg);
        color: var(--color-success);
    }

    .status-cancelled {
        background: var(--order-cancelled-bg);
        color: var(--order-cancelled-color);
    }

    /* Action buttons */
    .actions-cell {
        white-space: nowrap;
    }

    .action-buttons {
        display: flex;
        gap: 0.5rem;
    }

    .btn {
        padding: 0.4rem 0.8rem;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        border: none;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .btn .icon {
        margin-right: 0.3rem;
    }

    .action-buttons .btn {
        padding: 0.3rem;
        min-width: 32px;
        height: 32px;
    }

    .btn-primary {
        background: var(--color-primary);
        color: white;
    }

    .btn-primary:hover {
        background: var(--color-primary-hover);
    }

    .btn-edit {
        background: var(--color-link-bg-hover);
        color: var(--color-link);
    }

    .btn-edit:hover {
        background: var(--color-link-bg-hover);
        color: var(--color-primary);
    }

    .btn-collect {
        background: #edf7ed;
        color: var(--color-success);
    }

    .btn-collect:hover {
        background: var(--status-received-bg);
    }

    .btn-collected {
        background: var(--status-received-bg);
        color: var(--color-success);
    }

    .btn-void {
        background: var(--color-bg);
        color: var(--color-danger);
    }

    .btn-void:hover {
        background: var(--order-cancelled-bg);
    }

    .btn-save {
        background: var(--color-primary);
        color: white;
    }

    .btn-cancel {
        background: var(--color-link-bg-hover);
        color: var(--color-text);
    }

    .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* Editing form */
    .editing-cell {
        padding: 0.5rem !important;
    }

    .edit-field {
        margin-bottom: 0.5rem;
    }

    .edit-field label {
        display: block;
        font-size: 0.8rem;
        margin-bottom: 0.2rem;
        color: var(--color-text-light);
    }

    .form-input,
    .form-select {
        width: 100%;
        padding: 0.3rem 0.5rem;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background: var(--color-bg);
        color: var(--color-text);
        font-size: 0.9rem;
    }

    .checkbox-field {
        display: flex;
        align-items: center;
        margin-top: 0.3rem;
    }

    .checkbox-field input {
        margin-right: 0.3rem;
    }

    /* Expanded row styling */
    .expanded-row {
        background-color: var(--table-expanded-bg) !important;
    }

    .expanded-content {
        padding: 1rem !important;
    }

    .expanded-section {
        margin-bottom: 1.5rem;
    }

    .expanded-section h4 {
        margin: 0 0 0.5rem 0;
        font-size: 1rem;
        font-weight: 600;
    }

    .order-details {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
    }

    .detail-item {
        margin-bottom: 0.5rem;
    }

    .detail-label {
        display: block;
        font-size: 0.8rem;
        color: var(--color-text-light);
    }

    .detail-value {
        font-weight: 500;
    }

    .detail-notes {
        grid-column: 1 / -1;
    }

    .order-cancelled-notice {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 1rem;
        padding: 0.5rem 1rem;
        background: var(--order-cancelled-bg);
        color: var(--order-cancelled-color);
        border-radius: 6px;
    }

    .variant-sku {
        font-size: 0.8rem;
        color: var(--color-text-light);
    }

    .totals-row {
        background: rgba(0, 0, 0, 0.02);
    }

    .right-align {
        text-align: right;
    }

    /* Pagination */
    .pagination {
        display: flex;
        justify-content: center;
        gap: 0.3rem;
        margin: 2rem 0 1rem;
    }

    .pagination-button {
        min-width: 2rem;
        height: 2rem;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--color-bg);
        border: 1px solid var(--color-border);
        cursor: pointer;
        transition: all 0.2s;
    }

    .pagination-button.active {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
    }

    .pagination-button:hover:not(:disabled):not(.active) {
        background: var(--color-link-bg-hover);
    }

    .pagination-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .pagination-ellipsis {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 2rem;
        height: 2rem;
    }

    /* No orders message */
    .no-orders {
        text-align: center;
        padding: 3rem 0;
    }

    .no-orders p {
        margin-bottom: 1rem;
        color: var(--color-text-light);
    }

    /* Make responsive */
    @media (max-width: 1200px) {
        .admin-table {
            font-size: 0.9rem;
        }

        .expanded-section {
            overflow-x: auto;
        }
    }

    @media (max-width: 768px) {
        .filters {
            flex-direction: column;
        }

        .summary-cards {
            grid-template-columns: 1fr;
        }
    }
</style>
