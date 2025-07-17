export const load = async ({ locals }) => {
    // The `user` object is from our hooks.server.js file
    return {
        user: locals.user
    };
};