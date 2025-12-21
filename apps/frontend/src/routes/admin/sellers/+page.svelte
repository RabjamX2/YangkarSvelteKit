<script>
    import { onMount } from "svelte";
    import AdminHeader from "$lib/components/AdminHeader.svelte";
    import { apiFetch } from "$lib/utils/api.js";
    import { auth } from "$lib/stores/auth.store.js";

    export let data;

    // Set CSRF token in auth store if available from layout
    $: if (data?.csrfToken && $auth.csrfToken !== data.csrfToken) {
        auth.setCsrfToken(data.csrfToken);
    }

    let sellers = [];
    let loading = true;
    let error = null;
    let showAddForm = false;
    let editingSeller = null;

    // Form fields
    let formData = {
        idString: "",
        name: "",
        tibetanName: "",
        contactPerson: "",
        contactMethod: "",
    };

    onMount(async () => {
        await loadSellers();
    });

    async function loadSellers() {
        try {
            loading = true;
            const response = await apiFetch("/api/sellers");
            if (!response.ok) throw new Error("Failed to load sellers");
            sellers = await response.json();
            error = null;
        } catch (err) {
            error = err instanceof Error ? err.message : String(err);
        } finally {
            loading = false;
        }
    }

    function openAddForm() {
        resetForm();
        editingSeller = null;
        showAddForm = true;
    }

    function openEditForm(seller) {
        formData = {
            idString: seller.idString,
            name: seller.name,
            tibetanName: seller.tibetanName || "",
            contactPerson: seller.contactPerson || "",
            contactMethod: seller.contactMethod || "",
        };
        editingSeller = seller;
        showAddForm = true;
    }

    function resetForm() {
        formData = {
            idString: "",
            name: "",
            tibetanName: "",
            contactPerson: "",
            contactMethod: "",
        };
    }

    function closeForm() {
        showAddForm = false;
        editingSeller = null;
        resetForm();
    }

    async function handleSubmit(e) {
        e.preventDefault();

        try {
            const url = editingSeller ? `/api/sellers/${editingSeller.id}` : "/api/sellers";
            const method = editingSeller ? "PUT" : "POST";

            const response = await apiFetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to save seller");
            }

            await loadSellers();
            closeForm();
        } catch (err) {
            error = err instanceof Error ? err.message : String(err);
        }
    }

    async function deleteSeller(seller) {
        if (!confirm(`Are you sure you want to delete ${seller.name}? This will fail if the seller has products.`)) {
            return;
        }

        try {
            const response = await apiFetch(`/api/sellers/${seller.id}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to delete seller");
            }

            await loadSellers();
        } catch (err) {
            error = err instanceof Error ? err.message : String(err);
        }
    }
</script>

<AdminHeader />

<div class="sellers-container">
    <div class="header-row">
        <h1>Sellers Management</h1>
        <button class="btn-primary" on:click={openAddForm}> Add New Seller </button>
    </div>

    {#if error}
        <div class="error">{error}</div>
    {/if}

    {#if loading}
        <p>Loading sellers...</p>
    {:else}
        <div class="sellers-list">
            {#if sellers.length === 0}
                <p>No sellers found.</p>
            {:else}
                {#each sellers as seller}
                    <div class="seller-card">
                        <div class="seller-header">
                            <h3>{seller.name}</h3>
                            <span class="seller-id">{seller.idString}</span>
                        </div>

                        <p class="detail">
                            <strong>ID:</strong>
                            {seller.id}
                        </p>

                        {#if seller.tibetanName}
                            <p class="tibetan-name">{seller.tibetanName}</p>
                        {/if}

                        {#if seller.contactPerson}
                            <p class="detail">
                                <strong>Contact:</strong>
                                {seller.contactPerson}
                            </p>
                        {/if}

                        {#if seller.contactMethod}
                            <p class="detail">
                                <strong>Method:</strong>
                                {seller.contactMethod}
                            </p>
                        {/if}

                        <p class="detail">
                            <strong>Products:</strong>
                            {seller._count.products}
                        </p>

                        <div class="card-actions">
                            <button class="btn-secondary" on:click={() => openEditForm(seller)}> Edit </button>
                            <button
                                class="btn-danger"
                                on:click={() => deleteSeller(seller)}
                                disabled={seller._count.products > 0}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                {/each}
            {/if}
        </div>
    {/if}
</div>

{#if showAddForm}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="modal-overlay" on:click={closeForm}>
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="modal" on:click|stopPropagation>
            <div class="modal-header">
                <h2>{editingSeller ? "Edit Seller" : "Add New Seller"}</h2>
                <button class="close-btn" on:click={closeForm}>×</button>
            </div>

            <form on:submit={handleSubmit}>
                <div class="form-group">
                    <label for="idString">
                        ID String <span class="required">*</span>
                    </label>
                    <input
                        type="text"
                        id="idString"
                        bind:value={formData.idString}
                        required
                        placeholder="e.g., bt, ptl"
                        disabled={editingSeller !== null}
                    />
                    <small>Unique identifier (lowercase, e.g., "bt")</small>
                </div>

                <div class="form-group">
                    <label for="name">
                        Name <span class="required">*</span>
                    </label>
                    <input
                        type="text"
                        id="name"
                        bind:value={formData.name}
                        required
                        placeholder="e.g., Beijing Tibetan"
                    />
                </div>

                <div class="form-group">
                    <label for="tibetanName">Tibetan Name</label>
                    <input type="text" id="tibetanName" bind:value={formData.tibetanName} placeholder="བོད་ཡིག" />
                </div>

                <div class="form-group">
                    <label for="contactPerson">Contact Person</label>
                    <input
                        type="text"
                        id="contactPerson"
                        bind:value={formData.contactPerson}
                        placeholder="Contact name"
                    />
                </div>

                <div class="form-group">
                    <label for="contactMethod">Contact Method</label>
                    <input
                        type="text"
                        id="contactMethod"
                        bind:value={formData.contactMethod}
                        placeholder="Phone, WeChat, etc."
                    />
                </div>

                <div class="form-actions">
                    <button type="button" class="btn-secondary" on:click={closeForm}> Cancel </button>
                    <button type="submit" class="btn-primary">
                        {editingSeller ? "Update" : "Create"} Seller
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

<style>
    .sellers-container {
        max-width: 1200px;
        margin: 2rem auto;
        padding: 0 1rem;
    }

    .header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
    }

    h1 {
        font-size: 2rem;
        margin: 0;
        color: var(--color-text);
    }

    .sellers-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 1.5rem;
    }

    .seller-card {
        background: var(--color-bg-card, white);
        border: 1px solid var(--color-border, #ddd);
        border-radius: 8px;
        padding: 1.5rem;
        transition: box-shadow 0.2s;
    }

    .seller-card:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .seller-header {
        display: flex;
        justify-content: space-between;
        align-items: start;
        margin-bottom: 0.75rem;
    }

    .seller-card h3 {
        margin: 0;
        color: var(--color-text);
        font-size: 1.25rem;
    }

    .seller-id {
        background: var(--color-primary, #007bff);
        color: white;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.875rem;
        font-weight: 600;
    }

    .tibetan-name {
        font-size: 1.1rem;
        margin: 0.5rem 0;
        color: var(--color-text-secondary, #666);
    }

    .detail {
        margin: 0.5rem 0;
        font-size: 0.9rem;
        color: var(--color-text);
    }

    .card-actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid var(--color-border, #eee);
    }

    .error {
        color: #dc3545;
        padding: 1rem;
        background: #f8d7da;
        border: 1px solid #f5c6cb;
        border-radius: 4px;
        margin-bottom: 1rem;
    }

    /* Buttons */
    .btn-primary,
    .btn-secondary,
    .btn-danger {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 4px;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }

    .btn-primary {
        background: var(--color-primary, #007bff);
        color: white;
    }

    .btn-primary:hover {
        background: var(--color-primary-dark, #0056b3);
    }

    .btn-secondary {
        background: var(--color-secondary, #6c757d);
        color: white;
    }

    .btn-secondary:hover {
        background: #5a6268;
    }

    .btn-danger {
        background: #dc3545;
        color: white;
    }

    .btn-danger:hover:not(:disabled) {
        background: #c82333;
    }

    .btn-danger:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* Modal */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .modal {
        background: var(--color-bg-card, white);
        border-radius: 8px;
        padding: 2rem;
        max-width: 500px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
    }

    .modal-header h2 {
        margin: 0;
        font-size: 1.5rem;
        color: var(--color-text);
    }

    .close-btn {
        background: none;
        border: none;
        font-size: 2rem;
        line-height: 1;
        cursor: pointer;
        color: var(--color-text-secondary, #666);
        padding: 0;
        width: 32px;
        height: 32px;
    }

    .close-btn:hover {
        color: var(--color-text);
    }

    /* Form */
    .form-group {
        margin-bottom: 1.25rem;
    }

    .form-group label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 600;
        color: var(--color-text);
    }

    .required {
        color: #dc3545;
    }

    .form-group input {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid var(--color-border, #ddd);
        border-radius: 4px;
        font-size: 1rem;
        background: var(--color-bg, white);
        color: var(--color-text);
    }

    .form-group input:focus {
        outline: none;
        border-color: var(--color-primary, #007bff);
    }

    .form-group input:disabled {
        background: var(--color-bg-disabled, #f5f5f5);
        cursor: not-allowed;
    }

    .form-group small {
        display: block;
        margin-top: 0.25rem;
        font-size: 0.875rem;
        color: var(--color-text-secondary, #666);
    }

    .form-actions {
        display: flex;
        gap: 1rem;
        justify-content: flex-end;
        margin-top: 2rem;
    }
</style>
