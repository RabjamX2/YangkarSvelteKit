<script>
    import { createEventDispatcher } from "svelte";
    import AutoComplete from "$lib/components/AutoComplete.svelte";
    import { productVariants } from "$lib/stores/productVariants.js";

    export let formData = {
        customerName: "",
        customerPhone: "",
        moneyHolder: "",
        paymentMethod: "",
        orderDate: "",
        items: [{ sku: "", quantity: 1, salePrice: 0 }],
    };
    export let paymentMethods = [];

    const dispatch = createEventDispatcher();

    function addOrderItem() {
        formData = {
            ...formData,
            items: [...formData.items, { sku: "", quantity: 1, salePrice: 0 }],
        };
    }

    function removeOrderItem(index) {
        formData = {
            ...formData,
            items: formData.items.filter((_, idx) => idx !== index),
        };
    }

    function handleVariantSelect(idx, event) {
        const selected = event.detail.item;
        const items = [...formData.items];
        items[idx].sku = selected.sku;
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
        <h3>Create New Order</h3>
        <button class="btn btn-text" on:click={cancel}>Cancel</button>
    </div>
    <form on:submit|preventDefault={submitForm}>
        <div class="form-section">
            <h4>Customer Information</h4>
            <div class="form-row">
                <label>
                    <span>Customer Name</span>
                    <input type="text" bind:value={formData.customerName} placeholder="Enter customer name" required />
                </label>
                <label>
                    <span>Phone Number</span>
                    <input type="text" bind:value={formData.customerPhone} placeholder="Enter phone number" required />
                </label>
            </div>
        </div>

        <div class="form-section">
            <h4>Order Information</h4>
            <div class="form-row">
                <label>
                    <span>Money Holder</span>
                    <input type="text" bind:value={formData.moneyHolder} placeholder="Who holds the money" required />
                </label>
                <label>
                    <span>Payment Method</span>
                    <select bind:value={formData.paymentMethod} required>
                        <option value="" disabled selected>Select payment method</option>
                        {#each paymentMethods as method}
                            <option value={method.value}>{method.label}</option>
                        {/each}
                    </select>
                </label>
                <label>
                    <span>Order Date</span>
                    <input type="date" bind:value={formData.orderDate} required />
                </label>
            </div>
        </div>

        <div class="form-section">
            <h4>Order Items</h4>
            <div class="item-header">
                <span class="item-sku-label">Product SKU</span>
                <span class="item-qty-label">Qty</span>
                <span class="item-price-label">Sale Price</span>
                <span></span>
            </div>
            {#each formData.items as item, idx}
                <div class="form-item-row">
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
                    <input
                        type="number"
                        class="item-qty"
                        min="1"
                        placeholder="Qty"
                        bind:value={item.quantity}
                        required
                    />
                    <input
                        type="number"
                        class="item-price"
                        min="0.01"
                        step="0.01"
                        placeholder="Sale Price"
                        bind:value={item.salePrice}
                        required
                    />
                    <button
                        class="btn btn-remove"
                        type="button"
                        on:click={() => removeOrderItem(idx)}
                        disabled={formData.items.length === 1}>✕</button
                    >
                </div>
            {/each}
            <button class="btn btn-add-item" type="button" on:click={addOrderItem}>＋ Add Item</button>
        </div>

        <div class="form-actions">
            <button class="btn btn-primary" type="submit">Create Order</button>
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

    /* Dark mode styles will be added via global CSS in orderForms-dark.css */
    :global(.dark) .order-form-container {
        background-color: var(--color-nav-bg, #23232a);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    :global(.dark) .form-header {
        border-bottom-color: var(--color-border, #374151);
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

    input,
    select {
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
    }

    .item-header {
        display: grid;
        grid-template-columns: 1fr 80px 120px 40px;
        gap: 10px;
        margin-bottom: 8px;
        font-size: 14px;
        color: #555;
    }

    /* Dark mode styles */
    :global(.dark) label span {
        color: var(--color-text-light, #a1a1aa);
    }

    :global(.dark) input,
    :global(.dark) select {
        background-color: #2d3033;
        border-color: var(--color-border, #374151);
        color: var(--color-text, #e0e7ef);
    }

    :global(.dark) .item-header {
        color: var(--color-text-light, #a1a1aa);
    }

    .form-item-row {
        display: grid;
        grid-template-columns: 1fr 80px 120px 40px;
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

    .btn-remove {
        background-color: transparent;
        border: none;
        color: #ff4d4f;
        cursor: pointer;
        font-size: 16px;
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

    /* Dark mode button styles */
    :global(.dark) .btn-add-item {
        border-color: #4b5563;
        color: var(--color-text-light, #a1a1aa);
    }

    :global(.dark) .btn-add-item:hover {
        background-color: rgba(75, 85, 99, 0.2);
    }

    :global(.dark) .btn-remove {
        color: #f87171;
    }

    :global(.dark) .btn-text {
        color: var(--color-text-light, #a1a1aa);
    }

    :global(.dark) .btn-text:hover {
        color: var(--color-text, #e0e7ef);
    }
</style>
