<script>
    import { enhance } from "$app/forms";
    /** @type {import('./$types').ActionData} */
    export let form;
</script>

<svelte:head>
    <title>Sign Up</title>
</svelte:head>

<div class="auth-container">
    <h2>Create an Account</h2>
    <form method="POST" use:enhance>
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

        <button type="submit" class="submit-btn">Sign Up</button>
    </form>
    <p class="auth-switch">
        Already have an account? <a href="/login">Log in</a>
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
</style>
