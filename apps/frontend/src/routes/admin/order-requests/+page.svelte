<script>
    // @ts-nocheck
    import { onMount } from "svelte";
    import { writable, derived } from "svelte/store";
    import AdminHeader from "$lib/components/AdminHeader.svelte";
    import { apiFetch } from "$lib/utils/api.js";
    import { auth } from "$lib/stores/auth.store.js";
    import { fly, fade } from "svelte/transition";

    export let data;

    $: if (data?.csrfToken) {
        if ($auth.csrfToken !== data.csrfToken) {
            auth.setCsrfToken(data.csrfToken);
        }
    }

    const requests = writable([]);
    const loading = writable(true);
    const error = writable("");
    const statusFilter = writable("ALL");
    const expandedId = writable(null);

    // Admin notes editing
    let editingNotesId = null;
    let editingNotesValue = "";

    const filtered = derived([requests, statusFilter], ([$requests, $statusFilter]) => {
        if ($statusFilter === "ALL") return $requests;
        return $requests.filter((r) => r.status === $statusFilter);
    });

    async function loadRequests() {
        loading.set(true);
        error.set("");
        try {
            const res = await apiFetch("/api/order-requests");
            if (!res.ok) throw new Error("Failed to load order requests.");
            const json = await res.json();
            requests.set(json.data);
        } catch (e) {
            error.set(e.message);
        } finally {
            loading.set(false);
        }
    }

    async function updateStatus(id, status) {
        try {
            const res = await apiFetch(`/api/order-requests/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            if (!res.ok) throw new Error("Failed to update status.");
            const json = await res.json();
            requests.update((list) => list.map((r) => (r.id === id ? json.data : r)));
        } catch (e) {
            alert(e.message);
        }
    }

    function startEditNotes(req) {
        editingNotesId = req.id;
        editingNotesValue = req.adminNotes || "";
    }

    function cancelEditNotes() {
        editingNotesId = null;
        editingNotesValue = "";
    }

    async function saveNotes(id) {
        try {
            const res = await apiFetch(`/api/order-requests/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ adminNotes: editingNotesValue }),
            });
            if (!res.ok) throw new Error("Failed to save notes.");
            const json = await res.json();
            requests.update((list) => list.map((r) => (r.id === id ? json.data : r)));
            editingNotesId = null;
        } catch (e) {
            alert(e.message);
        }
    }

    async function deleteRequest(id) {
        if (!confirm("Delete this order request? This cannot be undone.")) return;
        try {
            const res = await apiFetch(`/api/order-requests/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete.");
            requests.update((list) => list.filter((r) => r.id !== id));
        } catch (e) {
            alert(e.message);
        }
    }

    function toggleExpand(id) {
        expandedId.update((cur) => (cur === id ? null : id));
    }

    function formatDate(dateStr) {
        return new Date(dateStr).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function calcTotal(items) {
        if (!Array.isArray(items)) return "0.00";
        return items
            .reduce((sum, item) => sum + parseFloat(item.salePrice || "0") * (item.quantity || 1), 0)
            .toFixed(2);
    }

    onMount(loadRequests);
</script>

<svelte:head>
    <title>Order Requests – Admin</title>
</svelte:head>

<AdminHeader />

<div class="page">
    <div class="page-header">
        <h1>Order Requests</h1>
        <button class="refresh-btn" on:click={loadRequests} aria-label="Refresh">
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M23 4v6h-6M1 20v-6h6" /><path
                    d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
                />
            </svg>
            Refresh
        </button>
    </div>

    <!-- Filters -->
    <div class="filters">
        {#each ["ALL", "PENDING", "ACCEPTED", "REJECTED"] as s}
            <button class="filter-btn" class:active={$statusFilter === s} on:click={() => statusFilter.set(s)}>
                {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                {#if s !== "ALL"}
                    <span class="filter-count">
                        {$requests.filter((r) => r.status === s).length}
                    </span>
                {/if}
            </button>
        {/each}
    </div>

    {#if $loading}
        <p class="state-msg">Loading…</p>
    {:else if $error}
        <p class="state-msg error">{$error}</p>
    {:else if $filtered.length === 0}
        <p class="state-msg">No order requests found.</p>
    {:else}
        <div class="requests-list">
            {#each $filtered as req (req.id)}
                <div
                    class="request-card"
                    class:status-pending={req.status === "PENDING"}
                    class:status-accepted={req.status === "ACCEPTED"}
                    class:status-rejected={req.status === "REJECTED"}
                >
                    <!-- Card header -->
                    <div class="card-top">
                        <div class="card-meta">
                            <span class="req-id">#{req.id}</span>
                            <span class="status-badge status-{req.status.toLowerCase()}">{req.status}</span>
                            <span class="req-date">{formatDate(req.createdAt)}</span>
                        </div>
                        <div class="card-customer">
                            <strong>{req.customerName || "Anonymous"}</strong>
                            {#if req.customerPhone}<span class="contact-info">· {req.customerPhone}</span>{/if}
                            {#if req.customerEmail}<span class="contact-info">· {req.customerEmail}</span>{/if}
                            {#if req.customerInstagram}<span class="contact-info">· @{req.customerInstagram}</span>{/if}
                        </div>
                        <div class="card-actions">
                            <button
                                class="expand-btn"
                                on:click={() => toggleExpand(req.id)}
                                aria-label="Toggle details"
                            >
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2.5"
                                    stroke-linecap="round"
                                >
                                    {#if $expandedId === req.id}
                                        <path d="M18 15l-6-6-6 6" />
                                    {:else}
                                        <path d="M6 9l6 6 6-6" />
                                    {/if}
                                </svg>
                            </button>
                        </div>
                    </div>

                    <!-- Summary row -->
                    <div class="card-summary">
                        <span class="item-count"
                            >{Array.isArray(req.items) ? req.items.length : 0} item{Array.isArray(req.items) &&
                            req.items.length !== 1
                                ? "s"
                                : ""}</span
                        >
                        <span class="total-price">Total: ${calcTotal(req.items)}</span>
                    </div>

                    <!-- Expanded details -->
                    {#if $expandedId === req.id}
                        <div class="card-body" transition:fly={{ y: -6, duration: 200 }}>
                            <!-- Items table -->
                            <table class="items-table">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Variant</th>
                                        <th class="num">Qty</th>
                                        <th class="num">Unit Price</th>
                                        <th class="num">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each req.items as item}
                                        <tr>
                                            <td>
                                                <a
                                                    href="/products/{item.skuBase}"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    class="item-link">{item.name}</a
                                                >
                                                <span class="item-sku">{item.sku}</span>
                                            </td>
                                            <td
                                                >{item.color || "—"}{#if item.size}, {item.size}{/if}</td
                                            >
                                            <td class="num">{item.quantity}</td>
                                            <td class="num">${parseFloat(item.salePrice || 0).toFixed(2)}</td>
                                            <td class="num"
                                                >${(parseFloat(item.salePrice || 0) * item.quantity).toFixed(2)}</td
                                            >
                                        </tr>
                                    {/each}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colspan="4" class="num total-label">Order Total</td>
                                        <td class="num total-value">${calcTotal(req.items)}</td>
                                    </tr>
                                </tfoot>
                            </table>

                            <!-- Customer notes -->
                            {#if req.notes}
                                <div class="notes-section">
                                    <p class="notes-label">Customer notes</p>
                                    <p class="notes-text">{req.notes}</p>
                                </div>
                            {/if}

                            <!-- Admin notes -->
                            <div class="notes-section">
                                <p class="notes-label">Admin notes</p>
                                {#if editingNotesId === req.id}
                                    <textarea
                                        class="admin-notes-input"
                                        bind:value={editingNotesValue}
                                        rows="3"
                                        placeholder="Add internal notes here…"
                                    ></textarea>
                                    <div class="notes-actions">
                                        <button class="btn-sm btn-secondary" on:click={cancelEditNotes}>Cancel</button>
                                        <button class="btn-sm btn-primary" on:click={() => saveNotes(req.id)}
                                            >Save Notes</button
                                        >
                                    </div>
                                {:else}
                                    <p class="notes-text" class:placeholder={!req.adminNotes}>
                                        {req.adminNotes || "No notes yet."}
                                    </p>
                                    <button class="btn-sm btn-secondary" on:click={() => startEditNotes(req)}>
                                        {req.adminNotes ? "Edit Notes" : "Add Notes"}
                                    </button>
                                {/if}
                            </div>

                            <!-- Status actions -->
                            <div class="action-row">
                                {#if req.status !== "ACCEPTED"}
                                    <button
                                        class="action-btn accept-btn"
                                        on:click={() => updateStatus(req.id, "ACCEPTED")}
                                    >
                                        <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="2.5"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg
                                        >
                                        Accept
                                    </button>
                                {/if}
                                {#if req.status !== "PENDING"}
                                    <button
                                        class="action-btn pending-btn"
                                        on:click={() => updateStatus(req.id, "PENDING")}
                                    >
                                        <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            ><circle cx="12" cy="12" r="10" /><polyline
                                                points="12 6 12 12 16 14"
                                            /></svg
                                        >
                                        Mark Pending
                                    </button>
                                {/if}
                                {#if req.status !== "REJECTED"}
                                    <button
                                        class="action-btn reject-btn"
                                        on:click={() => updateStatus(req.id, "REJECTED")}
                                    >
                                        <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="2.5"
                                            stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg
                                        >
                                        Reject
                                    </button>
                                {/if}
                                <button class="action-btn delete-btn" on:click={() => deleteRequest(req.id)}>
                                    <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        ><polyline points="3 6 5 6 21 6" /><path
                                            d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
                                        /><path d="M10 11v6M14 11v6" /><path
                                            d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
                                        /></svg
                                    >
                                    Delete
                                </button>
                            </div>
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .page {
        max-width: 900px;
        margin: 2rem auto;
        padding: 0 1rem;
    }

    .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1.5rem;
    }

    .page-header h1 {
        font-size: 1.75rem;
        margin: 0;
    }

    .refresh-btn {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.5rem 1rem;
        background: none;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        color: var(--color-text);
        font-size: 0.875rem;
        cursor: pointer;
        transition: background-color 0.15s;
    }
    .refresh-btn:hover {
        background-color: var(--color-link-bg-hover);
    }

    .filters {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
    }

    .filter-btn {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.45rem 0.875rem;
        border: 1px solid var(--color-border);
        border-radius: 20px;
        background: none;
        color: var(--color-text-light);
        font-size: 0.875rem;
        cursor: pointer;
        transition: all 0.15s;
    }
    .filter-btn:hover {
        background: var(--color-link-bg-hover);
        color: var(--color-text);
    }
    .filter-btn.active {
        background: var(--color-signup-bg);
        color: var(--color-signup);
        border-color: var(--color-signup-bg);
    }

    .filter-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 18px;
        height: 18px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.12);
        font-size: 0.75rem;
        font-weight: 600;
        padding: 0 4px;
    }
    .filter-btn.active .filter-count {
        background: rgba(255, 255, 255, 0.25);
    }

    .state-msg {
        text-align: center;
        padding: 3rem;
        color: var(--color-text-light);
    }
    .state-msg.error {
        color: var(--color-danger);
    }

    .requests-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .request-card {
        border: 1px solid var(--color-border);
        border-radius: 10px;
        overflow: hidden;
        background: var(--color-bg);
        transition: box-shadow 0.15s;
    }
    .request-card:hover {
        box-shadow: var(--color-shadow);
    }
    .request-card.status-pending {
        border-left: 3px solid var(--status-pending-color, #856404);
    }
    .request-card.status-accepted {
        border-left: 3px solid var(--status-received-color, #155724);
    }
    .request-card.status-rejected {
        border-left: 3px solid var(--order-cancelled-color, #b91c1c);
    }

    .card-top {
        display: flex;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 0.5rem;
        padding: 1rem 1.25rem 0.5rem;
    }

    .card-meta {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        flex-wrap: wrap;
        flex: 1;
    }

    .req-id {
        font-size: 0.8rem;
        color: var(--color-text-light);
        font-family: monospace;
    }

    .req-date {
        font-size: 0.8rem;
        color: var(--color-text-light);
    }

    .status-badge {
        display: inline-block;
        padding: 0.2rem 0.6rem;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }
    .status-pending {
        background: rgba(133, 100, 4, 0.12);
        color: var(--status-pending-color, #856404);
    }
    .status-accepted {
        background: rgba(21, 87, 36, 0.12);
        color: var(--status-received-color, #155724);
    }
    .status-rejected {
        background: rgba(185, 28, 28, 0.12);
        color: var(--order-cancelled-color, #b91c1c);
    }

    .card-customer {
        font-size: 0.9rem;
        color: var(--color-text);
        flex: 2;
    }
    .contact-info {
        color: var(--color-text-light);
        font-size: 0.875rem;
    }

    .card-actions {
        margin-left: auto;
    }

    .expand-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 6px;
        border: 1px solid var(--color-border);
        background: none;
        color: var(--color-text-light);
        cursor: pointer;
        transition: background-color 0.15s;
    }
    .expand-btn:hover {
        background: var(--color-link-bg-hover);
    }

    .card-summary {
        display: flex;
        gap: 1rem;
        padding: 0 1.25rem 0.875rem;
        font-size: 0.875rem;
        color: var(--color-text-light);
    }
    .total-price {
        font-weight: 600;
        color: var(--color-text);
    }

    .card-body {
        border-top: 1px solid var(--color-border);
        padding: 1.25rem;
    }

    /* Items table */
    .items-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
        margin-bottom: 1.25rem;
    }
    .items-table th {
        text-align: left;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--color-text-light);
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid var(--color-border);
    }
    .items-table td {
        padding: 0.6rem 0.75rem;
        border-bottom: 1px solid var(--color-border);
        color: var(--color-text);
    }
    .items-table tfoot td {
        border-top: 2px solid var(--color-border);
        border-bottom: none;
    }
    .items-table .num {
        text-align: right;
    }
    .item-link {
        display: block;
        font-weight: 500;
        color: var(--color-link);
        text-decoration: none;
    }
    .item-link:hover {
        color: var(--color-link-hover);
        text-decoration: underline;
    }
    .item-sku {
        display: block;
        font-size: 0.75rem;
        color: var(--color-text-light);
        font-family: monospace;
    }
    .total-label {
        font-weight: 700;
    }
    .total-value {
        font-weight: 700;
        font-size: 1rem;
    }

    /* Notes */
    .notes-section {
        margin-bottom: 1.25rem;
    }
    .notes-label {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-light);
        margin: 0 0 0.35rem;
    }
    .notes-text {
        font-size: 0.875rem;
        color: var(--color-text);
        background: var(--color-link-bg-hover);
        border: 1px solid var(--color-border);
        border-radius: 6px;
        padding: 0.6rem 0.875rem;
        margin: 0 0 0.5rem;
        white-space: pre-wrap;
    }
    .notes-text.placeholder {
        color: var(--color-text-light);
        font-style: italic;
    }
    .admin-notes-input {
        width: 100%;
        padding: 0.6rem 0.875rem;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-bg);
        color: var(--color-text);
        font-size: 0.875rem;
        font-family: inherit;
        resize: vertical;
        margin-bottom: 0.5rem;
        box-sizing: border-box;
    }
    .admin-notes-input:focus {
        outline: none;
        border-color: var(--color-link-hover);
        box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.15);
    }
    .notes-actions {
        display: flex;
        gap: 0.5rem;
    }

    /* Small buttons */
    .btn-sm {
        padding: 0.4rem 0.875rem;
        border-radius: 6px;
        font-size: 0.8rem;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.15s;
        border: 1px solid var(--color-border);
    }
    .btn-secondary {
        background: none;
        color: var(--color-text);
    }
    .btn-secondary:hover {
        background: var(--color-link-bg-hover);
    }
    .btn-primary {
        background: var(--color-signup-bg);
        color: var(--color-signup);
        border-color: var(--color-signup-bg);
    }
    .btn-primary:hover {
        background: var(--color-signup-bg-hover);
    }

    /* Action row */
    .action-row {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .action-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.5rem 0.875rem;
        border-radius: 6px;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid transparent;
        transition: all 0.15s;
    }

    .accept-btn {
        background: rgba(21, 87, 36, 0.1);
        color: var(--status-received-color, #155724);
        border-color: var(--status-received-color, #155724);
    }
    .accept-btn:hover {
        background: rgba(21, 87, 36, 0.2);
    }

    .pending-btn {
        background: rgba(133, 100, 4, 0.1);
        color: var(--status-pending-color, #856404);
        border-color: var(--status-pending-color, #856404);
    }
    .pending-btn:hover {
        background: rgba(133, 100, 4, 0.2);
    }

    .reject-btn {
        background: rgba(185, 28, 28, 0.08);
        color: var(--order-cancelled-color, #b91c1c);
        border-color: var(--order-cancelled-color, #b91c1c);
    }
    .reject-btn:hover {
        background: rgba(185, 28, 28, 0.15);
    }

    .delete-btn {
        background: none;
        color: var(--color-text-light);
        border-color: var(--color-border);
        margin-left: auto;
    }
    .delete-btn:hover {
        color: var(--color-danger);
        border-color: var(--color-danger);
        background: rgba(229, 62, 62, 0.08);
    }
</style>
