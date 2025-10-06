<script>
    import { createEventDispatcher, onMount } from "svelte";
    import fuzzysort from "fuzzysort";
    export let value = "";
    export let items = [];
    export let placeholder = "";
    export let label = "";
    export let disabled = false;
    export let minLength = 1;
    export let itemLabel = (item) => item.sku + " - " + item.displayName;
    export let itemValue = (item) => item.sku;
    export let inputClass = "";
    export let dropdownClass = "";
    export let labelClass = "";
    export let maxResults = 10;

    let inputValue = value;
    let filtered = [];
    let showDropdown = false;
    let activeIdx = -1;
    const dispatch = createEventDispatcher();

    $: filtered =
        inputValue.length >= minLength
            ? fuzzysort
                  .go(inputValue, items, {
                      key: itemLabel,
                      limit: maxResults,
                      threshold: -10000,
                  })
                  .map((r) => r.obj)
            : [];

    function selectItem(item) {
        inputValue = itemValue(item);
        showDropdown = false;
        dispatch("select", { item });
    }

    function onInput(e) {
        inputValue = e.target.value;
        showDropdown = filtered.length > 0;
        dispatch("input", { value: inputValue });
    }

    function onBlur() {
        setTimeout(() => (showDropdown = false), 120);
    }

    function onFocus() {
        showDropdown = filtered.length > 0;
    }
</script>

<div class="autocomplete">
    {#if label}
        <label class={labelClass}>{label}</label>
    {/if}
    <input
        type="text"
        class={inputClass}
        bind:value={inputValue}
        {placeholder}
        {disabled}
        on:input={onInput}
        on:focus={onFocus}
        on:blur={onBlur}
        autocomplete="off"
    />
    {#if showDropdown && filtered.length > 0}
        <ul class={dropdownClass + " autocomplete-dropdown"}>
            {#each filtered as item, idx}
                <li class:active={idx === activeIdx} on:mousedown={() => selectItem(item)}>{itemLabel(item)}</li>
            {/each}
        </ul>
    {/if}
</div>

<style>
    .autocomplete {
        position: relative;
    }
    .autocomplete input {
        width: 100%;
    }
    .autocomplete-dropdown {
        position: absolute;
        left: 0;
        right: 0;
        top: 100%;
        background: #222;
        color: #fff;
        border: 1px solid #444;
        border-radius: 0 0 8px 8px;
        z-index: 10;
        max-height: 220px;
        overflow-y: auto;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
        margin: 0;
        padding: 0;
        list-style: none;
    }
    .autocomplete-dropdown li {
        padding: 0.5rem 1rem;
        cursor: pointer;
    }
    .autocomplete-dropdown li.active,
    .autocomplete-dropdown li:hover {
        background: #ffd700;
        color: #222;
    }
</style>
