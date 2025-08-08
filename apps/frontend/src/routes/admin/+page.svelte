<svelte:head>
    <title>Admin Dashboard</title>
</svelte:head>

<div class="admin-dashboard-nav">
    <h1>Admin Dashboard</h1>
    <ul>
        <li><a href="/admin/products">Product List</a></li>
        <li><a href="/admin/transactions">Transaction History</a></li>
        <li><a href="/admin/checkout">Checkout</a></li>
    </ul>
</div>

<style>
    .admin-dashboard-nav {
        max-width: 600px;
        margin: 4rem auto;
        background: var(--color-bg, #fff);
        border-radius: 16px;
        box-shadow: 0 4px 24px 0 rgba(0, 0, 0, 0.07);
        padding: 2rem 2rem 2.5rem 2rem;
        text-align: center;
    }
    .admin-dashboard-nav h1 {
        margin-bottom: 2rem;
        font-size: 2.2rem;
        color: var(--color-link-hover, #6366f1);
    }
    .admin-dashboard-nav ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    .admin-dashboard-nav li {
        margin: 1.2rem 0;
    }
    .admin-dashboard-nav a {
        font-size: 1.3rem;
        color: var(--color-link, #222);
        text-decoration: none;
        padding: 0.7rem 2.2rem;
        border-radius: 8px;
        background: var(--color-link-bg-hover, #f1f5f9);
        transition:
            background 0.2s,
            color 0.2s;
        display: inline-block;
    }
    .admin-dashboard-nav a:hover {
        background: var(--color-link-hover, #6366f1);
        color: #fff;
    }
</style>
