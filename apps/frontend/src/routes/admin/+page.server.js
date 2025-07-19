import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
    // 'locals' is the same object you populated in your handle hook.
    // We check if the user object exists.
    if (!locals.user) {
        // If the user is not logged in, redirect them to the login page.
        throw redirect(303, '/login');
    }

    // If the user is logged in, we can safely return their data
    // to be used as a prop on the Svelte page component.
    return {
        user: locals.user
    };
}