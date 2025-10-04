// detectAndFixDuplicates.cjs
// This script detects and removes duplicate purchase order items in a specified batch
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Configuration
const BATCH_TO_CHECK = 4; // The batch number to check for duplicates

/**
 * Groups items by their key properties to detect duplicates
 * @param {Array} items - Array of purchase order items
 * @returns {Object} - Object with keys representing unique items and values being arrays of duplicate items
 */
function groupPotentialDuplicates(items) {
    const groups = {};

    items.forEach((item) => {
        // Create a key based on the properties that should make an item unique
        // Adjust these properties based on your definition of what makes an item a "duplicate"
        const key = `${item.productVariantId}_${item.costPerItemUsd}`;

        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(item);
    });

    // Filter to only groups that have more than one item (i.e., duplicates)
    const duplicateGroups = {};
    for (const [key, items] of Object.entries(groups)) {
        if (items.length > 1) {
            duplicateGroups[key] = items;
        }
    }

    return duplicateGroups;
}

/**
 * Analyzes the purchase order items for possible duplicates
 */
async function analyzeAndFixDuplicates() {
    try {
        // Get the purchase order with the specified batch number
        const purchaseOrder = await prisma.purchaseOrder.findUnique({
            where: { batchNumber: BATCH_TO_CHECK },
            include: {
                items: {
                    include: {
                        variant: true, // Include variant details for better identification
                    },
                },
            },
        });

        if (!purchaseOrder) {
            console.error(`No purchase order found with batch number ${BATCH_TO_CHECK}`);
            return;
        }

        console.log(`\n========== ANALYZING PURCHASE ORDER #${purchaseOrder.id} (BATCH ${BATCH_TO_CHECK}) ==========`);
        console.log(`Found ${purchaseOrder.items.length} items in this purchase order`);

        // Group potential duplicates
        const duplicateGroups = groupPotentialDuplicates(purchaseOrder.items);
        const duplicateGroupCount = Object.keys(duplicateGroups).length;

        if (duplicateGroupCount === 0) {
            console.log(`No duplicate items detected in batch ${BATCH_TO_CHECK}`);
            return;
        }

        console.log(`Detected ${duplicateGroupCount} groups of potential duplicates`);

        // Print duplicate groups for inspection
        console.log("\nDUPLICATE GROUPS:");
        let totalDuplicatesCount = 0;

        for (const [key, items] of Object.entries(duplicateGroups)) {
            const totalQuantity = items.reduce((sum, item) => sum + item.quantityOrdered, 0);
            console.log(`\nGroup ${key} - ${items.length} items with same product variant and cost:`);

            // Sort items by ID for consistent output
            items.sort((a, b) => a.id - b.id);

            items.forEach((item) => {
                console.log(
                    `  Item #${item.id}: ${item.quantityOrdered} units × $${Number(item.costPerItemUsd).toFixed(2)} = $${(Number(item.costPerItemUsd) * item.quantityOrdered).toFixed(2)} (Variant: ${item.variant.sku || "No SKU"})`
                );
            });

            console.log(`  Total quantity across duplicates: ${totalQuantity}`);
            totalDuplicatesCount += items.length - 1; // Count all but one in each group as duplicates
        }

        console.log(`\nTotal items that appear to be duplicates: ${totalDuplicatesCount}`);

        // Ask for confirmation before proceeding
        console.log("\nRECOMMENDED APPROACH:");
        console.log("1. Keep the first item in each duplicate group");
        console.log("2. Delete the other duplicate items");
        console.log(
            "\nTo execute this fix, run this script with the 'fix' argument: node detectAndFixDuplicates.cjs fix"
        );

        // Check if we should fix duplicates
        if (process.argv.includes("fix")) {
            console.log("\nPROCEEDING WITH FIXES...");
            let itemsUpdated = 0;
            let itemsDeleted = 0;

            for (const [key, items] of Object.entries(duplicateGroups)) {
                // Keep the first item and update its quantity
                const itemsToDelete = items.slice(1);

                // Delete the duplicate items
                for (const itemToDelete of itemsToDelete) {
                    // Check if this item has an inventory batch that needs to be handled
                    const inventoryBatch = await prisma.inventoryBatch.findUnique({
                        where: { purchaseOrderItemId: itemToDelete.id },
                    });

                    if (inventoryBatch) {
                        console.log(
                            `Warning: Item #${itemToDelete.id} has an associated inventory batch #${inventoryBatch.id}. This will be deleted.`
                        );
                        await prisma.inventoryBatch.delete({
                            where: { id: inventoryBatch.id },
                        });
                    }

                    await prisma.purchaseOrderItem.delete({
                        where: { id: itemToDelete.id },
                    });
                    itemsDeleted++;
                }
            }

            console.log(`\nFIX COMPLETED:`);
            console.log(`- Items updated with combined quantities: ${itemsUpdated}`);
            console.log(`- Duplicate items deleted: ${itemsDeleted}`);

            // Update calculatedTotalUsd
            console.log("\nRecalculating order total...");
            await prisma.$executeRaw`
                UPDATE "PurchaseOrder"
                SET "calculatedTotalUsd" = (
                    SELECT COALESCE(SUM("quantityOrdered" * "costPerItemUsd"), 0)
                    FROM "PurchaseOrderItem"
                    WHERE "purchaseOrderId" = "PurchaseOrder"."id"
                ) + COALESCE("shippingCostUsd", 0) + COALESCE("extraFeesUsd", 0)
                WHERE "id" = ${purchaseOrder.id}
            `;

            console.log("Order total has been recalculated.");
        }
    } catch (error) {
        console.error("Error detecting duplicates:", error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the main function
analyzeAndFixDuplicates()
    .then(() => console.log("Duplicate analysis completed."))
    .catch((e) => console.error("Error running duplicate analysis:", e));
