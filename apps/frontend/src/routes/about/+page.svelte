<script>
    // @ts-nocheck
    import { enhance } from "$app/forms";

    export let data;
    export let form;

    let editing = false;
    let heading = data.content.heading;
    let body = data.content.body;

    const isAdmin = data.user?.role === "ADMIN";

    // Reset local state if save was successful
    $: if (form?.success) {
        editing = false;
        heading = data.content.heading;
        body = data.content.body;
    }
</script>

<svelte:head>
    <title>About Us | Yangkar</title>
</svelte:head>

<div class="about-page">
    <div class="about-card">
        {#if editing}
            <form method="POST" action="?/save" use:enhance class="edit-form">
                <div class="edit-field">
                    <label for="heading">Heading</label>
                    <input id="heading" name="heading" type="text" value={heading} required />
                </div>
                <div class="edit-field">
                    <label for="body">Content</label>
                    <textarea id="body" name="body" rows="10" required>{body}</textarea>
                </div>

                {#if form?.error}
                    <p class="form-error">{form.error}</p>
                {/if}

                <div class="edit-actions">
                    <button type="submit" class="btn btn-save">Save</button>
                    <button type="button" class="btn btn-cancel" on:click={() => (editing = false)}>Cancel</button>
                </div>
            </form>
        {:else}
            <div class="about-content">
                <h1 class="about-heading">{data.content.heading}</h1>
                <div class="about-body">
                    {#each data.content.body.split("\n\n") as paragraph}
                        <p>{paragraph}</p>
                    {/each}
                </div>
            </div>

            {#if isAdmin}
                <button class="btn btn-edit" on:click={() => (editing = true)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                            d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 0 1 2.828 0l.172.172a2 2 0 0 1 0 2.828L12 16H9v-3z"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                    Edit Page
                </button>
            {/if}
        {/if}
    </div>
</div>

<style>
    .about-page {
        display: flex;
        justify-content: center;
        padding: 3rem 1rem;
        min-height: 60vh;
    }

    .about-card {
        background: var(--color-bg);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-lg);
        box-shadow: var(--color-shadow);
        padding: 2.5rem;
        max-width: 720px;
        width: 100%;
        position: relative;
    }

    .about-heading {
        font-size: var(--font-size-2xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text);
        margin-bottom: 1.5rem;
        letter-spacing: -0.02em;
    }

    .about-body {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .about-body p {
        color: var(--color-text);
        font-size: var(--font-size-medium);
        line-height: var(--line-height-normal);
    }

    /* Admin edit button */
    .btn-edit {
        margin-top: 2rem;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        background: var(--color-user-badge-bg);
        color: var(--color-user-badge);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-md);
        padding: 0.5rem 1rem;
        font-size: var(--font-size-small);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn-edit:hover {
        background: var(--color-link-bg-hover);
        color: var(--color-link-hover);
        transform: translateY(-1px);
    }

    /* Edit form */
    .edit-form {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    .edit-field {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    .edit-field label {
        font-size: var(--font-size-small);
        font-weight: var(--font-weight-medium);
        color: var(--color-text);
    }

    .edit-field input,
    .edit-field textarea {
        padding: 0.625rem 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-md);
        background: var(--color-bg);
        color: var(--color-text);
        font-size: var(--font-size-medium);
        font-family: inherit;
        line-height: var(--line-height-normal);
        transition: border-color 0.2s;
        resize: vertical;
    }

    .edit-field input:focus,
    .edit-field textarea:focus {
        outline: none;
        border-color: var(--color-primary);
    }

    .form-error {
        color: var(--color-danger);
        font-size: var(--font-size-small);
    }

    .edit-actions {
        display: flex;
        gap: 0.75rem;
    }

    .btn {
        padding: 0.6rem 1.25rem;
        border-radius: var(--border-radius-md);
        font-size: var(--font-size-small);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
        border: none;
        transition: all 0.2s ease;
    }

    .btn-save {
        background: var(--color-primary);
        color: #fff;
    }

    .btn-save:hover {
        background: var(--color-primary-hover);
    }

    .btn-cancel {
        background: var(--color-user-badge-bg);
        color: var(--color-text);
        border: 1px solid var(--color-border);
    }

    .btn-cancel:hover {
        background: var(--color-link-bg-hover);
    }
</style>
