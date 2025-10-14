<script>
    import { createEventDispatcher } from "svelte";
    import AutoComplete from "$lib/components/AutoComplete.svelte";
    import { productVariants } from "$lib/stores/productVariants.js";

    export let formData = {
        orderDate: "",
        items: [{ sku: "", quantity: 1, salePrice: 0, paymentMethod: "CASH", moneyHolder: "" }],
    };
    export let paymentMethods = [];

    const dispatch = createEventDispatcher();

    function addBulkOrderItem() {
        formData = {
            ...formData,
            items: [...formData.items, { sku: "", quantity: 1, salePrice: 0, paymentMethod: "CASH", moneyHolder: "" }],
        };
    }

    function removeBulkOrderItem(index) {
        formData = {
            ...formData,
            items: formData.items.filter((_, idx) => idx !== index),
        };
    }

    function handleVariantSelect(idx, event) {
        const selected = event.detail.item;
        const items = [...formData.items];
        items[idx].sku = selected.sku;
        items[idx].productVariantId = selected.id; // Add this line to include the ID
        items[idx].displayName = selected.displayName;
        items[idx].color = selected.color;
        items[idx].size = selected.size;
        items[idx].salePrice = selected.salePrice || items[idx].salePrice;
        formData = { ...formData, items };
    }

    function submitForm() {
        dispatch("submit", formData);
    }

    function cancel() {
        dispatch("cancel");
    }
</script>

<div class="order-form-container">
    <div class="form-header">
        <h3>Create Bulk Orders</h3>
        <button class="btn btn-text" on:click={cancel}>Cancel</button>
    </div>
    <form on:submit|preventDefault={submitForm}>
        <div class="form-section">
            <div class="form-row">
                <label>
                    <span>Order Date</span>
                    <input type="date" bind:value={formData.orderDate} />
                </label>
            </div>
            <p class="help-text">
                Create multiple orders with the same date but different items, payment methods, and money holders.
            </p>
        </div>

        <div class="form-section">
            <h4>Order Items</h4>
            <div class="bulk-item-header">
                <span>Product SKU</span>
                <span>Qty</span>
                <span>Sale Price</span>
                <span>Payment Method</span>
                <span>Money Holder</span>
                <span></span>
            </div>
            {#each formData.items as item, idx}
                <div class="bulk-item-row">
                    <AutoComplete
                        items={$productVariants}
                        bind:value={item.sku}
                        itemLabel={(v) => `${v.sku} - ${v.displayName} (${v.color}, ${v.size})`}
                        itemValue={(v) => v.sku}
                        placeholder="Search SKU or product name..."
                        inputClass="item-sku"
                        dropdownClass="item-sku-dropdown"
                        on:select={(e) => handleVariantSelect(idx, e)}
                    />
                    <input type="number" min="1" placeholder="Qty" bind:value={item.quantity} />
                    <input type="number" min="0.01" step="0.01" placeholder="Sale Price" bind:value={item.salePrice} />
                    <select bind:value={item.paymentMethod}>
                        <option value="" disabled>Select payment</option>
                        {#each paymentMethods as method}
                            <option value={method.value}>{method.label}</option>
                        {/each}
                    </select>
                    <input type="text" placeholder="Money Holder" bind:value={item.moneyHolder} />
                    <button
                        class="btn btn-remove"
                        type="button"
                        on:click={() => removeBulkOrderItem(idx)}
                        disabled={formData.items.length === 1}>✕</button
                    >
                </div>
            {/each}
            <button class="btn btn-add-item" type="button" on:click={addBulkOrderItem}>＋ Add Item</button>
        </div>

        <div class="form-actions">
            <button class="btn btn-primary" type="submit">Create Bulk Orders</button>
        </div>
    </form>
</div>

<style>
    .order-form-container {
        background-color: #f9f9f9;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .form-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        border-bottom: 1px solid #e1e1e1;
        padding-bottom: 10px;
    }

    /* Dark mode styles */
    :global(.dark) .order-form-container {
        background-color: var(--color-nav-bg, #23232a);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    :global(.dark) .form-header {
        border-bottom-color: var(--color-border, #374151);
    }

    .help-text {
        font-size: 14px;
        color: #666;
        margin-top: -5px;
        margin-bottom: 15px;
    }

    :global(.dark) .help-text {
        color: var(--dark-text-color-secondary, #a0a0a0);
    }

    .form-section {
        margin-bottom: 20px;
    }

    .form-row {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 15px;
        margin-bottom: 15px;
    }

    label {
        display: flex;
        flex-direction: column;
    }

    label span {
        font-size: 14px;
        margin-bottom: 5px;
        color: #555;
    }

    :global(.dark) label span {
        color: var(--dark-text-color-secondary, #c5c5c5);
    }

    input,
    select {
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
    }

    :global(.dark) input,
    :global(.dark) select {
        background-color: var(--dark-background-tertiary, #32323a);
        border-color: var(--dark-border-color, #374151);
        color: var(--dark-text-color, #e5e5e5);
    }

    .bulk-item-header {
        display: grid;
        grid-template-columns: 1.5fr 70px 100px 120px 120px 40px;
        gap: 10px;
        margin-bottom: 8px;
        font-size: 14px;
        color: #555;
    }

    :global(.dark) .bulk-item-header {
        color: var(--dark-text-color-secondary, #c5c5c5);
    }

    .bulk-item-row {
        display: grid;
        grid-template-columns: 1.5fr 70px 100px 120px 120px 40px;
        gap: 10px;
        margin-bottom: 10px;
        align-items: center;
    }

    .btn-add-item {
        background-color: transparent;
        border: 1px dashed #999;
        color: #555;
        padding: 8px;
        border-radius: 4px;
        margin-top: 10px;
        cursor: pointer;
        width: fit-content;
    }

    :global(.dark) .btn-add-item {
        border-color: #666;
        color: var(--dark-text-color-secondary, #c5c5c5);
    }

    .btn-remove {
        background-color: transparent;
        border: none;
        color: #ff4d4f;
        cursor: pointer;
        font-size: 16px;
    }

    :global(.dark) .btn-remove {
        color: #ff6b6b;
    }

    .form-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 20px;
    }

    .btn-text {
        background: none;
        border: none;
        color: #555;
        cursor: pointer;
        padding: 8px 12px;
    }

    :global(.dark) .btn-text {
        color: var(--dark-text-color-secondary, #c5c5c5);
    }

    :global(.dark) .btn-primary {
        background-color: var(--color-primary, #3b82f6);
        color: white;
    }
</style>
