<script>
    // @ts-nocheck
    import { onMount } from "svelte";
    import { writable, derived } from "svelte/store";
    import { page } from "$app/stores";
    import { slide, fade } from "svelte/transition";
    import AdminHeader from "$lib/components/AdminHeader.svelte";
    import { createAuthFetch } from "$lib/utils/csrf.js";
    import "../transactionTable.css";
    import "./customerOrders.css";
    import { browser } from "$app/environment";
    import AutoComplete from "$lib/components/AutoComplete.svelte";
    import { productVariants, fetchProductVariants } from "$lib/stores/productVariants.js";

    const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;
    const customerOrders = writable([]);
    // Filters
    const searchQuery = writable("");
    const statusFilter = writable("ALL");
    const dateSort = writable("newest");
    const startDate = writable("");
    const endDate = writable("");
    // Filtering logic as a derived store
    const filteredOrders = derived(
        [customerOrders, searchQuery, statusFilter, dateSort, startDate, endDate],
        ([$customerOrders, $searchQuery, $statusFilter, $dateSort, $startDate, $endDate]) => {
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
            // Filter by date range
            if ($startDate) {
                const start = new Date($startDate).getTime();
                result = result.filter((order) => {
                    const orderDate = new Date(order.orderDate || order.createdAt).getTime();
                    return orderDate >= start;
                });
            }
            if ($endDate) {
                // Make end date inclusive by adding 1 day (milliseconds)
                const end = new Date($endDate).getTime() + 24 * 60 * 60 * 1000;
                result = result.filter((order) => {
                    const orderDate = new Date(order.orderDate || order.createdAt).getTime();
                    return orderDate < end;
                });
            }
            // Sort by date
            result.sort((a, b) => {
                const dateA = new Date(a.orderDate || a.createdAt).getTime();
                const dateB = new Date(b.orderDate || b.createdAt).getTime();
                return $dateSort === "newest" ? dateB - dateA : dateA - dateB;
            });
            return result;
        }
    );
    const loadingTransactions = writable(false);
    const errorTransactions = writable(null);
    const expandedOrder = writable(null);
    const editingOrder = writable(null); // order id being edited
    const editForm = writable({}); // temp form state
    const showAddOrderModal = writable(false);
    const showAddShippingOrderModal = writable(false);
    const showAddBulkOrderModal = writable(false);

    const newOrderForm = writable({
        customerName: "",
        customerPhone: "",
        moneyHolder: "",
        paymentMethod: "",
        orderDate: "",
        items: [{ sku: "", quantity: 1, salePrice: 0 }],
    });
    const newShippingOrderForm = writable({
        customerName: "",
        customerPhone: "",
        moneyHolder: "",
        paymentMethod: "",
        orderDate: "",
        items: [{ sku: "", quantity: 1, salePrice: 0 }],
        shippingAddress: "",
        shippingCost: 0,
        freeShipping: false,
        shippingMethod: "",
    });
    const newBulkOrderForm = writable({
        orderDate: "",
        items: [{ sku: "", quantity: 1, salePrice: 0, paymentMethod: "CASH", moneyHolder: "" }],
    });

    // Pagination
    const itemsPerPage = writable(10);
    const currentPage = writable(1);
    const totalPages = derived([filteredOrders, itemsPerPage], ([$filteredOrders, $itemsPerPage]) =>
        Math.ceil($filteredOrders.length / $itemsPerPage)
    );

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

    // Reset filters
    function resetFilters() {
        searchQuery.set("");
        statusFilter.set("ALL");
        dateSort.set("newest");
        startDate.set("");
        endDate.set("");
        currentPage.set(1);
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
        const total = $filteredOrders.reduce(
            (sum, order) =>
                sum +
                (order.items ? order.items.reduce((itemSum, item) => itemSum + item.salePrice * item.quantity, 0) : 0),
            0
        );

        const countByStatus = {};
        statusOptions.forEach((status) => {
            countByStatus[status.value] = $filteredOrders.filter(
                (order) => order.fulfillmentStatus === status.value
            ).length;
        });

        const profit = $filteredOrders.reduce(
            (sum, order) =>
                sum +
                (order.items
                    ? order.items.reduce((itemSum, item) => itemSum + (item.salePrice - item.cogs) * item.quantity, 0)
                    : 0),
            0
        );

        return {
            total,
            countByStatus,
            totalOrders: $filteredOrders.length,
            profit,
        };
    });

    onMount(async () => {
        loadingTransactions.set(true);
        await fetchProductVariants(PUBLIC_BACKEND_URL, fetchAuth);
        try {
            await refreshOrders();
        } catch (e) {
            errorTransactions.set(e instanceof Error ? e.message : String(e));
        } finally {
            loadingTransactions.set(false);
        }
    });

    function openAddOrderModal() {
        showAddOrderModal.set(true);
    }

    function closeAddOrderModal() {
        showAddOrderModal.set(false);
    }

    function openAddShippingOrderModal() {
        showAddShippingOrderModal.set(true);
    }

    function closeAddShippingOrderModal() {
        showAddShippingOrderModal.set(false);
    }

    function openAddBulkOrderModal() {
        showAddBulkOrderModal.set(true);
    }

    function closeAddBulkOrderModal() {
        showAddBulkOrderModal.set(false);
    }

    function addOrderItem() {
        let $newOrderForm;
        newOrderForm.subscribe((v) => ($newOrderForm = v))();
        newOrderForm.set({
            ...$newOrderForm,
            items: [...$newOrderForm.items, { sku: "", quantity: 1, salePrice: 0 }],
        });
    }

    function removeOrderItem(index) {
        let $newOrderForm;
        newOrderForm.subscribe((v) => ($newOrderForm = v))();
        newOrderForm.set({
            ...$newOrderForm,
            items: $newOrderForm.items.filter((_, idx) => idx !== index),
        });
    }

    async function submitNewOrder() {
        let $newOrderForm;
        newOrderForm.subscribe((v) => ($newOrderForm = v))();
        try {
            // Validate items
            for (const item of $newOrderForm.items) {
                if (!item.sku || item.quantity <= 0 || item.salePrice <= 0) {
                    throw new Error("Please ensure all items have valid SKU, quantity, and sale price.");
                }
            }

            const res = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/customer-orders`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerName: $newOrderForm.customerName,
                    customerPhone: $newOrderForm.customerPhone,
                    moneyHolder: $newOrderForm.moneyHolder,
                    paymentMethod: $newOrderForm.paymentMethod,
                    items: $newOrderForm.items,
                    orderDate: $newOrderForm.orderDate,
                }),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || "Failed to create order");
            }

            showToast("Order created successfully", "success");
            closeAddOrderModal();
            await refreshOrders();
        } catch (e) {
            showToast(e instanceof Error ? e.message : String(e), "error");
        }
    }

    async function submitNewShippingOrder() {
        let $newShippingOrderForm;
        newShippingOrderForm.subscribe((v) => ($newShippingOrderForm = v))();
        try {
            // Validate items
            for (const item of $newShippingOrderForm.items) {
                if (!item.sku || item.quantity <= 0 || item.salePrice <= 0) {
                    throw new Error("Please ensure all items have valid SKU, quantity, and sale price.");
                }
            }

            const res = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/customer-orders`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerName: $newShippingOrderForm.customerName,
                    customerPhone: $newShippingOrderForm.customerPhone,
                    moneyHolder: $newShippingOrderForm.moneyHolder,
                    paymentMethod: $newShippingOrderForm.paymentMethod,
                    items: $newShippingOrderForm.items,
                    orderDate: $newShippingOrderForm.orderDate,
                    shippingAddress: $newShippingOrderForm.shippingAddress,
                    shippingCost: $newShippingOrderForm.shippingCost,
                    freeShipping: $newShippingOrderForm.freeShipping,
                    shippingMethod: $newShippingOrderForm.shippingMethod,
                }),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || "Failed to create shipping order");
            }

            showToast("Shipping order created successfully", "success");
            closeAddShippingOrderModal();
            await refreshOrders();
        } catch (e) {
            showToast(e instanceof Error ? e.message : String(e), "error");
        }
    }

    async function submitNewBulkOrder() {
        let $newBulkOrderForm;
        newBulkOrderForm.subscribe((v) => ($newBulkOrderForm = v))();
        try {
            // Validate items
            for (const item of $newBulkOrderForm.items) {
                if (!item.sku || item.quantity <= 0 || item.salePrice <= 0) {
                    throw new Error("Please ensure all items have valid SKU, quantity, and sale price.");
                }
            }

            const res = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/customer-orders/bulk`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: $newBulkOrderForm.items,
                    orderDate: $newBulkOrderForm.orderDate,
                }),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || "Failed to create bulk orders");
            }

            showToast("Bulk orders created successfully", "success");
            closeAddBulkOrderModal();
            await refreshOrders();
        } catch (e) {
            showToast(e instanceof Error ? e.message : String(e), "error");
        }
    }

    function handleVariantSelect(idx, event) {
        let $newOrderForm;
        newOrderForm.subscribe((v) => ($newOrderForm = v))();
        const selected = event.detail.item;
        const items = [...$newOrderForm.items];
        items[idx].sku = selected.sku;
        items[idx].displayName = selected.displayName;
        items[idx].color = selected.color;
        items[idx].size = selected.size;
        items[idx].salePrice = selected.salePrice || items[idx].salePrice;
        newOrderForm.set({ ...$newOrderForm, items });
    }

    function handleShippingVariantSelect(idx, event) {
        let $newShippingOrderForm;
        newShippingOrderForm.subscribe((v) => ($newShippingOrderForm = v))();
        const selected = event.detail.item;
        const items = [...$newShippingOrderForm.items];
        items[idx].sku = selected.sku;
        items[idx].displayName = selected.displayName;
        items[idx].color = selected.color;
        items[idx].size = selected.size;
        items[idx].salePrice = selected.salePrice || items[idx].salePrice;
        newShippingOrderForm.set({ ...$newShippingOrderForm, items });
    }

    function handleBulkVariantSelect(idx, event) {
        let $newBulkOrderForm;
        newBulkOrderForm.subscribe((v) => ($newBulkOrderForm = v))();
        const selected = event.detail.item;
        const items = [...$newBulkOrderForm.items];
        items[idx].sku = selected.sku;
        items[idx].displayName = selected.displayName;
        items[idx].color = selected.color;
        items[idx].size = selected.size;
        items[idx].salePrice = selected.salePrice || items[idx].salePrice;
        newBulkOrderForm.set({ ...$newBulkOrderForm, items });
    }
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
            <button class="btn btn-primary" on:click={openAddOrderModal}>
                <span class="icon">＋</span> Add New Order
            </button>
            <button class="btn btn-primary" on:click={openAddShippingOrderModal}>
                <span class="icon">🚚</span> Add New Shipping Order
            </button>
            <button class="btn btn-primary" on:click={openAddBulkOrderModal}>
                <span class="icon">📦</span> Add Many Orders
            </button>
            <button class="btn btn-primary" on:click={exportOrdersAsCSV}>
                <span class="icon">↓</span> Export to CSV
            </button>
        </div>
    </div>

    {#if $showAddOrderModal}
        <div class="modal-overlay">
            <div class="modal modal-new-order">
                <div class="modal-header">
                    <h3>Add New Order</h3>
                    <button class="modal-close" on:click={closeAddOrderModal}>✕</button>
                </div>
                <form class="modal-form" on:submit|preventDefault={submitNewOrder}>
                    <div class="modal-section">
                        <h4>Customer Details</h4>
                        <div class="modal-row">
                            <label>
                                <span>Customer Name</span>
                                <input type="text" bind:value={$newOrderForm.customerName} placeholder="Full Name" />
                            </label>
                            <label>
                                <span>Phone</span>
                                <input
                                    type="text"
                                    bind:value={$newOrderForm.customerPhone}
                                    placeholder="Phone Number"
                                />
                            </label>
                        </div>
                        <div class="modal-row">
                            <label>
                                <span>Money Holder</span>
                                <input
                                    type="text"
                                    bind:value={$newOrderForm.moneyHolder}
                                    placeholder="Who holds the money?"
                                />
                            </label>
                            <label>
                                <span>Payment Method</span>
                                <select bind:value={$newOrderForm.paymentMethod}>
                                    {#each paymentMethods as method}
                                        <option value={method.value}>{method.label}</option>
                                    {/each}
                                </select>
                            </label>
                        </div>
                        <div class="modal-row">
                            <label>
                                <span>Date</span>
                                <input type="date" bind:value={$newOrderForm.orderDate} />
                            </label>
                        </div>
                    </div>
                    <div class="modal-section">
                        <h4>Order Items</h4>
                        <div class="modal-item-row modal-item-labels">
                            <span class="item-sku-label">SKU / Product</span>
                            <span class="item-qty-label">Qty</span>
                            <span class="item-price-label">Sale Price</span>
                            <span></span>
                        </div>
                        {#each $newOrderForm.items as item, idx}
                            <div class="modal-item-row">
                                <AutoComplete
                                    items={$productVariants}
                                    bind:value={item.sku}
                                    itemLabel={(v) => `${v.sku} - ${v.displayName} (${v.color}, ${v.size})`}
                                    itemValue={(v) => v.sku}
                                    placeholder="Search SKU or product name..."
                                    inputClass="item-sku"
                                    dropdownClass="item-sku-dropdown"
                                    on:select={(e) => handleVariantSelect(idx, e)}
                                />
                                <input
                                    type="number"
                                    class="item-qty"
                                    min="1"
                                    placeholder="Qty"
                                    bind:value={item.quantity}
                                    required
                                />
                                <input
                                    type="number"
                                    class="item-price"
                                    min="0.01"
                                    step="0.01"
                                    placeholder="Sale Price"
                                    bind:value={item.salePrice}
                                    required
                                />
                                <button
                                    class="btn btn-remove"
                                    type="button"
                                    on:click={() => removeOrderItem(idx)}
                                    disabled={$newOrderForm.items.length === 1}>✕</button
                                >
                            </div>
                        {/each}
                        <button class="btn btn-add-item" type="button" on:click={addOrderItem}>＋ Add Item</button>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-primary" type="submit">Submit Order</button>
                        <button class="btn btn-cancel" type="button" on:click={closeAddOrderModal}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    {/if}

    {#if $showAddShippingOrderModal}
        <div class="modal-overlay">
            <div class="modal modal-new-order">
                <div class="modal-header">
                    <h3>Add New Shipping Order</h3>
                    <button class="modal-close" on:click={closeAddShippingOrderModal}>✕</button>
                </div>
                <form class="modal-form" on:submit|preventDefault={submitNewShippingOrder}>
                    <div class="modal-section">
                        <h4>Customer Details</h4>
                        <div class="modal-row">
                            <label>
                                <span>Customer Name</span>
                                <input
                                    type="text"
                                    bind:value={$newShippingOrderForm.customerName}
                                    placeholder="Full Name"
                                />
                            </label>
                            <label>
                                <span>Phone</span>
                                <input
                                    type="text"
                                    bind:value={$newShippingOrderForm.customerPhone}
                                    placeholder="Phone Number"
                                />
                            </label>
                        </div>
                        <div class="modal-row">
                            <label>
                                <span>Money Holder</span>
                                <input
                                    type="text"
                                    bind:value={$newShippingOrderForm.moneyHolder}
                                    placeholder="Who holds the money?"
                                />
                            </label>
                            <label>
                                <span>Payment Method</span>
                                <select bind:value={$newShippingOrderForm.paymentMethod}>
                                    {#each paymentMethods as method}
                                        <option value={method.value}>{method.label}</option>
                                    {/each}
                                </select>
                            </label>
                        </div>
                        <div class="modal-row">
                            <label>
                                <span>Date</span>
                                <input type="date" bind:value={$newShippingOrderForm.orderDate} />
                            </label>
                        </div>
                    </div>
                    <div class="modal-section">
                        <h4>Order Items</h4>
                        <div class="modal-item-row modal-item-labels">
                            <span class="item-sku-label">SKU / Product</span>
                            <span class="item-qty-label">Qty</span>
                            <span class="item-price-label">Sale Price</span>
                            <span></span>
                        </div>
                        {#each $newShippingOrderForm.items as item, idx}
                            <div class="modal-item-row">
                                <AutoComplete
                                    items={$productVariants}
                                    bind:value={item.sku}
                                    itemLabel={(v) => `${v.sku} - ${v.displayName} (${v.color}, ${v.size})`}
                                    itemValue={(v) => v.sku}
                                    placeholder="Search SKU or product name..."
                                    inputClass="item-sku"
                                    dropdownClass="item-sku-dropdown"
                                    on:select={(e) => handleShippingVariantSelect(idx, e)}
                                />
                                <input
                                    type="number"
                                    class="item-qty"
                                    min="1"
                                    placeholder="Qty"
                                    bind:value={item.quantity}
                                    required
                                />
                                <input
                                    type="number"
                                    class="item-price"
                                    min="0.01"
                                    step="0.01"
                                    placeholder="Sale Price"
                                    bind:value={item.salePrice}
                                    required
                                />
                                <button
                                    class="btn btn-remove"
                                    type="button"
                                    on:click={() => removeShippingOrderItem(idx)}
                                    disabled={$newShippingOrderForm.items.length === 1}>✕</button
                                >
                            </div>
                        {/each}
                        <button class="btn btn-add-item" type="button" on:click={addShippingOrderItem}
                            >＋ Add Item</button
                        >
                    </div>
                    <div class="modal-section">
                        <h4>Additional Info</h4>
                        <div class="modal-row">
                            <label>
                                <span>Shipping Address</span>
                                <input
                                    type="text"
                                    bind:value={$newShippingOrderForm.shippingAddress}
                                    placeholder="Street, City, State, Zip, Country"
                                />
                            </label>
                            <label>
                                <span>Shipping Cost</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    bind:value={$newShippingOrderForm.shippingCost}
                                    placeholder="USD"
                                />
                            </label>
                        </div>
                        <div class="modal-row">
                            <label class="checkbox-label">
                                <input type="checkbox" bind:checked={$newShippingOrderForm.freeShipping} />
                                <span>Free Shipping?</span>
                            </label>
                            <label>
                                <span>Shipping Method</span>
                                <input
                                    type="text"
                                    bind:value={$newShippingOrderForm.shippingMethod}
                                    placeholder="e.g. USPS Priority, In-Store Pickup"
                                />
                            </label>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-primary" type="submit">Submit Shipping Order</button>
                        <button class="btn btn-cancel" type="button" on:click={closeAddShippingOrderModal}
                            >Cancel</button
                        >
                    </div>
                </form>
            </div>
        </div>
    {/if}

    {#if $showAddBulkOrderModal}
        <div class="modal-overlay">
            <div class="modal modal-new-order">
                <div class="modal-header">
                    <h3>Add Many Orders</h3>
                    <button class="modal-close" on:click={closeAddBulkOrderModal}>✕</button>
                </div>
                <form class="modal-form" on:submit|preventDefault={submitNewBulkOrder}>
                    <div class="modal-section">
                        <div class="modal-row">
                            <label>
                                <span>Date</span>
                                <input type="date" bind:value={$newBulkOrderForm.orderDate} />
                            </label>
                        </div>
                    </div>
                    <div class="modal-section">
                        <h4>Order Items</h4>
                        <div class="modal-item-row modal-item-labels">
                            <span class="item-sku-label">SKU / Product</span>
                            <span class="item-qty-label">Qty</span>
                            <span class="item-price-label">Sale Price</span>
                            <span class="item-method-label">Payment Method</span>
                            <span class="item-holder-label">Money Holder</span>
                            <span></span>
                        </div>
                        {#each $newBulkOrderForm.items as item, idx}
                            <div class="modal-item-row">
                                <AutoComplete
                                    items={$productVariants}
                                    bind:value={item.sku}
                                    itemLabel={(v) => `${v.sku} - ${v.displayName} (${v.color}, ${v.size})`}
                                    itemValue={(v) => v.sku}
                                    placeholder="Search SKU or product name..."
                                    inputClass="item-sku"
                                    dropdownClass="item-sku-dropdown"
                                    on:select={(e) => handleBulkVariantSelect(idx, e)}
                                />
                                <input
                                    type="number"
                                    class="item-qty"
                                    min="1"
                                    placeholder="Qty"
                                    bind:value={item.quantity}
                                    required
                                />
                                <input
                                    type="number"
                                    class="item-price"
                                    min="0.01"
                                    step="0.01"
                                    placeholder="Sale Price"
                                    bind:value={item.salePrice}
                                    required
                                />
                                <select class="item-method" bind:value={item.paymentMethod}>
                                    {#each paymentMethods as method}
                                        <option value={method.value}>{method.label}</option>
                                    {/each}
                                </select>
                                <input
                                    type="text"
                                    class="item-holder"
                                    placeholder="Money Holder"
                                    bind:value={item.moneyHolder}
                                />
                                <button
                                    class="btn btn-remove"
                                    type="button"
                                    on:click={() => removeBulkOrderItem(idx)}
                                    disabled={$newBulkOrderForm.items.length === 1}>✕</button
                                >
                            </div>
                        {/each}
                        <button class="btn btn-add-item" type="button" on:click={addBulkOrderItem}>＋ Add Item</button>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-primary" type="submit">Submit Bulk Orders</button>
                        <button class="btn btn-cancel" type="button" on:click={closeAddBulkOrderModal}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    {/if}

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
                <h4>Profit</h4>
                <p>{formatCurrency($orderSummary.profit)}</p>
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

        <div class="filter-group">
            <label for="start-date">Start Date:</label>
            <input
                type="date"
                id="start-date"
                bind:value={$startDate}
                on:change={(e) => {
                    if (!$endDate || $endDate < e.target.value) {
                        endDate.set(e.target.value);
                    }
                }}
            />
        </div>
        <div class="filter-group">
            <label for="end-date">End Date:</label>
            <input type="date" id="end-date" bind:value={$endDate} min={$startDate} />
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
                            <td colspan="8" class="expanded-content">
                                <div transition:slide={{ duration: 300 }}>
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
                                                    <span class="detail-value"
                                                        >{order.staff?.name || order.staffId}</span
                                                    >
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
                                                                    (sum, item) =>
                                                                        sum + (item.cogs || 0) * item.quantity,
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
                                </div>
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
