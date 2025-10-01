import { redirect } from "@sveltejs/kit";

export function load({ cookies }) {
    const visited = cookies.get("visited");

    cookies.set("visited", "true", { path: "/" });

    // Redirect to the products page
    throw redirect(302, "/products");
}
