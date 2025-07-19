<script>
    // The `form` prop contains the data returned from the server action
    // if it fails.
    /** @type {import('./$types').ActionData} */
    export let form;
</script>

<!-- No need for {#if user} here, the redirect will handle it -->

<!-- Use method="POST" to trigger the server action -->
<form method="POST">
    <div>
        <label for="username">Username</label>
        <input 
            type="text" 
            name="username" 
            id="username" 
            value={form?.username ?? ''} 
            required 
        />
    </div>
    <div>
        <label for="password">Password</label>
        <input type="password" name="password" id="password" required />
    </div>

    <!-- Display the error message from the form action -->
    {#if form?.error}
        <p style="color:red">{form.error}</p>
    {/if}

    <button type="submit">Login</button>
</form>