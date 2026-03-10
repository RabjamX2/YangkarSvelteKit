import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [
        {
            // Must be enforce: 'pre' so this runs before SvelteKit's vite-plugin-sveltekit-compile
            // which also runs pre-enforce and has its own onwarn that throws on unresolved imports.
            name: "externalize-browser-only",
            enforce: "pre",
            resolveId(id, _importer, options) {
                if (id === "heic2any" && options?.ssr) {
                    return { id, external: true };
                }
            },
        },
        sveltekit(),
    ],
    resolve: {
        dedupe: ["fuzzysort"],
    },
    optimizeDeps: {
        include: ["fuzzysort"],
    },
});
