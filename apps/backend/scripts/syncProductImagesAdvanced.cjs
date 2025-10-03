/**
 * Advanced Product Variant Image Synchronization Script
 *
 * This script synchronizes product variant images across all sizes of the same color.
 * It can be run in different modes with various options.
 *
 * Usage:
 *   node syncProductImagesAdvanced.js [options]
 *
 * Options:
 *   --dry-run       Only simulate changes without actually updating the database
 *   --product-id=N  Only synchronize variants for the specified product ID
 *   --color=NAME    Only synchronize variants for the specified color
 *   --verbose       Show detailed information about each update
 *   --force         Update all variants, even those that already have custom images
 *   --help          Show this help message
 *
 * Examples:
 *   node syncProductImagesAdvanced.js --dry-run
 *   node syncProductImagesAdvanced.js --product-id=123
 *   node syncProductImagesAdvanced.js --color=Red --verbose
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Default image URL that's assigned to variants without custom images
const DEFAULT_IMAGE = "/Placeholder4-5.png";

// Parse command-line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        dryRun: false,
        productId: null,
        color: null,
        verbose: false,
        force: false,
        help: false,
        skipPlaceholders: true, // By default, skip variants where source is a placeholder
        compact: false, // Show compact output by default
        limit: null, // No limit by default
    };

    args.forEach((arg) => {
        if (arg === "--dry-run") options.dryRun = true;
        else if (arg === "--verbose") options.verbose = true;
        else if (arg === "--force") options.force = true;
        else if (arg === "--help") options.help = true;
        else if (arg === "--compact") options.compact = true;
        else if (arg === "--include-placeholders") options.skipPlaceholders = false;
        else if (arg.startsWith("--product-id=")) options.productId = parseInt(arg.split("=")[1], 10);
        else if (arg.startsWith("--color=")) options.color = arg.split("=")[1];
        else if (arg.startsWith("--limit=")) options.limit = parseInt(arg.split("=")[1], 10);
    });

    return options;
}

// Show help text
function showHelp() {
    console.log(`
Advanced Product Variant Image Synchronization Script

Usage:
  node syncProductImagesAdvanced.js [options]

Options:
  --dry-run              Only simulate changes without actually updating the database
  --product-id=N         Only synchronize variants for the specified product ID
  --color=NAME           Only synchronize variants for the specified color
  --verbose              Show detailed information about each update
  --compact              Show compact output (default for non-verbose mode)
  --force                Update all variants, even those that already have custom images
  --include-placeholders Don't skip variants where source image is the default placeholder
  --limit=N              Limit processing to first N product+color combinations
  --help                 Show this help message

Examples:
  node syncProductImagesAdvanced.js --dry-run
  node syncProductImagesAdvanced.js --product-id=123
  node syncProductImagesAdvanced.js --color=Red --verbose
  node syncProductImagesAdvanced.js --dry-run --include-placeholders
  `);
}

// Main function
async function syncProductImages(options) {
    console.log("Starting image synchronization...");
    if (options.dryRun) console.log("DRY RUN MODE - No database changes will be made");

    try {
        // Build the where clause based on options
        const whereClause = {
            imgUrl: {
                not: DEFAULT_IMAGE,
                not: null,
            },
        };

        if (options.productId) {
            console.log(`Filtering by product ID: ${options.productId}`);
            whereClause.productId = options.productId;
        }

        if (options.color) {
            console.log(`Filtering by color: ${options.color}`);
            whereClause.color = options.color;
        }

        // Step 1: Find all product variants with custom images (not the default)
        const variantsWithCustomImages = await prisma.productVariant.findMany({
            where: whereClause,
            select: {
                id: true,
                productId: true,
                color: true,
                size: true,
                imgUrl: true,
                product: {
                    select: {
                        id: true,
                        displayName: true,
                        style: true,
                        skuBase: true,
                    },
                },
            },
            orderBy: [{ productId: "asc" }, { color: "asc" }],
        });

        console.log(`Found ${variantsWithCustomImages.length} variants with custom images.`);

        if (variantsWithCustomImages.length === 0) {
            console.log("No variants with custom images found. Nothing to synchronize.");
            return;
        }

        // Step 2: Group by productId + color to find unique combinations
        const productColorGroups = {};
        variantsWithCustomImages.forEach((variant) => {
            // Skip variants without color
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
            const productId = sourceVariant.productId;
            const color = sourceVariant.color;

            console.log(`\n${"-".repeat(80)}`);
            console.log(`[${processedGroups}/${Object.keys(productColorGroups).length}] Processing ${productName}`);
            console.log(`Product ID: ${productId}, Color: ${color}`);

            if (options.verbose) {
                console.log(`  SKU Base: ${sourceVariant.product.skuBase}`);
                console.log(`  Source Variant: ID ${sourceVariant.id}, Size: ${sourceVariant.size || "N/A"}`);
            }

            console.log(`  Source Image: "${sourceVariant.imgUrl}"`);
            if (options.dryRun || options.verbose) {
                console.log(`  ${"-".repeat(40)}`);
            }

            // Skip if source image is the default placeholder (no point in replacing placeholder with placeholder)
            if (options.skipPlaceholders && sourceVariant.imgUrl === DEFAULT_IMAGE) {
                console.log(`  Source image is the default placeholder. Skipping this product+color combination.`);
                continue;
            }

            // Check if we've hit the processing limit
            if (options.limit && processedGroups > options.limit) {
                console.log(`\nReached limit of ${options.limit} product+color combinations. Stopping processing.`);
                break;
            }

            // Find variants of this product+color
            const whereQuery = {
                productId: productId,
                color: color,
                id: {
                    not: sourceVariant.id, // Don't update the source variant
                },
                // Never update a variant if it already has the same image URL as the source
                imgUrl: {
                    not: sourceVariant.imgUrl,
                },
            };

            // If not forcing, only update variants with default/null images
            if (!options.force) {
                whereQuery.OR = [{ imgUrl: DEFAULT_IMAGE }, { imgUrl: null }];
            }

            // Get affected variants for dry run or verbose mode
            if (options.dryRun || options.verbose) {
                const affectedVariants = await prisma.productVariant.findMany({
                    where: whereQuery,
                    select: {
                        id: true,
                        sku: true,
                        size: true,
                        imgUrl: true,
                    },
                    orderBy: { size: "asc" },
                });

                if (affectedVariants.length === 0) {
                    console.log("  No variants need updating for this product+color.");
                    continue;
                }

                // Group variants by current image URL for cleaner output
                const variantsByImage = {};
                affectedVariants.forEach((v) => {
                    const currentImg = v.imgUrl || "null";
                    if (!variantsByImage[currentImg]) {
                        variantsByImage[currentImg] = [];
                    }
                    variantsByImage[currentImg].push(v);
                });

                console.log(`  Would update ${affectedVariants.length} variant(s):`);
                console.log(`  NEW IMAGE URL THAT WOULD BE APPLIED: "${sourceVariant.imgUrl}"`);

                // Display variants grouped by current image
                for (const [currentImg, variants] of Object.entries(variantsByImage)) {
                    console.log(`  • ${variants.length} variant(s) with current image: "${currentImg}"`);

                    if (options.verbose) {
                        variants.forEach((v) => {
                            console.log(`    - ID: ${v.id}, SKU: ${v.sku || "N/A"}, Size: ${v.size || "N/A"}`);
                        });
                    } else {
                        // Just show sizes in compact format if not verbose
                        const sizes = variants.map((v) => v.size || "No size").join(", ");
                        console.log(`    Sizes: ${sizes}`);
                    }
                }

                if (options.dryRun) {
                    totalUpdated += affectedVariants.length;
                    continue; // Skip the actual update in dry run mode
                }
            }

            // Perform the actual update
            if (!options.dryRun) {
                const result = await prisma.productVariant.updateMany({
                    where: whereQuery,
                    data: {
                        imgUrl: sourceVariant.imgUrl,
                    },
                });

                console.log(`  Updated ${result.count} additional variant(s) for this product+color.`);
                totalUpdated += result.count;
            }
        }

        console.log("\n----- SUMMARY -----");
        console.log(`Total variants with custom images found: ${variantsWithCustomImages.length}`);
        console.log(`Total unique product+color combinations processed: ${Object.keys(productColorGroups).length}`);
        console.log(`Total additional variants ${options.dryRun ? "that would be" : ""} updated: ${totalUpdated}`);

        // Print active filters and options
        console.log("\nActive filters and options:");
        if (options.productId) console.log(`- Product ID filter: ${options.productId}`);
        if (options.color) console.log(`- Color filter: "${options.color}"`);
        if (options.limit) console.log(`- Limit: ${options.limit} product+color combinations`);
        if (options.force) console.log(`- Force mode: Updated all variants regardless of existing custom images`);
        if (!options.skipPlaceholders) console.log(`- Including variants with placeholder images as sources`);

        if (options.dryRun) {
            console.log("\n===== THIS WAS A DRY RUN =====");
            console.log("No database changes were made. To perform the actual updates, run:");

            // Build the command without the dry-run flag
            let command = "node scripts/syncProductImagesAdvanced.cjs";
            if (options.productId) command += ` --product-id=${options.productId}`;
            if (options.color) command += ` --color=${options.color}`;
            if (options.verbose) command += " --verbose";
            if (options.force) command += " --force";
            if (!options.skipPlaceholders) command += " --include-placeholders";
            if (options.limit) command += ` --limit=${options.limit}`;

            console.log(`\n  ${command}`);
        }
    } catch (error) {
        console.error("Error synchronizing product images:", error);
    } finally {
        await prisma.$disconnect();
    }
}

// Self-invoking function to run the script
(async () => {
    console.log("===== PRODUCT VARIANT IMAGE SYNCHRONIZATION SCRIPT (ADVANCED) =====");

    const options = parseArgs();

    if (options.help) {
        showHelp();
        return;
    }

    console.log("Synchronizing custom images across all variants of the same product+color...\n");

    const startTime = Date.now();
    await syncProductImages(options);
    const duration = (Date.now() - startTime) / 1000;

    console.log(`\nOperation completed in ${duration.toFixed(2)} seconds.`);
})();
