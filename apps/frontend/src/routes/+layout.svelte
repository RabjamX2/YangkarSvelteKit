<script>
    // @ts-nocheck
    const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;
    import CartIcon from "$lib/components/CartIcon.svelte";
    import CartSidebar from "$lib/components/CartSidebar.svelte";
    import { isCartOpen, toggleCart } from "$lib/stores/cart.store.js";
    import { createAuthFetch } from "$lib/utils/csrf.js";
    import { goto } from "$app/navigation";
    import "./layout.css";

    export let data;
    let darkMode = false;
    let dropdownOpen = false;

    // On mount, check cookie for dark mode preference and set up event handlers
    if (typeof window !== "undefined") {
        const match = document.cookie.match(/(^|;)\s*darkMode=([^;]*)/);
        if (match && match[2] === "true") {
            darkMode = true;
            document.documentElement.classList.add("dark");
        }

        // Close dropdown on outside click
        window.addEventListener("click", (e) => {
            if (!(e.target.closest && e.target.closest(".user-dropdown"))) {
                dropdownOpen = false;
            }
        });

        // Add escape key listener for accessibility
        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && dropdownOpen) {
                dropdownOpen = false;
            }
        });
    }

    // Import auth store
    import { auth } from "$lib/stores/auth.store.js";
    import { logout } from "$lib/utils/api.js";

    function handleLogout(event) {
        event.preventDefault();

        // Get user info from auth store for logging
        const authData = $auth;
        console.log("Logging out user:", {
            username: authData.user?.username,
        });

        // Use the centralized logout function with a navigation callback
        // This ensures we have consistent logout behavior throughout the app
        logout(() => {
            console.log("Performing post-logout navigation");

            // Force a full page reload to ensure all state is reset properly
            // This is more reliable than goto() for ensuring the auth state is completely reset
            window.location.href = "/";
        }).then((success) => {
            if (!success) {
                console.warn("Logout had errors but navigation was still triggered");
            }
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
            <div class="user-dropdown" class:open={dropdownOpen}>
                {#if data.user || $auth.user}
                    <button
                        class="user-badge"
                        aria-haspopup="true"
                        aria-expanded={dropdownOpen}
                        aria-label="Open user menu"
                        on:click={() => (dropdownOpen = !dropdownOpen)}
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
                            ><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2" /><path
                                d="M4 20c0-2.21 3.582-4 8-4s8 1.79 8 4"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                            /></svg
                        >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            style="margin-left:4px;"
                            ><path
                                d="M6 8L10 12L14 8"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            /></svg
                        >
                    </button>
                    <div class="user-dropdown-menu">
                        <span class="dropdown-item username">{(data.user || $auth.user)?.username}</span>
                        {#if (data.user || $auth.user)?.role === "ADMIN"}
                            <a href="/admin">Admin Panel</a>
                            <div class="dropdown-divider"></div>
                        {/if}
                        <button on:click={handleLogout}>Log Out</button>
                    </div>
                {:else}
                    <button
                        class="user-badge"
                        aria-haspopup="true"
                        aria-expanded={dropdownOpen}
                        aria-label="Open user menu"
                        on:click={() => (dropdownOpen = !dropdownOpen)}
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
                            ><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2" /><path
                                d="M4 20c0-2.21 3.582-4 8-4s8 1.79 8 4"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                            /></svg
                        >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            style="margin-left:4px;"
                            ><path
                                d="M6 8L10 12L14 8"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            /></svg
                        >
                    </button>
                    <div class="user-dropdown-menu">
                        <a href="/login">Login</a>
                        <a href="/signup">Sign Up</a>
                    </div>
                {/if}
            </div>
            <button class="cart-button" on:click={toggleCart} aria-label="Open cart">
                <CartIcon />
            </button>
            <button class="theme-toggle" on:click={toggleDarkMode} aria-label="Toggle dark mode">
                {#if darkMode}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                            d="M12 3a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1zm7.071 2.929a1 1 0 0 1 0 1.414l-.707.707a1 1 0 1 1-1.414-1.414l.707-.707a1 1 0 0 1 1.414 0zm-14.142 0a1 1 0 0 1 1.414 0l.707.707A1 1 0 0 1 5.636 8.05l-.707-.707a1 1 0 0 1 0-1.414zM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm-8 4a1 1 0 0 1 1 1 1 1 0 1 1-2 0 1 1 0 0 1 1-1zm16 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM5.636 15.95a1 1 0 0 1 1.414 1.414l-.707.707a1 1 0 0 1-1.414-1.414l.707-.707zm12.728 0l.707.707a1 1 0 0 1-1.414 1.414l-.707-.707a1 1 0 0 1 1.414-1.414zM12 19a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1z"
                            fill="currentColor"
                        />
                    </svg>
                {:else}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                            d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm-6.25-5.37A8 8 0 0 0 12 20V4a8 8 0 0 0-6.25 12.63z"
                            fill="currentColor"
                        />
                    </svg>
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
                <div class="nav-item">
                    <a class="nav-link" href="/products?sort=default&category=Phone+Cases">
                        <span class="nav-link-text">Phone Cases</span>
                    </a>
                </div>
            </div>
        </nav>
    </div>
</header>

<main>
    <slot />
</main>
