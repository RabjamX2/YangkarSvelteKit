export interface ProductVariant {
    id: number;
    sku: string | null;
    color: string;
    size: string | null;
    imgUrl: string | null;
    salePrice: string | null;
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
