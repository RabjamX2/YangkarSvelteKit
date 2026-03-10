import { fail } from "@sveltejs/kit";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const CONTENT_FILE = join(DATA_DIR, "about.json");

const DEFAULT_CONTENT = {
    heading: "About Yangkar",
    body: "We are Yangkar — a small shop dedicated to bringing authentic Tibetan clothing, jewelry, and accessories to the world.\n\nFounded with a passion for preserving culture and craftsmanship, every piece in our collection is carefully selected to reflect the beauty and heritage of Tibet.\n\nThank you for supporting our small business.",
};

function readContent() {
    if (!existsSync(CONTENT_FILE)) {
        return DEFAULT_CONTENT;
    }
    try {
        return JSON.parse(readFileSync(CONTENT_FILE, "utf-8"));
    } catch {
        return DEFAULT_CONTENT;
    }
}

function writeContent(content) {
    if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
    }
    writeFileSync(CONTENT_FILE, JSON.stringify(content, null, 2), "utf-8");
}

/** @type {import('./$types').PageServerLoad} */
export function load({ locals }) {
    return {
        content: readContent(),
        user: locals.user ?? null,
    };
}

/** @type {import('./$types').Actions} */
export const actions = {
    save: async ({ request, locals }) => {
        if (!locals.user || locals.user.role !== "ADMIN") {
            return fail(403, { error: "Unauthorized" });
        }

        const data = await request.formData();
        const heading = data.get("heading")?.toString().trim();
        const body = data.get("body")?.toString().trim();

        if (!heading || !body) {
            return fail(400, { error: "Heading and body are required." });
        }

        writeContent({ heading, body });

        return { success: true };
    },
};
