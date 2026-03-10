import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig(({ ssrBuild }) => ({
    plugins: [sveltekit()],
    resolve: {
        dedupe: ["fuzzysort"],
    },
    optimizeDeps: {
        include: ["fuzzysort"],
    },
    // Externalize browser-only packages during the SSR build so SvelteKit
    // doesn't throw on unresolved imports. The client build bundles them normally.
    ...(ssrBuild && {
        build: {
            rollupOptions: {
                external: ["heic2any"],
            },
        },
    }),
}));
