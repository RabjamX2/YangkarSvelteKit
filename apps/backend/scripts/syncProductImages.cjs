/**
 * Synchronize Product Variant Images Script
 *
 * This script finds all product variants with custom images and applies them
 * to all other sizes of the same product + color combination.
 *
 * Usage:
 *   node syncProductImages.js
 *
 * Note: This script directly accesses the database and should be run with caution.
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Default image URL that's assigned to variants without custom images
const DEFAULT_IMAGE = "/Placeholder4-5.png";

async function syncProductImages() {
    console.log("Starting image synchronization...");

    try {
        // Step 1: Find all product variants with custom images (not the default)
        const variantsWithCustomImages = await prisma.productVariant.findMany({
            where: {
                imgUrl: {
                    not: DEFAULT_IMAGE,
                    not: null,
                },
            },
            select: {
                id: true,
                productId: true,
                color: true,
                imgUrl: true,
                product: {
                    select: {
                        displayName: true,
                        style: true,
                    },
                },
            },
            orderBy: {
                productId: "asc",
            },
        });

        console.log(`Found ${variantsWithCustomImages.length} variants with custom images.`);

        if (variantsWithCustomImages.length === 0) {
            console.log("No variants with custom images found. Nothing to synchronize.");
            return;
        }

        // Step 2: Group by productId + color to find unique combinations
        const productColorGroups = {};
        variantsWithCustomImages.forEach((variant) => {
            // Skip variants without color (shouldn't happen in practice)
            if (!variant.color) return;

            const key = `${variant.productId}:${variant.color}`;

            // If this product+color combo doesn't exist yet, or this variant has a custom image,
            // use this variant as the representative for this group
            if (!productColorGroups[key] || variant.imgUrl !== DEFAULT_IMAGE) {
                productColorGroups[key] = variant;
            }
        });

        console.log(
            `Found ${Object.keys(productColorGroups).length} unique product+color combinations to synchronize.`
        );

        // Step 3: For each product+color group, update all variants of that color
        let totalUpdated = 0;
        let processedGroups = 0;

        for (const key in productColorGroups) {
            const sourceVariant = productColorGroups[key];
            processedGroups++;

            const productName = sourceVariant.product.displayName || sourceVariant.product.style || "Unknown";
            console.log(
                `\n[${processedGroups}/${Object.keys(productColorGroups).length}] Processing ${productName}, color: ${sourceVariant.color}`
            );
            console.log(`Source image: ${sourceVariant.imgUrl}`);

            // Find and update all variants of this product+color
            const result = await prisma.productVariant.updateMany({
                where: {
                    productId: sourceVariant.productId,
                    color: sourceVariant.color,
                    id: {
                        not: sourceVariant.id, // Don't update the source variant
                    },
                    // Only update variants with default/null images
                    OR: [{ imgUrl: DEFAULT_IMAGE }, { imgUrl: null }],
                },
                data: {
                    imgUrl: sourceVariant.imgUrl,
                },
            });

            console.log(`Updated ${result.count} additional variants for this product+color.`);
            totalUpdated += result.count;
        }

        console.log("\n----- SUMMARY -----");
        console.log(`Total variants with custom images: ${variantsWithCustomImages.length}`);
        console.log(`Total unique product+color combinations: ${Object.keys(productColorGroups).length}`);
        console.log(`Total additional variants updated: ${totalUpdated}`);
    } catch (error) {
        console.error("Error synchronizing product images:", error);
    } finally {
        await prisma.$disconnect();
    }
}

// Self-invoking function to run the script
(async () => {
    console.log("===== PRODUCT VARIANT IMAGE SYNCHRONIZATION SCRIPT =====");
    console.log("Synchronizing custom images across all variants of the same product+color...\n");

    const startTime = Date.now();
    await syncProductImages();
    const duration = (Date.now() - startTime) / 1000;

    console.log(`\nOperation completed in ${duration.toFixed(2)} seconds.`);
})();
