import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [
        sveltekit(),
        {
            // heic2any is browser-only. Mark it external during the SSR build pass
            // so SvelteKit's onwarn doesn't throw on the unresolved dynamic import.
            // During the client build pass (options.ssr = false), it is bundled normally.
            name: "externalize-browser-only",
            resolveId(id, _importer, options) {
                if (id === "heic2any" && options?.ssr) {
                    return { id, external: true };
                }
            },
        },
    ],
    resolve: {
        dedupe: ["fuzzysort"],
    },
    optimizeDeps: {
        include: ["fuzzysort"],
    },
});
