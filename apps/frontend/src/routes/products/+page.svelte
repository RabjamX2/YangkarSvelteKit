<script>
    export let data;
    import './products.css';
</script>

<svelte:head>
    <title>Our Products</title>
</svelte:head>

<div class="container">
    <h1>Our Products</h1>

    {#if data.error}
        <p class="error">{data.error}</p>
    {:else if data.products.length === 0}
        <p>No products found.</p>
    {:else}
        <div class="product-grid">
            {#each data.products as product}
                <div class="product-card">
                    <img src={product.imageUrl} alt={product.name} /> 
                    <div class="card-content">
                        <h2>{product.name}</h2>
                        <p>{product.description}</p>
                        <p class="price">${(product.price / 100).toFixed(2)}</p>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    @import './products.css';
</style>