<script>
    // @ts-nocheck
    // Import createAuthFetch utility for making authenticated requests
    import { createAuthFetch } from "$lib/utils/csrf";
    import { onMount } from "svelte";

    // State variables
    let debugResult = null;
    let loading = false;
    let error = null;

    // Test the cookies
    async function testCookies() {
        loading = true;
        error = null;

        try {
            // Create authenticated fetch
            const fetchAuth = createAuthFetch();

            // Call the debug endpoint
            const response = await fetchAuth(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/debug-set-cookie`);

            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }

            // Parse the response
            const data = await response.json();
            debugResult = data;
        } catch (err) {
            console.error("Error testing cookies:", err);
            error = err.message;
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        // Automatically test on page load
        testCookies();
    });
</script>

<svelte:head>
    <title>Cookie Debug</title>
</svelte:head>

<div class="container">
    <h1>Cookie Debug Page</h1>

    <button on:click={testCookies} disabled={loading}>
        {loading ? "Testing..." : "Test Cookies Again"}
    </button>

    {#if error}
        <div class="error">
            <h3>Error:</h3>
            <p>{error}</p>
        </div>
    {/if}

    {#if debugResult}
        <div class="results">
            <h3>Cookie Status:</h3>
            <pre>{JSON.stringify(debugResult, null, 2)}</pre>
        </div>
    {/if}
</div>

<style>
    .container {
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem;
    }

    button {
        padding: 0.75rem 1rem;
        background-color: #4299e1;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
        margin: 1rem 0;
    }

    button:disabled {
        background-color: #a0aec0;
        cursor: not-allowed;
    }

    .error {
        background-color: #fed7d7;
        border: 1px solid #f56565;
        padding: 1rem;
        border-radius: 4px;
        margin: 1rem 0;
    }

    .results {
        background-color: #e6fffa;
        border: 1px solid #4fd1c5;
        padding: 1rem;
        border-radius: 4px;
        margin: 1rem 0;
    }

    pre {
        white-space: pre-wrap;
        word-break: break-all;
        background-color: #f7fafc;
        padding: 1rem;
        border-radius: 4px;
        overflow: auto;
    }
</style>
