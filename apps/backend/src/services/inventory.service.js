import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg;
const prisma = new PrismaClient();

/**
 * Adds newly received stock by creating an InventoryBatch.
 * This should be called when a purchase order is marked as "received".
 * @param {string} productVariantId - The ID of the product variant.
 * @param {number} quantity - The number of items received.
 * @param {number} costCNY - The cost per item in this batch.
 * @param {string} purchaseOrderItemId - The ID of the related purchase order item.
 */
export async function receiveStock(productVariantId, quantity, costCNY, purchaseOrderItemId, arrivalDate) {
    return prisma.$transaction(async (tx) => {
        // Get the purchase order item to access the purchase order
        const purchaseOrderItem = await tx.purchaseOrderItem.findUnique({
            where: { id: purchaseOrderItemId },
            include: { order: true },
        });

        // Calculate USD cost if there's a conversion rate
        let costUSD = null;
        if (purchaseOrderItem?.order?.usdToCnyRate) {
            const usdToCnyRate = parseFloat(purchaseOrderItem.order.usdToCnyRate);
            costUSD = parseFloat(costCNY) / usdToCnyRate;
        }

        // 1. Create the new batch of inventory with its specific cost and arrival date.
        const newBatch = await tx.inventoryBatch.create({
            data: {
                productVariantId,
                quantity,
                costCNY,
                costUSD,
                purchaseOrderItemId,
                arrivalDate,
            },
        });

        // No direct productVariant stock update; stock is tracked via inventory batches only

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

        // 1. Get all available inventory batches for the variant, oldest first (FIFO by parent PurchaseOrder arrivalDate, fallback to createdAt).
        const batches = await tx.inventoryBatch.findMany({
            where: {
                productVariantId: productVariantId,
                quantity: { gt: 0 },
            },
            include: {
                purchaseOrderItem: {
                    include: {
                        order: true,
                    },
                },
            },
        });

        // Sort batches by parent PurchaseOrder arrivalDate (asc), then createdAt (asc)
        batches.sort((a, b) => {
            const aArrival = a.purchaseOrderItem?.order?.arrivalDate
                ? new Date(a.purchaseOrderItem.order.arrivalDate).getTime()
                : 0;
            const bArrival = b.purchaseOrderItem?.order?.arrivalDate
                ? new Date(b.purchaseOrderItem.order.arrivalDate).getTime()
                : 0;
            if (aArrival !== bArrival) return aArrival - bArrival;
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

        const totalStock = batches.reduce((sum, batch) => sum + batch.quantity, 0);
        if (totalStock < quantityToSell) {
            // Fetch product variant details for a better error message
            const variant = await tx.productVariant.findUnique({
                where: { id: productVariantId },
                include: { product: true },
            });
            const variantName = variant
                ? `${variant.product.displayName || variant.product.name} (${variant.color}${variant.size ? `, ${variant.size}` : ""}) - SKU: ${variant.sku}`
                : `variant ID ${productVariantId}`;
            throw new Error(
                `Insufficient stock for ${variantName}. Available: ${totalStock}, Requested: ${quantityToSell}`
            );
        }

        // 2. Loop through the batches and "consume" the required quantity.
        for (const batch of batches) {
            if (quantityToFulfill === 0) break;

            const quantityFromThisBatch = Math.min(quantityToFulfill, batch.quantity);

            // 3. Add to the total COGS for this sale.
            // Use costUSD if available, otherwise calculate it from costCNY using the purchase order's usdToCnyRate
            let batchCost = 0;
            if (batch.costUSD !== null && batch.costUSD !== undefined) {
                batchCost = parseFloat(batch.costUSD);
            } else if (batch.costCNY !== null && batch.costCNY !== undefined) {
                // Get the usdToCnyRate from the purchase order
                const usdToCnyRate = batch.purchaseOrderItem?.order?.usdToCnyRate;
                if (usdToCnyRate) {
                    // Convert from CNY to USD
                    batchCost = parseFloat(batch.costCNY) / parseFloat(usdToCnyRate);
                } else {
                    console.warn(`No usdToCnyRate found for batch ${batch.id}, using 0 for cost`);
                    batchCost = 0;
                }
            }
            totalCogs += quantityFromThisBatch * batchCost;

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

        // No direct productVariant stock update; stock is tracked via inventory batches only

        return { cogs: totalCogs };
    });
}
