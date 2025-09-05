import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Adds newly received stock by creating an InventoryBatch.
 * This should be called when a purchase order is marked as "received".
 * @param {string} productVariantId - The ID of the product variant.
 * @param {number} quantity - The number of items received.
 * @param {number} cost - The cost per item in this batch.
 * @param {string} purchaseOrderItemId - The ID of the related purchase order item.
 */
export async function receiveStock(productVariantId, quantity, cost, purchaseOrderItemId) {
    return prisma.$transaction(async (tx) => {
        // 1. Create the new batch of inventory with its specific cost.
        const newBatch = await tx.inventoryBatch.create({
            data: {
                productVariantId,
                quantity,
                cost,
                purchaseOrderItemId,
            },
        });

        // 2. Update the total stock count on the ProductVariant for quick lookups.
        await tx.productVariant.update({
            where: { id: productVariantId },
            data: {
                stock: {
                    increment: quantity,
                },
            },
        });

        return newBatch;
    });
}

/**
 * Fulfills an order by deducting stock according to FIFO logic and calculates the COGS.
 * @param {string} productVariantId - The ID of the product variant being sold.
 * @param {number} quantityToSell - The number of items being sold.
 * @param {string} customerOrderItemId - The order item this fulfillment is for.
 */
export async function fulfillStock(productVariantId, quantityToSell, customerOrderItemId) {
    return prisma.$transaction(async (tx) => {
        let quantityToFulfill = quantityToSell;
        let totalCogs = 0;

        // 1. Get all available inventory batches for the variant, oldest first (FIFO).
        const batches = await tx.inventoryBatch.findMany({
            where: {
                productVariantId: productVariantId,
                quantity: { gt: 0 },
            },
            orderBy: {
                createdAt: "asc",
            },
        });

        const totalStock = batches.reduce((sum, batch) => sum + batch.quantity, 0);
        if (totalStock < quantityToSell) {
            throw new Error(
                `Not enough stock for variant ${productVariantId}. Available: ${totalStock}, Requested: ${quantityToSell}`
            );
        }

        // 2. Loop through the batches and "consume" the required quantity.
        for (const batch of batches) {
            if (quantityToFulfill === 0) break;

            const quantityFromThisBatch = Math.min(quantityToFulfill, batch.quantity);

            // 3. Add to the total COGS for this sale.
            totalCogs += quantityFromThisBatch * parseFloat(batch.cost);

            // 4. Update the batch to reflect the sale.
            await tx.inventoryBatch.update({
                where: { id: batch.id },
                data: {
                    quantity: {
                        decrement: quantityFromThisBatch,
                    },
                },
            });

            quantityToFulfill -= quantityFromThisBatch;
        }

        // 5. Update the customer order item with the calculated COGS.
        await tx.customerOrderItem.update({
            where: { id: customerOrderItemId },
            data: {
                cogs: totalCogs,
            },
        });

        // 6. Update the total stock on the master product variant.
        await tx.productVariant.update({
            where: { id: productVariantId },
            data: {
                stock: {
                    decrement: quantityToSell,
                },
            },
        });

        return { cogs: totalCogs };
    });
}
