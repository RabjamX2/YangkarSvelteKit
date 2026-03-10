<script>
    import { productStore } from "$lib/stores/product.store.js";

    const { allCategories, activeCategories, toggleCategory } = productStore;
</script>

<div class="filter-controls">
    {#each $allCategories as category (category.id)}
        <button on:click={() => toggleCategory(category.name)} class:active={$activeCategories.has(category.name)}>
            <span class="check-icon">{$activeCategories.has(category.name) ? "✓" : ""}</span>
            {category.name}
        </button>
    {/each}
</div>

<style>
    .filter-controls {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        flex-wrap: wrap;
    }
    button {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.5rem 1rem;
        border: 1px solid #ccc;
        background-color: #fff;
        cursor: pointer;
        border-radius: 999px;
        transition: all 0.2s ease;
        color: #888;
    }
    button:hover {
        background-color: #f0f0f0;
        border-color: #999;
        color: #333;
    }
    button.active {
        background-color: #333;
        color: #fff;
        border-color: #333;
    }
    .check-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 14px;
        font-size: 12px;
        flex-shrink: 0;
    }
</style>
