<script>
    import { enhance } from '$app/forms';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';

    import './add-product.css';

    export let data;

    // The 'user' object returned from your load function
    // is available here inside 'data'.
    const { user } = data;

    // Protect the page on the client-side as a fallback
    onMount(() => {
        if (user?.role !== 'ADMIN') {
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

    {#if user?.role === 'ADMIN'}
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