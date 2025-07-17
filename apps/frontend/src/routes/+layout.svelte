<script>
    import { page } from '$app/stores';
    import { enhance } from '$app/forms';

    // The user data is passed from the server hook to the page data
    $: user = $page.data.user;

    function handleLogout(event) {
        event.preventDefault();
        fetch('http://localhost:3000/api/logout', {
            method: 'POST',
            credentials: 'include'
        }).then(() => {
            location.reload(); // Reload to update UI
        });
    }
</script>

<nav>
    <a href="/">Home</a>
    <a href="/products">Products</a>
    {#if user}
        {#if user.role === 'ADMIN'}
            <a href="/admin/add-product">Admin</a>
        {/if}
        <span>Welcome, {user.username}!</span>
        <form on:submit={handleLogout}>
            <button>Log Out</button>
        </form>
    {:else}
        <a href="/login">Login</a>
        <a href="/signup">Sign Up</a>
    {/if}
    
</nav>

<main>
    <slot />
</main>

<style>
    nav { display: flex; gap: 1rem; padding: 1rem; border-bottom: 1px solid #ccc; }
</style>