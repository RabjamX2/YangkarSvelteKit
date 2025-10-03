import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Update image URL for all size variants of a specific product color
 *
 * @param {number} productId - The ID of the product
 * @param {string} color - The color value to match
 * @param {string} newImgUrl - The new image URL to set
 * @returns {Promise<number>} - Number of variants updated
 */
export async function updateImagesForColorVariants(productId, color, newImgUrl) {
    const result = await prisma.productVariant.updateMany({
        where: {
            productId: productId,
            color: color,
        },
        data: {
            imgUrl: newImgUrl,
        },
    });

    return result.count;
}

/**
 * Update image URL for a specific variant (when you need a unique image for one size)
 *
 * @param {number} variantId - The ID of the specific product variant
 * @param {string} newImgUrl - The new image URL to set
 * @returns {Promise<object>} - The updated variant
 */
export async function updateImageForSpecificVariant(variantId, newImgUrl) {
    return await prisma.productVariant.update({
        where: {
            id: variantId,
        },
        data: {
            imgUrl: newImgUrl,
        },
    });
}

/**
 * Get all variants of a specific product color
 *
 * @param {number} productId - The ID of the product
 * @param {string} color - The color value to match
 * @returns {Promise<array>} - Array of variants with the same color
 */
export async function getVariantsByProductColor(productId, color) {
    return await prisma.productVariant.findMany({
        where: {
            productId: productId,
            color: color,
        },
        orderBy: {
            size: "asc",
        },
    });
}

/**
 * Get all unique colors for a product
 *
 * @param {number} productId - The ID of the product
 * @returns {Promise<array>} - Array of unique colors for the product
 */
export async function getProductColors(productId) {
    const variants = await prisma.productVariant.findMany({
        where: {
            productId: productId,
        },
        select: {
            color: true,
            displayColor: true,
            colorHex: true,
            imgUrl: true,
        },
        distinct: ["color"],
    });

    return variants;
}
