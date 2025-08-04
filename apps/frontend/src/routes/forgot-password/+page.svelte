<script>
    /** @type {import('./$types').ActionData} */
    export let form;
</script>

<svelte:head>
    <title>Forgot Password</title>
</svelte:head>

<div class="auth-container">
    <h2>Reset Your Password</h2>

    {#if form?.success}
        <p class="success">
            {form.message}
        </p>
        <p>Please check your terminal console (where the backend is running) for the password reset link.</p>
    {:else}
        <p class="instructions">Enter your email address and we will send you a link to reset your password.</p>
        <form method="POST">
            {#if form?.error}
                <p class="error">{form.error}</p>
            {/if}
            <div class="form-group">
                <label for="email">Email</label>
                <input id="email" name="email" type="email" required value={form?.email ?? ""} />
            </div>
            <button type="submit" class="submit-btn">Send Reset Link</button>
        </form>
    {/if}
    <p class="auth-switch">
        Remembered your password? <a href="/login">Log in</a>
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
        margin-bottom: 1rem;
    }
    .instructions {
        text-align: center;
        margin-bottom: 1.5rem;
        color: #666;
    }
    .form-group {
        margin-bottom: 1.5rem;
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
    .error,
    .success {
        padding: 0.75rem;
        border-radius: 4px;
        margin-bottom: 1rem;
        text-align: center;
    }
    .error {
        color: #e53e3e;
        background-color: #fef2f2;
        border: 1px solid #fecaca;
    }
    .success {
        color: #2f855a;
        background-color: #f0fff4;
        border: 1px solid #9ae6b4;
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
