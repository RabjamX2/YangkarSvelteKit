<script>
    // @ts-nocheck
    import { enhance } from "$app/forms";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { hashPassword, isWebCryptoAvailable } from "$lib/utils/password.js";
    import { auth } from "$lib/stores/auth.store.js";

    export let form;
    export let data;

    // Track login progress
    let isSubmitting = false;

    // Handle successful login with onMount to avoid timing issues
    onMount(() => {
        if (form?.success) {
            // Use window.location.href instead of goto() to force a full page reload
            // This ensures the layout will get the updated user state
            setTimeout(() => {
                window.location.href = "/";
            }, 100);
        }

        // Check if we're coming from successful signup
        const url = new URL(window.location.href);
        if (url.searchParams.get("signup") === "success") {
            data.signupSuccess = true;
        }
    });

    // Client-side login handler
    import { apiFetch } from "$lib/utils/api.js";
    let username = "";
    let password = "";
    let errorMsg = "";

    async function handleLogin(event) {
        event.preventDefault();
        isSubmitting = true;
        errorMsg = "";

        let finalPassword = password;
        let passwordHashMethod = undefined;
        if (password && isWebCryptoAvailable()) {
            try {
                finalPassword = await hashPassword(password.toString());
                passwordHashMethod = "sha256-client";
            } catch (cryptoError) {
                console.warn("Client-side hashing failed:", cryptoError);
            }
        }

        try {
            const response = await apiFetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username,
                    password: finalPassword,
                    passwordHashMethod,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                errorMsg = data.error || "Login failed.";
                isSubmitting = false;
                return;
            }

            // Get user data from response - only parse the body once
            const userData = await response.json();

            if (userData.user) {
                console.log("Login successful, cookies:", document.cookie);

                // Update auth store directly instead of full page reload
                auth.setAuth({
                    user: userData.user,
                    csrfToken: userData.csrfToken,
                });

                // Check if cookies were set properly
                const hasAccessToken = document.cookie.includes("access_token");
                const hasRefreshToken = document.cookie.includes("refresh_token");
                console.log("Cookie status - Access token:", hasAccessToken, "Refresh token:", hasRefreshToken);

                // Use SvelteKit navigation for better performance
                goto("/");
            } else {
                // Fallback to old behavior if response structure is unexpected
                window.location.href = "/";
            }
        } catch (err) {
            errorMsg = "Network error. Please try again.";
        }
        isSubmitting = false;
    }
</script>

<svelte:head>
    <title>Login</title>
</svelte:head>

<div class="auth-container">
    <h2>Login to Your Account</h2>
    <form on:submit={handleLogin}>
        {#if form?.error}
            <p class="error">
                {Array.isArray(form.error)
                    ? form.error.join(" ")
                    : typeof form.error === "object" && form.error !== null
                      ? JSON.stringify(form.error)
                      : form.error}
            </p>
        {/if}

        {#if form?.data && typeof form.data === "string"}
            <!-- Try to parse data field if it's a stringified array/object -->
            <p class="error">
                {(() => {
                    if (form.data.startsWith("[") || form.data.startsWith("{")) {
                        try {
                            const parsed = JSON.parse(form.data);
                            if (Array.isArray(parsed) && parsed[1]) {
                                return parsed[1]; // Return the second item (error message)
                            } else {
                                return JSON.stringify(parsed);
                            }
                        } catch (e) {
                            return form.data;
                        }
                    } else {
                        return form.data;
                    }
                })()}
            </p>
        {/if}

        {#if data.success}
            <p class="success">{data.success}</p>
        {/if}

        {#if data.signupSuccess}
            <p class="success">Account created successfully! Please log in with your new credentials.</p>
        {/if}

        <div class="form-group">
            <label for="username">Username</label>
            <input id="username" type="text" name="username" bind:value={username} required />
        </div>

        <div class="form-group">
            <label for="password">Password</label>
            <input id="password" type="password" name="password" bind:value={password} required />
        </div>

        <div class="form-actions">
            <a href="/forgot-password" class="forgot-password-link">Forgot Password?</a>
            <button type="submit" class="submit-btn" disabled={isSubmitting}>
                {isSubmitting ? "Logging in..." : "Login"}
            </button>
        </div>
    </form>
    {#if errorMsg}
        <p class="error">{errorMsg}</p>
    {/if}
    <p class="auth-switch">
        Don't have an account? <a href="/signup">Sign up</a>
    </p>
</div>

<style>
    .auth-container {
        max-width: 400px;
        margin: 4rem auto;
        padding: 2rem;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        box-shadow: var(--color-shadow);
    }
    h2 {
        text-align: center;
        margin-bottom: 1.5rem;
    }
    .form-group {
        margin-bottom: 1rem;
    }
    label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
    }
    input {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-sizing: border-box;
    }
    .form-actions {
        margin-top: 1.5rem;
    }
    .forgot-password-link {
        display: block;
        text-align: right;
        font-size: 0.875rem;
        color: var(--color-link-hover);
        text-decoration: none;
        margin-bottom: 1rem;
    }
    .submit-btn {
        width: 100%;
        padding: 0.75rem;
        border: none;
        border-radius: 4px;
        background-color: var(--color-signup-bg);
        color: var(--color-signup);
        font-size: 1rem;
        font-weight: bold;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .submit-btn:hover {
        background-color: var(--color-signup-bg-hover);
    }
    .error {
        color: #e53e3e;
        background-color: #fef2f2;
        border: 1px solid #fecaca;
        padding: 0.75rem;
        border-radius: 4px;
        margin-bottom: 1rem;
        text-align: center;
    }
    .success {
        color: #059669;
        background-color: #ecfdf5;
        border: 1px solid #a7f3d0;
        padding: 0.75rem;
        border-radius: 4px;
        margin-bottom: 1rem;
        text-align: center;
    }
    .auth-switch {
        text-align: center;
        margin-top: 1.5rem;
    }
    .auth-switch a {
        color: var(--color-link-hover);
        text-decoration: none;
    }
</style>
