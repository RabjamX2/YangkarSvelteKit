<script>
    import { onMount } from "svelte";
    import { productStore } from "$lib/stores/product.store.js";
    import ProductFilters from "$lib/components/ProductFilters.svelte";
    import ProductSort from "$lib/components/ProductSort.svelte";
    import ProductGrid from "$lib/components/ProductGrid.svelte";

    export let data;

    // Initialize the store with the server-loaded data
    productStore.initialize(data);

    // This reactive statement ensures that if the user navigates
    // (e.g., clicks back/forward), the store is re-initialized with the new page data.
    $: productStore.initialize(data);
</script>

<svelte:head>
    <title>Products</title>
</svelte:head>

<div class="controls-row">
    <ProductFilters />
    <ProductSort />
</div>

<ProductGrid />

<style>
    .controls-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        padding: 15px;
        margin-right: auto;
        margin-left: auto;
        max-width: 1920px;
    }
</style>
