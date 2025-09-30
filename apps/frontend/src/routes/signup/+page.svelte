<script>
    // @ts-nocheck
    import { enhance } from "$app/forms";
    import { onMount } from "svelte";
    import { hashPassword } from "$lib/utils/password.js";
    import { goto } from "$app/navigation";

    /** @type {import('./$types').ActionData} */
    export let form;

    // Track form submission state
    let isSubmitting = false;

    // Check if we have success on mount
    onMount(() => {
        if (form?.success) {
            console.log("Signup successful! Will redirect in 2 seconds...");
            // Auto-redirect to login after a short delay
            setTimeout(() => {
                console.log("Redirecting to login now...");
                goto("/login?signup=success");
            }, 2000); // 2 second delay to show the success message before redirect
        }
    });

    // Simple form enhancement with password hashing
    function handlePasswordHash() {
        // Return the enhance function (compatible with use:enhance)
        return async ({ formData }) => {
            console.log("Form submission starting");
            isSubmitting = true;

            try {
                // Get the password
                const password = formData.get("password")?.toString();

                if (password) {
                    try {
                        console.log("Hashing password");
                        const hashedPassword = await hashPassword(password);
                        console.log("Password hashed successfully, length:", hashedPassword.length);

                        // Replace the password in the form data
                        formData.set("password", hashedPassword);
                        formData.set("passwordHashMethod", "sha256-client");

                        // Debug log (without showing the actual password)
                        console.log("FormData updated with hashed password");
                    } catch (error) {
                        console.error("Password hashing failed:", error);
                    }
                } else {
                    console.warn("No password found in form data");
                }
            } catch (error) {
                console.error("Form enhancement error:", error);
            }

            // Handle the result after form submission
            return ({ result, update }) => {
                isSubmitting = false;

                if (result.type === "success") {
                    console.log("Form submitted successfully", result);

                    // Update the form with result data
                    update({ reset: false });

                    // Try to redirect directly from here
                    if (result.data && result.data.success) {
                        console.log("Success detected in form result, will redirect soon...");
                        setTimeout(() => {
                            console.log("Redirecting to login page...");
                            goto("/login");
                        }, 2000);
                    }
                } else if (result.type === "failure") {
                    console.error("Form submission failed:", result.data);
                }
            };
        };
    }
</script>

<svelte:head>
    <title>Sign Up</title>
</svelte:head>

<div class="auth-container">
    <h2>Create an Account</h2>
    {#if form?.success}
        <div class="success">
            <p>{form.message || "Account created successfully! You will be redirected to the login page..."}</p>
            <a href="/login" class="login-btn">Go to Login Now</a>
        </div>
    {:else}
        <form method="POST" use:enhance={handlePasswordHash()}>
            {#if form?.error}
                <p class="error">{form.error}</p>
            {/if}

            <div class="form-group">
                <label for="username">Username</label>
                <input
                    id="username"
                    name="username"
                    type="text"
                    value={form?.username ?? ""}
                    required
                    aria-invalid={form?.errors?.username ? "true" : undefined}
                />
                {#if form?.errors?.username}
                    <p class="error-message">{form.errors.username}</p>
                {/if}
            </div>

            <div class="form-group">
                <label for="email">Email</label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    value={form?.email ?? ""}
                    required
                    aria-invalid={form?.errors?.email ? "true" : undefined}
                />
                {#if form?.errors?.email}
                    <p class="error-message">{form.errors.email}</p>
                {/if}
            </div>

            <div class="form-group">
                <label for="password">Password</label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    aria-invalid={form?.errors?.password ? "true" : undefined}
                />
                {#if form?.errors?.password}
                    <p class="error-message">{form.errors.password}</p>
                {/if}
            </div>

            <button type="submit" class="submit-btn" disabled={isSubmitting}>
                {isSubmitting ? "Creating Account..." : "Sign Up"}
            </button>
        </form>
        <p class="auth-switch">
            Already have an account? <a href="/login">Log in</a>
        </p>
    {/if}
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
    .error-message {
        color: #e53e3e;
        font-size: 0.875rem;
        margin-top: 0.25rem;
    }
    .auth-switch {
        text-align: center;
        margin-top: 1.5rem;
    }
    .auth-switch a {
        color: var(--color-link-hover);
        text-decoration: none;
    }
    .success {
        color: #059669;
        background-color: #ecfdf5;
        border: 1px solid #a7f3d0;
        padding: 1.5rem;
        border-radius: 4px;
        margin-bottom: 1.5rem;
        text-align: center;
    }
    .login-btn {
        display: inline-block;
        margin-top: 1rem;
        padding: 0.75rem 1.5rem;
        background-color: var(--color-signup-bg);
        color: var(--color-signup);
        text-decoration: none;
        border-radius: 4px;
        font-weight: bold;
        transition: background-color 0.2s;
    }
    .login-btn:hover {
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
    .error-message {
        color: #e53e3e;
        font-size: 0.875rem;
        margin-top: 0.25rem;
        margin-bottom: 0;
    }
</style>
