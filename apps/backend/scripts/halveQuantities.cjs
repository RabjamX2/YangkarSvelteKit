// halveQuantities.cjs
// This script halves the quantity for each purchase order item in batch number 4
// Use this to fix the combined quantities after duplicate removal

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Configuration
const BATCH_TO_CHECK = 4; // The batch number to modify

async function halveItemQuantities() {
    try {
        // Get the purchase order with the specified batch number
        const purchaseOrder = await prisma.purchaseOrder.findUnique({
            where: { batchNumber: BATCH_TO_CHECK },
            include: {
                items: true,
            },
        });

        if (!purchaseOrder) {
            console.error(`No purchase order found with batch number ${BATCH_TO_CHECK}`);
            return;
        }

        console.log(
            `\n========== HALVING QUANTITIES FOR PURCHASE ORDER #${purchaseOrder.id} (BATCH ${BATCH_TO_CHECK}) ==========`
        );
        console.log(`Found ${purchaseOrder.items.length} items in this purchase order`);

        let itemsUpdated = 0;

        // Process each item
        for (const item of purchaseOrder.items) {
            const originalQuantity = item.quantityOrdered;
            const newQuantity = Math.ceil(originalQuantity / 2); // Using Math.ceil to round up for odd numbers

            // Update the item with the halved quantity
            await prisma.purchaseOrderItem.update({
                where: { id: item.id },
                data: { quantityOrdered: newQuantity },
            });

            console.log(`Item #${item.id}: Updated quantity from ${originalQuantity} to ${newQuantity}`);
            itemsUpdated++;
        }

        console.log(`\nOPERATION COMPLETED:`);
        console.log(`- Items updated with halved quantities: ${itemsUpdated}`);

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
    } catch (error) {
        console.error("Error halving quantities:", error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the main function
halveItemQuantities()
    .then(() => console.log("Quantity adjustment completed."))
    .catch((e) => console.error("Error running quantity adjustment:", e));
