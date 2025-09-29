<script>
    // @ts-nocheck
    import { enhance } from "$app/forms";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { hashPassword, isWebCryptoAvailable } from "$lib/utils/password.js";

    /** @type {import('./$types').ActionData} */
    export let form;
    /** @type {import('./$types').PageData} */
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
    });

    // Enhanced form handler with client-side password hashing
    function handlePasswordHash() {
        return async ({ formData }) => {
            isSubmitting = true;

            try {
                // Check if Web Crypto API is available
                const password = formData.get("password");
                if (password && isWebCryptoAvailable()) {
                    try {
                        // Hash the password with SHA-256 before sending
                        const hashedPassword = await hashPassword(password.toString());
                        formData.set("password", hashedPassword);
                        formData.set("passwordHashMethod", "sha256-client");
                    } catch (cryptoError) {
                        console.warn("Client-side hashing failed:", cryptoError);
                        // Continue with unhashed password - server will handle it
                    }
                } else if (!isWebCryptoAvailable()) {
                    console.warn("Web Crypto API not available - using server-side hashing only");
                }
            } catch (error) {
                console.error("Form enhancement error:", error);
            }

            // Return a callback for post-submission handling
            return ({ update, result }) => {
                isSubmitting = false;

                if (result?.type === "success") {
                    // Force a full page reload instead of client-side navigation
                    // This ensures that the root layout gets the latest user data
                    setTimeout(() => {
                        window.location.href = "/";
                    }, 100);
                }
            };
        };
    }
</script>

<svelte:head>
    <title>Login</title>
</svelte:head>

<div class="auth-container">
    <h2>Login to Your Account</h2>
    <form method="POST" use:enhance={handlePasswordHash()}>
        {#if form?.error}
            <p class="error">{form.error}</p>
        {/if}

        {#if data.success}
            <p class="success">{data.success}</p>
        {/if}

        <div class="form-group">
            <label for="username">Username</label>
            <input id="username" type="text" name="username" value={form?.username ?? ""} required />
        </div>

        <div class="form-group">
            <label for="password">Password</label>
            <input id="password" type="password" name="password" required />
        </div>

        <div class="form-actions">
            <a href="/forgot-password" class="forgot-password-link">Forgot Password?</a>
            <button type="submit" class="submit-btn" disabled={isSubmitting}>
                {isSubmitting ? "Logging in..." : "Login"}
            </button>
        </div>
    </form>
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
