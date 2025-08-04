<script>
    import { enhance } from "$app/forms";
    /** @type {import('./$types').ActionData} */
    export let form;
</script>

<svelte:head>
    <title>Reset Password</title>
</svelte:head>

<div class="auth-container">
    <h2>Choose a New Password</h2>

    {#if form?.success}
        <p class="success">
            Your password has been reset successfully! You can now <a href="/login">log in</a> with your new password.
        </p>
    {:else}
        <form method="POST" use:enhance>
            {#if form?.error}
                <p class="error">{form.error}</p>
            {/if}
            <div class="form-group">
                <label for="password">New Password</label>
                <input id="password" name="password" type="password" required />
            </div>
            <div class="form-group">
                <label for="passwordConfirm">Confirm New Password</label>
                <input id="passwordConfirm" name="passwordConfirm" type="password" required />
            </div>
            <button type="submit" class="submit-btn">Reset Password</button>
        </form>
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
    .success a {
        color: #2f855a;
        font-weight: bold;
    }
</style>
