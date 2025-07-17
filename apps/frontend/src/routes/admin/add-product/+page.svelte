<script>
    import { enhance } from '$app/forms';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';

    // Protect the page on the client-side as a fallback
    onMount(() => {
        if ($page.data.user?.role !== 'ADMIN') {
            goto('/'); // Redirect non-admins to the homepage
        }
    });

    let message = '';
</script>

<svelte:head>
    <title>Add New Product</title>
</svelte:head>

<div class="container">
    <h1>Add New Product</h1>

    {#if $page.data.user?.role === 'ADMIN'}
        <form
            method="POST"
            action="http://localhost:3000/api/products"
            use:enhance={() => {
                return async ({ result }) => {
                    if (result.type === 'success' || result.type === 'redirect') {
                        message = 'Product added successfully!';
                    } else if (result.type === 'error') {
                        message = `Error: ${result.error.message}`;
                    }
                };
            }}
        >
            <label>
                <span>Product Name</span>
                <input name="name" type="text" required />
            </label>
            <label>
                <span>Description</span>
                <textarea name="description" required></textarea>
            </label>
            <label>
                <span>Price (in cents)</span>
                <input name="price" type="number" required />
            </label>
            <label>
                <span>Image URL</span>
                <input name="imageUrl" type="url" required />
            </label>
            <button type="submit">Add Product</button>
        </form>
        {#if message}
            <p class="message">{message}</p>
        {/if}
    {:else}
        <p class="error">You are not authorized to view this page.</p>
    {/if}
</div>

<style>
    .container { max-width: 600px; margin: 2rem auto; padding: 0 1rem; }
    form { display: flex; flex-direction: column; gap: 1rem; }
    label { display: flex; flex-direction: column; gap: 0.25rem; }
    input, textarea { padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; }
    button { padding: 0.75rem; background-color: #333; color: white; border: none; border-radius: 4px; cursor: pointer; }
    .message { margin-top: 1rem; }
    .error { color: red; }
</style>