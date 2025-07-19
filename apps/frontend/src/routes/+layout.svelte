<script lang="ts">
    import './layout.css';

    export let data;
    const { user } = data;

    function handleLogout(event: Event) {
        event.preventDefault();
        fetch('http://localhost:3000/api/logout', {
            method: 'POST',
            credentials: 'include'
        }).then(() => {
            location.reload();
        });
    }
</script>

<nav class="navbar">
    <div class="nav-left">
        <a class="logo" href="/">Yangkar</a>
        <a class="nav-link" href="/products">Products</a>
        {#if user && user.role === 'ADMIN'}
            <a class="nav-link" href="/admin/add-product">Admin</a>
        {/if}
    </div>
    <div class="nav-right">
        {#if user}
            <span class="user-badge">Welcome, {user.username}!</span>
            <form class="logout-form" on:submit={handleLogout}>
                <button class="logout-btn">Log Out</button>
            </form>
        {:else}
            <a class="nav-link" href="/login">Login</a>
            <a class="nav-link signup" href="/signup">Sign Up</a>
        {/if}
    </div>
</nav>

<main>
    <slot />
</main>