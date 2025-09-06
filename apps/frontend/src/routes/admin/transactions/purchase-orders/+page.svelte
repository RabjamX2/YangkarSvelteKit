<script>
    // @ts-nocheck
    import { onMount } from "svelte";
    import { writable, derived } from "svelte/store";
    import "../transactionTable.css";

    const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;
    const purchaseOrders = writable([]);
    const expandedOrders = writable(new Set()); // Tracks which orders are expanded
    const checkedItems = writable({}); // Tracks checked state of each item { itemId: boolean }
    const editedQuantities = writable({}); // Tracks edited quantities per item { itemId: quantity }

    const loadingTransactions = writable(false);
    const errorTransactions = writable(null);

    // Derived store to compute whether all items in an order are checked
    const allItemsCheckedByOrder = derived([purchaseOrders, checkedItems], ([$purchaseOrders, $checkedItems]) => {
        const status = {};
        if ($purchaseOrders.length > 0) {
            for (const order of $purchaseOrders) {
                status[order.id] = order.items.every((item) => $checkedItems[item.id]);
            }
        }
        return status;
    });

    // Helper to include credentials for authentication
    const fetchAuth = (url, options = {}) => {
        const defaultOptions = {
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                ...options.headers,
            },
        };
        return fetch(url, { ...options, ...defaultOptions });
    };

    function toggleOrderExpansion(orderId) {
        expandedOrders.update((set) => {
            if (set.has(orderId)) {
                set.delete(orderId);
            } else {
                set.add(orderId);
            }
            return set;
        });
    }

    function handleItemCheck(itemId, isChecked) {
        checkedItems.update((checks) => {
            checks[itemId] = isChecked;
            return checks;
        });
    }

    function handleQuantityChange(itemId, value) {
        editedQuantities.update((quantities) => {
            quantities[itemId] = value;
            return quantities;
        });
    }

    async function updateItemQuantity(itemId, newQuantity) {
        try {
            const response = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/purchase-order-items/${itemId}/quantity`, {
                method: "POST",
                body: JSON.stringify({ quantityOrdered: Number(newQuantity) }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to update quantity");
            }
            // Update local store
            purchaseOrders.update((orders) => {
                for (const order of orders) {
                    for (const item of order.items) {
                        if (item.id === itemId) {
                            item.quantityOrdered = Number(newQuantity);
                        }
                    }
                }
                return orders;
            });
            editedQuantities.update((quantities) => {
                delete quantities[itemId];
                return quantities;
            });
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    // --- Function to mark an entire purchase order as received ---
    async function markAsReceived(orderId) {
        if (
            !confirm(
                "Are you sure you want to mark this entire order as received? This will add all items to inventory."
            )
        ) {
            return;
        }

        try {
            const response = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/receive-purchase-order/${orderId}`, {
                method: "POST",
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to receive purchase order");
            }

            const updatedOrder = await response.json();

            // Update the local store to reflect the change immediately
            purchaseOrders.update((orders) =>
                orders.map((order) => (order.id === orderId ? { ...order, status: updatedOrder.status } : order))
            );
        } catch (error) {
            console.error("Error receiving purchase order:", error);
            alert(`Error: ${error.message}`);
        }
    }

    onMount(async () => {
        loadingTransactions.set(true);
        errorTransactions.set(null);
        try {
            const response = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/purchase-orders`);
            if (!response.ok) {
                console.log(response);
                throw new Error("Failed to fetch purchase orders.");
            }
            const result = await response.json();
            const sortedOrders = result.data.sort((a, b) => {
                if (a.status === "Pending" && b.status !== "Pending") return -1;
                if (a.status !== "Pending" && b.status === "Pending") return 1;
                return 0;
            });
            purchaseOrders.set(sortedOrders);
        } catch (err) {
            errorTransactions.set(err.message);
        } finally {
            loadingTransactions.set(false);
        }
    });
</script>

<div class="transaction-container">
    <h1>Purchase Orders</h1>

    {#if $loadingTransactions}
        <p>Loading...</p>
    {:else if $errorTransactions}
        <p class="error">{$errorTransactions}</p>
    {:else if $purchaseOrders.length === 0}
        <p>No purchase orders found.</p>
    {:else}
        <table class="transaction-table">
            <thead>
                <tr>
                    <th></th>
                    <!-- For expand button -->
                    <th>Batch Number</th>
                    <th>Ship Date</th>
                    <th>Arrival Date</th>
                    <th>Total Items</th>
                    <th>Total Cost (USD)</th>
                    <th>hasArrived</th>
                </tr>
            </thead>
            <tbody>
                {#each $purchaseOrders as order (order.id)}
                    {@const allItemsChecked = $allItemsCheckedByOrder[order.id]}
                    <tr class="main-row" on:click={() => toggleOrderExpansion(order.id)}>
                        <td>
                            <button class="expand-btn">{$expandedOrders.has(order.id) ? "▼" : "►"}</button>
                        </td>
                        <td>{order.batchNumber}</td>
                        <td>{order.shipDate ? new Date(order.shipDate).toLocaleDateString() : "-"}</td>
                        <td>{order.arrivalDate ? new Date(order.arrivalDate).toLocaleDateString() : "-"}</td>
                        <td>{order.items.reduce((sum, item) => sum + item.quantityOrdered, 0)}</td>
                        <td>
                            ${order.items
                                .reduce((sum, item) => sum + item.quantityOrdered * parseFloat(item.costPerItemUsd), 0)
                                .toFixed(2)}
                        </td>
                        <td>
                            <span
                                class="status"
                                class:status-pending={order.hasArrived}
                                class:status-received={!order.hasArrived}
                            >
                                {order.hasArrived}
                            </span>
                        </td>
                        <td>
                            {#if order.hasArrived}
                                <span class="action-placeholder">✔ Received</span>
                            {:else}
                                <button class="receive-btn" on:click|stopPropagation={() => markAsReceived(order.id)}>
                                    Mark as Received
                                </button>
                            {/if}
                        </td>
                    </tr>
                    {#if $expandedOrders.has(order.id)}
                        <tr class="details-row">
                            <td colspan="8">
                                <div class="item-details-container">
                                    <h4>Items in Batch Number {order.batchNumber}</h4>
                                    <table class="nested-table">
                                        <thead>
                                            <tr>
                                                <th>SKU</th>
                                                <th>Name</th>
                                                <th>Color</th>
                                                <th>Size</th>
                                                <th>Quantity</th>
                                                <th>Cost/Item</th>
                                                <th>Verified</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {#each order.items as item (item.id)}
                                                <tr>
                                                    <td>{item.variant?.sku}</td>
                                                    <td>{item.variant?.product?.name}</td>
                                                    <td>{item.variant?.color}</td>
                                                    <td>{item.variant?.size}</td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={$editedQuantities[item.id] ?? item.quantityOrdered}
                                                            on:input={(e) =>
                                                                handleQuantityChange(item.id, e.currentTarget.value)}
                                                            style="width: 70px;"
                                                        />
                                                        <button
                                                            class="update-qty-btn"
                                                            on:click={() =>
                                                                updateItemQuantity(
                                                                    item.id,
                                                                    $editedQuantities[item.id] ?? item.quantityOrdered
                                                                )}
                                                            disabled={($editedQuantities[item.id] ??
                                                                item.quantityOrdered) == item.quantityOrdered}
                                                            >Update</button
                                                        >
                                                    </td>
                                                    <td>${parseFloat(item.costPerItemUsd).toFixed(2)}</td>
                                                    <td>
                                                        <input
                                                            type="checkbox"
                                                            checked={$checkedItems[item.id] || false}
                                                            on:change={(e) =>
                                                                handleItemCheck(item.id, e.currentTarget.checked)}
                                                            on:click|stopPropagation
                                                        />
                                                    </td>
                                                </tr>
                                            {/each}
                                        </tbody>
                                    </table>
                                </div>
                            </td>
                        </tr>
                    {/if}
                {/each}
            </tbody>
        </table>
    {/if}
</div>

<style>
    /* Layout and table structure */
    .transaction-container {
        padding: 2rem;
        background: var(--color-bg);
        color: var(--color-link);
    }
    .transaction-table {
        width: 100%;
        border-collapse: collapse;
        background: var(--color-bg);
        box-shadow: var(--color-shadow);
        margin-bottom: 2rem;
    }
    .transaction-table th,
    .transaction-table td {
        text-align: left;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--color-border);
        font-size: 1rem;
    }
    .transaction-table th {
        background: var(--color-nav-bg);
        font-weight: 600;
        letter-spacing: 0.5px;
    }
    .main-row {
        cursor: pointer;
        transition: background 0.2s;
    }
    .main-row:hover {
        background-color: var(--color-link-bg-hover);
    }
    .expand-btn {
        background: none;
        border: none;
        font-size: 1.2em;
        cursor: pointer;
        color: var(--color-link);
        padding: 0;
    }
    .details-row > td {
        padding: 0;
        background-color: var(--color-bg);
    }
    .item-details-container {
        padding: 1.5rem 2rem;
    }
    .nested-table {
        width: 100%;
        border-collapse: collapse;
        background: var(--color-bg);
        margin-top: 0.5rem;
    }
    .nested-table th,
    .nested-table td {
        text-align: left;
        padding: 8px;
        border-bottom: 1px solid var(--color-border);
        color: var(--color-link);
        font-size: 0.95em;
    }
    .nested-table th {
        background: var(--color-nav-bg);
        font-weight: 500;
    }

    /* Buttons */
    .receive-btn {
        background-color: var(--color-signup-bg);
        color: var(--color-signup);
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.95em;
        font-weight: 500;
        transition:
            background-color 0.2s,
            opacity 0.2s;
        outline: none;
    }
    .receive-btn:hover:not(:disabled) {
        background-color: var(--color-signup-bg-hover);
    }
    .receive-btn:disabled {
        background-color: #cccccc;
        cursor: not-allowed;
        opacity: 0.7;
    }

    /* Status badges */
    .status {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 12px;
        font-weight: bold;
        font-size: 0.85em;
        letter-spacing: 0.5px;
        min-width: 80px;
        text-align: center;
    }
    .status-pending {
        background-color: var(--status-pending-bg, #fff3cd);
        color: var(--status-pending-color, #856404);
    }
    .status-received {
        background-color: var(--status-received-bg, #d4edda);
        color: var(--status-received-color, #155724);
    }

    /* Action placeholder */
    .action-placeholder {
        color: var(--status-received-color, #155724);
        font-weight: bold;
        font-size: 1em;
    }

    /* Accessibility improvements */
    .expand-btn:focus {
        outline: 2px solid var(--color-link-hover);
    }
    .receive-btn:focus {
        outline: 2px solid var(--color-signup-bg-hover);
    }

    .update-qty-btn {
        margin-left: 8px;
        background-color: var(--color-signup-bg);
        color: var(--color-signup);
        border: none;
        padding: 4px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9em;
        transition:
            background-color 0.2s,
            opacity 0.2s;
    }
    .update-qty-btn:disabled {
        background-color: #cccccc;
        cursor: not-allowed;
        opacity: 0.7;
    }
</style>
