<script>
    import { productStore } from "$lib/stores/product.store.js";

    const { sortKey, changeSort } = productStore;
</script>

<div class="sort-controls">
    <button on:click={() => changeSort("default")} class:active={$sortKey === "default"}> Newest </button>
    <button on:click={() => changeSort("price_asc")} class:active={$sortKey === "price_asc"}>
        Price: Low to High
    </button>
    <button on:click={() => changeSort("price_desc")} class:active={$sortKey === "price_desc"}>
        Price: High to Low
    </button>
</div>

<style>
    .sort-controls {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        flex-wrap: wrap;
    }
    button {
        padding: 0.5rem 1rem;
        border: 1px solid #ccc;
        background-color: #fff;
        cursor: pointer;
        border-radius: 999px;
        transition: all 0.2s ease;
    }
    button:hover {
        background-color: #f0f0f0;
        border-color: #999;
    }
    button.active {
        background-color: #333;
        color: #fff;
        border-color: #333;
    }
</style>
