<script>
    import { productStore } from "$lib/stores/product.store.js";

    const { sortKey, changeSort, hideOutOfStock, toggleHideOutOfStock } = productStore;
</script>

<div class="sort-controls">
    <button on:click={() => changeSort("default")} class:active={$sortKey === "default"}> Newest </button>
    <button on:click={() => changeSort("price_asc")} class:active={$sortKey === "price_asc"}>
        Price: Low to High
    </button>
    <button on:click={() => changeSort("price_desc")} class:active={$sortKey === "price_desc"}>
        Price: High to Low
    </button>
    <label class="oos-toggle">
        <input type="checkbox" checked={$hideOutOfStock} on:change={toggleHideOutOfStock} />
        <span class="oos-checkmark">{$hideOutOfStock ? "✓" : ""}</span>
        Hide Out of Stock
    </label>
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
    .oos-toggle {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.5rem 1rem;
        border: 1px solid #ccc;
        border-radius: 999px;
        cursor: pointer;
        font-size: 1rem;
        user-select: none;
        transition: all 0.2s ease;
        background-color: #fff;
    }
    .oos-toggle:hover {
        background-color: #f0f0f0;
        border-color: #999;
    }
    .oos-toggle input {
        display: none;
    }
    .oos-checkmark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        border: 1.5px solid #999;
        border-radius: 4px;
        font-size: 12px;
        line-height: 1;
        background: #fff;
        color: #fff;
        transition: all 0.15s ease;
    }
    .oos-toggle:has(input:checked) {
        background-color: #333;
        color: #fff;
        border-color: #333;
    }
    .oos-toggle:has(input:checked) .oos-checkmark {
        background: #fff;
        border-color: #fff;
        color: #333;
    }
</style>
