<script>
    import { createEventDispatcher } from "svelte";
    import { slide } from "svelte/transition";

    export let activeTab = "standard"; // 'standard', 'shipping', 'bulk'

    const dispatch = createEventDispatcher();

    function setTab(tab) {
        activeTab = tab;
        dispatch("tabChange", tab);
    }
</script>

<div class="order-tabs" transition:slide={{ duration: 300 }}>
    <button class="tab-button {activeTab === 'standard' ? 'active' : ''}" on:click={() => setTab("standard")}>
        Standard Order
    </button>
    <button class="tab-button {activeTab === 'shipping' ? 'active' : ''}" on:click={() => setTab("shipping")}>
        Shipping Order
    </button>
    <button class="tab-button {activeTab === 'bulk' ? 'active' : ''}" on:click={() => setTab("bulk")}>
        Bulk Orders
    </button>
</div>

<style>
    .order-tabs {
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
        border-bottom: 1px solid #e1e1e1;
        padding-bottom: 10px;
    }

    .tab-button {
        background: none;
        border: none;
        padding: 8px 16px;
        font-size: 15px;
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.2s;
        color: inherit;
    }

    .tab-button:hover {
        background-color: #f0f0f0;
    }

    .tab-button.active {
        background-color: #e6f7ff;
        color: #1890ff;
        border-bottom: 2px solid #1890ff;
        font-weight: 500;
    }

    /* Dark mode styles */
    :global(.dark) .order-tabs {
        border-bottom-color: var(--color-border, #3a3f45);
    }

    :global(.dark) .tab-button {
        color: var(--color-text, #e0e7ef);
    }

    :global(.dark) .tab-button:hover {
        background-color: #2d3033;
    }

    :global(.dark) .tab-button.active {
        background-color: #2d3652;
        color: var(--color-primary-light, #60a5fa);
        border-bottom-color: var(--color-primary-light, #60a5fa);
    }
</style>
