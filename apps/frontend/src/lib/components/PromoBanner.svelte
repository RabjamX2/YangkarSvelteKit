<script>
    // @ts-nocheck

    /** @type {{ id: number, name: string, bannerText: string | null }[]} */
    export let banners = [];

    // Track which banners the user has dismissed this session
    let dismissed = new Set();

    function dismiss(id) {
        dismissed = new Set([...dismissed, id]);
    }

    $: visible = banners.filter((b) => !dismissed.has(b.id));
</script>

{#if visible.length > 0}
    <div class="promo-banners">
        {#each visible as banner (banner.id)}
            <div class="promo-banner">
                <span class="promo-banner-text">
                    {banner.bannerText || banner.name}
                </span>
                <button class="promo-banner-close" aria-label="Dismiss banner" on:click={() => dismiss(banner.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                            d="M18 6L6 18M6 6l12 12"
                            stroke="currentColor"
                            stroke-width="2.5"
                            stroke-linecap="round"
                        />
                    </svg>
                </button>
            </div>
        {/each}
    </div>
{/if}

<style>
    .promo-banners {
        display: flex;
        flex-direction: column;
        width: 100%;
    }

    .promo-banner {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 0.6rem 1rem;
        background: var(--color-primary);
        color: #fff;
        font-size: var(--font-size-small);
        font-weight: var(--font-weight-medium);
        letter-spacing: 0.02em;
        position: relative;
    }

    .promo-banner-text {
        text-align: center;
        flex: 1;
    }

    .promo-banner-close {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.8);
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition:
            color 0.15s,
            background 0.15s;
    }

    .promo-banner-close:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.15);
    }
</style>
