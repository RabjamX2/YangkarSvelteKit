// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
    namespace App {
        // interface Error {}
        interface Locals {
            user: {
                id: string;
                username: string;
                role: "USER" | "ADMIN";
                name?: string;
                email?: string;
            } | null;
            csrfToken: string | null;
        }
        // interface PageData {}
        // interface Platform {}
    }
}

// Custom types for our application data
declare namespace Lib.Types {
    export interface ProductVariant {
        id: number;
        sku: string | null;
        color: string;
        size: string | null;
        imgUrl: string | null;
        salePrice: string | null; // Prisma Decimal is serialized as a string
        stock: number;
    }

    export interface ProductWithVariants {
        id: number;
        skuBase: string;
        name: string;
        notes: string | null;
        variants: ProductVariant[];
    }

    export interface CartItem {
        sku: string;
        skuBase: string;
        name: string;
        color: string;
        size: string | null;
        salePrice: string | null;
        imgUrl: string | null;
        quantity: number;
    }
}

export {};
