<script>
    import { productStore } from "$lib/stores/product.store.js";

    const { allCategories, activeCategories, toggleCategory } = productStore;

    function safeToggleCategory(categoryName) {
        // Only allow toggle if more than one active, or if activating
        if ($activeCategories.has(categoryName)) {
            if ($activeCategories.size > 1) {
                toggleCategory(categoryName);
            }
            // else: do nothing, must keep at least one active
        } else {
            toggleCategory(categoryName);
        }
    }
</script>

<div class="filter-controls">
    {#each $allCategories as category (category.id)}
        <button on:click={() => safeToggleCategory(category.name)} class:active={$activeCategories.has(category.name)}>
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
        padding: 0.5rem 1rem;
        border: 1px solid #ccc;
        background-color: #fff;
        cursor: pointer;
        border-radius: 999px;
        transition: all 0.2s ease;
        text-decoration: line-through;
    }
    button:hover {
        background-color: #f0f0f0;
        border-color: #999;
    }
    button.active {
        background-color: #333;
        color: #fff;
        border-color: #333;
        text-decoration: none;
    }
</style>
