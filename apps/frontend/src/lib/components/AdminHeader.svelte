<script>
    let showMoreTools = false;

    function toggleMoreTools() {
        showMoreTools = !showMoreTools;
    }

    function closeDropdown() {
        showMoreTools = false;
    }
</script>

<header class="admin-header-section">
    <div class="header-nav">
        <nav class="nav">
            <div class="nav-list">
                <div class="nav-item">
                    <a class="nav-link" href="/admin/products">
                        <span class="nav-link-text">Product List</span>
                    </a>
                </div>
                <div class="nav-item">
                    <a class="nav-link" href="/admin/image-upload">
                        <span class="nav-link-text">Image Upload</span>
                    </a>
                </div>
                <div class="nav-item">
                    <a class="nav-link" href="/admin/transactions/customer-orders">
                        <span class="nav-link-text">Customer Orders</span>
                    </a>
                </div>
                <div class="nav-item">
                    <a class="nav-link" href="/admin/transactions/purchase-orders">
                        <span class="nav-link-text">Purchase Orders</span>
                    </a>
                </div>
                <div class="nav-item">
                    <a class="nav-link" href="/admin/transactions/stock-changes">
                        <span class="nav-link-text">Stock Changes</span>
                    </a>
                </div>
                <div class="nav-item">
                    <a class="nav-link" href="/admin/transactions/inventory-batches">
                        <span class="nav-link-text">Inventory Batches</span>
                    </a>
                </div>
                <div class="nav-item">
                    <a class="nav-link" href="/admin/checkout">
                        <span class="nav-link-text">Checkout</span>
                    </a>
                </div>
                <div class="nav-item dropdown">
                    <button class="nav-link dropdown-toggle" on:click={toggleMoreTools}>
                        <span class="nav-link-text">More Tools</span>
                        <span class="dropdown-arrow">{showMoreTools ? "▲" : "▼"}</span>
                    </button>
                    {#if showMoreTools}
                        <div class="dropdown-menu">
                            <a class="dropdown-item" href="/admin/sellers" on:click={closeDropdown}> Sellers </a>
                        </div>
                    {/if}
                </div>
            </div>
        </nav>
    </div>
</header>

<main>
    <slot />
</main>

<style>
    .header-nav {
        width: 100%;
        background: var(--color-nav-bg);
        /* border-top: 1px solid var(--color-border);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02); */
    }

    .nav {
        width: 100%;
        display: flex;
        justify-content: center;
    }

    .nav-list {
        display: flex;
        flex-direction: row;
        gap: 2rem;
        padding: 0.5rem 0;
    }

    .nav-item {
        display: flex;
        align-items: center;
    }

    .nav-link {
        color: var(--color-link);
        text-decoration: none;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        transition:
            background 0.2s,
            color 0.2s;
    }

    .nav-link-text {
        font-weight: 700;
        font-size: var(--font-size-small);
        text-transform: uppercase;
    }

    .nav-link:hover {
        background: var(--color-link-bg-hover);
        color: var(--color-link-hover);
    }

    /* Dropdown styles */
    .dropdown {
        position: relative;
    }

    .dropdown-toggle {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: none;
        border: none;
        cursor: pointer;
    }

    .dropdown-arrow {
        font-size: 0.7rem;
        transition: transform 0.2s;
    }

    .dropdown-menu {
        position: absolute;
        top: 100%;
        left: 0;
        margin-top: 0.5rem;
        background: var(--color-nav-bg);
        border: 1px solid var(--color-border);
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        min-width: 180px;
        z-index: 1000;
        overflow: hidden;
    }

    .dropdown-item {
        display: block;
        padding: 0.75rem 1rem;
        color: var(--color-link);
        text-decoration: none;
        font-weight: 700;
        font-size: var(--font-size-small);
        text-transform: uppercase;
        transition:
            background 0.2s,
            color 0.2s;
    }

    .dropdown-item:hover {
        background: var(--color-link-bg-hover);
        color: var(--color-link-hover);
    }

    @media (max-width: 900px) {
        .nav-list {
            gap: 0.5rem;
        }
    }
</style>
