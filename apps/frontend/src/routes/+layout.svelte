<script lang="ts">
    import { PUBLIC_BACKEND_URL } from "$env/static/public";
    import CartIcon from "$lib/components/CartIcon.svelte";
    import CartSidebar from "$lib/components/CartSidebar.svelte";
    import { isCartOpen, toggleCart } from "$lib/stores/cart.store.js";
    import "./layout.css";

    export let data;

    let darkMode = false;

    // On mount, check cookie for dark mode preference
    if (typeof window !== "undefined") {
        const match = document.cookie.match(/(^|;)\s*darkMode=([^;]*)/);
        if (match && match[2] === "true") {
            darkMode = true;
            document.documentElement.classList.add("dark");
        }
    }

    function handleLogout(event: Event) {
        event.preventDefault();
        fetch(`${PUBLIC_BACKEND_URL}/api/logout`, {
            method: "POST",
            credentials: "include",
        }).then(() => {
            location.reload();
        });
    }

    function toggleDarkMode() {
        darkMode = !darkMode;
        if (darkMode) {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
        // Set cookie for 1 year
        document.cookie = `darkMode=${darkMode}; path=/; max-age=31536000`;
    }
</script>

{#if $isCartOpen}
    <CartSidebar />
{/if}

<header class="header-section">
    <!-- <div class="header-mobile">
        <figure>
            <img class="logo" src="/Logo/Circle Logo - Only Logo.png" alt="Logo" />
        </figure>
    </div> -->
    <div class="main-header">
        <div class="main-header-left">
            <!-- TODO: Maybe add language selection here -->
            <!-- <a class="nav-link" href="/">
                <span class="nav-link-text">Home</span>
            </a> -->
        </div>
        <figure class="header-logo">
            <img class="logo" src="/Logo/Logo Text - English Long.png" alt="Logo" />
        </figure>
        <div class="main-header-right">
            {#if data.user}
                <span class="user-badge">{data.user.username}</span>
                {#if data.user.role === "ADMIN"}
                    <a class="nav-link" href="/admin">Admin</a>
                {/if}
                <!-- <form class="logout-form" on:submit={handleLogout}>
                    <button class="logout-btn">Log Out</button>
                </form> -->
            {:else}
                <a class="nav-link" href="/login">Login</a>
                <a class="nav-link signup" href="/signup">Sign Up</a>
            {/if}
            <button class="icon-button" on:click={toggleCart} aria-label="Open cart">
                <CartIcon />
            </button>
            <button class="theme-toggle" on:click={toggleDarkMode} aria-label="Toggle dark mode">
                {#if darkMode}
                    🌙
                {:else}
                    ☀️
                {/if}
            </button>
        </div>
    </div>
    <div class="header-nav">
        <nav class="nav">
            <div class="nav-list">
                <div class="nav-item">
                    <a class="nav-link" href="/products?sort=default&category=Chupa%2CWonju">
                        <span class="nav-link-text">Clothing</span>
                    </a>
                </div>
                <!-- <div class="nav-item">
                    <a class="nav-link" href="/products/Accessories">
                        <span class="nav-link-text">Accessories</span>
                    </a>
                </div> -->
                <div class="nav-item">
                    <a class="nav-link" href="/products?sort=default&category=Jewelry">
                        <span class="nav-link-text">Jewelry</span>
                    </a>
                </div>
                <!-- <div class="nav-item">
                    <a class="nav-link" href="/products/PhoneCases">
                        <span class="nav-link-text">Phone Cases</span>
                    </a>
                </div> -->
            </div>
        </nav>
    </div>
</header>

<main>
    <slot />
</main>
