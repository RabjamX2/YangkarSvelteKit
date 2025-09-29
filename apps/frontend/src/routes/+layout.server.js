/** @type {import('./$types').LayoutServerLoad} */
export async function load({ locals }) {
    // This makes the user object and CSRF token available to all pages
    // through the `data` prop in your +layout.svelte.
    return {
        user: locals.user,
        csrfToken: locals.csrfToken,
    };
}
