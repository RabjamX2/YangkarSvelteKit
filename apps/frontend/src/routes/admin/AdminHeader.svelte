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
                    <a class="nav-link" href="/admin/transactions/customer-orders">
                        <span class="nav-link-text">Transaction History</span>
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
                <div class="nav-item">
                    <a class="nav-link" href="/admin/image-upload">
                        <span class="nav-link-text">Image Upload</span>
                    </a>
                </div>
                <div class="nav-item">
                    <a class="nav-link" href="/admin/sync-images">
                        <span class="nav-link-text">Sync Images</span>
                    </a>
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

    @media (max-width: 900px) {
        .nav-list {
            gap: 0.5rem;
        }
    }
</style>
