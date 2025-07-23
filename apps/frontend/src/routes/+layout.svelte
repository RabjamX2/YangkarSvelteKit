<script lang="ts">
    import './layout.css';

    export let data;
    const { user } = data;

    let darkMode = false;

    // On mount, check cookie for dark mode preference
    if (typeof window !== 'undefined') {
        const match = document.cookie.match(/(^|;)\s*darkMode=([^;]*)/);
        if (match && match[2] === 'true') {
            darkMode = true;
            document.documentElement.classList.add('dark');
        }
    }

    function handleLogout(event: Event) {
        event.preventDefault();
        fetch('http://localhost:3000/api/logout', {
            method: 'POST',
            credentials: 'include'
        }).then(() => {
            location.reload();
        });
    }

    function toggleDarkMode() {
        darkMode = !darkMode;
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        // Set cookie for 1 year
        document.cookie = `darkMode=${darkMode}; path=/; max-age=31536000`;
    }
</script>

<nav class="navbar">
    <div class="nav-left">
        <a class="logo" href="/">Yangkar</a>
        <a class="nav-link" href="/products">Products</a>
    </div>
    <div class="nav-right">
        <button class="theme-toggle" on:click={toggleDarkMode} aria-label="Toggle dark mode">
            {#if darkMode}
                🌙
            {:else}
                ☀️
            {/if}
        </button>
        {#if user}
            <span class="user-badge">Welcome, {user.username}!</span>
            {#if user.role === 'ADMIN'}
                <a class="nav-link" href="/admin/add-product">Admin</a>
            {/if}
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