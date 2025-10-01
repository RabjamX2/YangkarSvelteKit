<script>
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";

    // As a fallback, redirect on the client side too
    onMount(() => {
        goto("/products");
    });
</script>

<h1>Welcome to Yangkar!</h1>
<p>Redirecting to products page...</p>
<a href="/products">Click here if you are not redirected automatically</a>
