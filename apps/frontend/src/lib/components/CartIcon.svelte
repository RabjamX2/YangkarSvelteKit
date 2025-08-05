<script>
    import { cartItemCount } from "$lib/stores/cart.store.js";
</script>

<div class="cart-link" aria-label="View shopping cart">
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="feather feather-shopping-cart"
        ><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path
            d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"
        ></path></svg
    >
    {#if $cartItemCount > 0}
        <span class="cart-count">{$cartItemCount}</span>
    {/if}
</div>

<style>
    .cart-link {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-link);
        text-decoration: none;
    }
    .cart-count {
        position: absolute;
        top: -8px;
        right: -10px;
        background-color: var(--color-logout-bg);
        color: white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        font-size: 12px;
        font-weight: bold;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid var(--color-nav-bg);
    }
</style>
