<script>
    export let data;
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
    .container {
        max-width: 1200px;
        margin: 2rem auto;
        padding: 0 1rem;
    }
    .product-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 1.5rem;
    }
    .product-card {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        transition: transform 0.2s;
    }
    .product-card:hover {
        transform: translateY(-5px);
    }
    .product-card img {
        width: 100%;
        height: 200px;
        object-fit: cover;
    }
    .card-content {
        padding: 1rem;
    }
    .card-content h2 {
        font-size: 1.2rem;
        margin: 0 0 0.5rem 0;
    }
    .card-content p {
        font-size: 0.9rem;
        color: #666;
        margin-bottom: 1rem;
    }
    .price {
        font-size: 1.1rem;
        font-weight: bold;
        color: #333;
    }
    .error {
        color: red;
    }
</style>