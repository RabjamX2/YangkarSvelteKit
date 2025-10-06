// updateCurrencyValues.cjs
// This script updates missing USD or CNY values in the database based on the usdToCnyRate
// in each PurchaseOrder
// Usage:
//   node updateCurrencyValues.cjs           # Only update missing values
//   node updateCurrencyValues.cjs overwrite # Overwrite PurchaseOrderItem.costPerItemUsd values
//   node updateCurrencyValues.cjs total     # Calculate and update the calculatedTotalUsd field in PurchaseOrder
//   node updateCurrencyValues.cjs cogs      # Convert CustomerOrderItem.cogs from CNY to USD

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Check command line arguments
const shouldOverwrite = process.argv.includes("overwrite");
const shouldUpdateTotal = process.argv.includes("total");
const shouldUpdateCogs = process.argv.includes("cogs");

// Configure rounding precision (number of decimal places)
const USD_PRECISION = 2; // USD typically uses 2 decimal places
const CNY_PRECISION = 2; // CNY typically uses 2 decimal places

/**
 * Rounds a number to the specified number of decimal places
 * @param {number} value - The value to round
 * @param {number} decimals - Number of decimal places to round to
 * @returns {number} - Rounded value
 */
function roundToDecimals(value, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}

/**
 * Converts USD to CNY based on the provided rate
 * @param {number} usdValue - Amount in USD
 * @param {number} rate - Exchange rate (1 USD = rate CNY)
 * @returns {number} - Amount in CNY, rounded to CNY_PRECISION
 */
function usdToCny(usdValue, rate) {
    if (usdValue === null || rate === null) return null;
    return roundToDecimals(usdValue * rate, CNY_PRECISION);
}

/**
 * Converts CNY to USD based on the provided rate
 * @param {number} cnyValue - Amount in CNY
 * @param {number} rate - Exchange rate (1 USD = rate CNY)
 * @returns {number} - Amount in USD, rounded to USD_PRECISION
 */
function cnyToUsd(cnyValue, rate) {
    if (cnyValue === null || rate === null) return null;
    return roundToDecimals(cnyValue / rate, USD_PRECISION);
}

/**
 * Calculates the total USD value for a purchase order by summing all items' costs multiplied by their quantities
 * @param {Object} order - The purchase order with items
 * @param {number} rate - The USD to CNY exchange rate
 * @returns {Object} - Object containing the total USD value and a breakdown
 */
function calculateOrderTotalUsd(order, rate) {
    let total = 0;
    let productSubtotal = 0;
    let shippingCost = 0;
    let extraFees = 0;
    let breakdown = {
        items: [],
        shippingDetails: {},
        feesDetails: {},
    };

    console.log(`\n========== CALCULATION BREAKDOWN FOR ORDER #${order.id} (BATCH ${order.batchNumber}) ==========`);
    console.log(`Exchange Rate: 1 USD = ${rate} CNY\n`);
    console.log(`ITEM COSTS:`);

    // Calculate total from items
    for (const item of order.items) {
        let itemCostUsd = item.costPerItemUsd;
        let conversionNote = "";

        // If USD cost is not available, convert from CNY
        if (itemCostUsd === null && item.costPerItemCny !== null) {
            itemCostUsd = cnyToUsd(Number(item.costPerItemCny), rate);
            conversionNote = ` (converted from ¥${Number(item.costPerItemCny).toFixed(2)} CNY)`;
        }

        if (itemCostUsd !== null) {
            const itemTotal = Number(itemCostUsd) * item.quantityOrdered;
            productSubtotal += itemTotal;
            total += itemTotal;

            const itemInfo = {
                id: item.id,
                quantity: item.quantityOrdered,
                costPerItem: Number(itemCostUsd),
                totalCost: itemTotal,
            };
            breakdown.items.push(itemInfo);

            console.log(
                `  Item #${item.id}: ${item.quantityOrdered} units × $${Number(itemCostUsd).toFixed(2)}${conversionNote} = $${itemTotal.toFixed(2)}`
            );
        }
    }

    console.log(`Product Subtotal: $${productSubtotal.toFixed(2)}\n`);

    // Add shipping cost if available
    console.log(`SHIPPING COST:`);
    if (order.shippingCostUsd !== null) {
        shippingCost = Number(order.shippingCostUsd);
        total += shippingCost;
        breakdown.shippingDetails = {
            originalCurrency: "USD",
            originalAmount: shippingCost,
            usdAmount: shippingCost,
        };
        console.log(`  $${shippingCost.toFixed(2)} USD`);
    } else if (order.shippingCostCny !== null) {
        const cnyAmount = Number(order.shippingCostCny);
        shippingCost = cnyToUsd(cnyAmount, rate);
        if (shippingCost !== null) {
            total += shippingCost;
            breakdown.shippingDetails = {
                originalCurrency: "CNY",
                originalAmount: cnyAmount,
                usdAmount: shippingCost,
            };
            console.log(`  ¥${cnyAmount.toFixed(2)} CNY = $${shippingCost.toFixed(2)} USD`);
        } else {
            console.log(`  Not available`);
        }
    } else {
        console.log(`  Not available`);
    }

    // Add extra fees if available
    console.log(`\nEXTRA FEES:`);
    if (order.extraFeesUsd !== null) {
        extraFees = Number(order.extraFeesUsd);
        total += extraFees;
        breakdown.feesDetails = {
            originalCurrency: "USD",
            originalAmount: extraFees,
            usdAmount: extraFees,
        };
        console.log(`  $${extraFees.toFixed(2)} USD`);
    } else if (order.extraFeesCny !== null) {
        const cnyAmount = Number(order.extraFeesCny);
        extraFees = cnyToUsd(cnyAmount, rate);
        if (extraFees !== null) {
            total += extraFees;
            breakdown.feesDetails = {
                originalCurrency: "CNY",
                originalAmount: cnyAmount,
                usdAmount: extraFees,
            };
            console.log(`  ¥${cnyAmount.toFixed(2)} CNY = $${extraFees.toFixed(2)} USD`);
        } else {
            console.log(`  Not available`);
        }
    } else {
        console.log(`  Not available`);
    }

    // Final calculation
    const finalTotal = roundToDecimals(total, USD_PRECISION);
    console.log(`\nCALCULATION SUMMARY:`);
    console.log(`  Product Subtotal: $${productSubtotal.toFixed(2)}`);
    console.log(`  Shipping Cost: $${shippingCost.toFixed(2)}`);
    console.log(`  Extra Fees: $${extraFees.toFixed(2)}`);
    console.log(`  TOTAL: $${finalTotal.toFixed(2)}`);
    console.log(`===========================================================\n`);

    return finalTotal;
} /**
 * Updates purchase orders with missing currency values
 */
async function updatePurchaseOrders() {
    try {
        // Get all purchase orders with their items and related inventory batches
        const purchaseOrders = await prisma.purchaseOrder.findMany({
            include: {
                items: {
                    include: {
                        inventoryBatch: true,
                    },
                },
            },
        });

        console.log(`Found ${purchaseOrders.length} purchase orders to process`);

        let ordersUpdated = 0;
        let itemsUpdated = 0;
        let batchesUpdated = 0;
        let cogsItemsUpdated = 0;

        // for (const order of purchaseOrders) {
        //     if (!order.usdToCnyRate) {
        //         console.log(`Skipping order #${order.id} (batch ${order.batchNumber}) - no exchange rate defined`);
        //         continue;
        //     }

        //     const rate = Number(order.usdToCnyRate);
        //     let orderUpdated = false;

        //     // Calculate and update total USD if requested
        //     if (shouldUpdateTotal) {
        //         const calculatedTotal = calculateOrderTotalUsd(order, rate);
        //         await prisma.purchaseOrder.update({
        //             where: { id: order.id },
        //             data: { calculatedTotalUsd: calculatedTotal },
        //         });
        //         console.log(
        //             `Updated order #${order.id} (batch ${order.batchNumber}) with calculated total: $${calculatedTotal}`
        //         );
        //         ordersUpdated++;
        //     }

        //     // Update order-level costs
        //     const updates = {};

        //     if (order.shippingCostUsd === null && order.shippingCostCny !== null) {
        //         updates.shippingCostUsd = cnyToUsd(Number(order.shippingCostCny), rate);
        //         orderUpdated = true;
        //     } else if (order.shippingCostCny === null && order.shippingCostUsd !== null) {
        //         updates.shippingCostCny = usdToCny(Number(order.shippingCostUsd), rate);
        //         orderUpdated = true;
        //     }

        //     if (order.extraFeesUsd === null && order.extraFeesCny !== null) {
        //         updates.extraFeesUsd = cnyToUsd(Number(order.extraFeesCny), rate);
        //         orderUpdated = true;
        //     } else if (order.extraFeesCny === null && order.extraFeesUsd !== null) {
        //         updates.extraFeesCny = usdToCny(Number(order.extraFeesUsd), rate);
        //         orderUpdated = true;
        //     }

        //     // If we need to update the order
        //     if (orderUpdated) {
        //         await prisma.purchaseOrder.update({
        //             where: { id: order.id },
        //             data: updates,
        //         });
        //         ordersUpdated++;
        //         console.log(`Updated purchase order #${order.id} (batch ${order.batchNumber})`);
        //     }

        //     // Update item-level costs
        //     for (const item of order.items) {
        //         let itemUpdated = false;
        //         const itemUpdates = {};

        //         // If overwrite flag is used, recalculate costPerItemUsd from CNY values
        //         if (shouldOverwrite && item.costPerItemCny !== null) {
        //             itemUpdates.costPerItemUsd = cnyToUsd(Number(item.costPerItemCny), rate);
        //             itemUpdated = true;
        //             console.log(
        //                 `Overwriting costPerItemUsd for item #${item.id} with ${itemUpdates.costPerItemUsd} USD`
        //             );
        //         } else if (item.costPerItemUsd === null && item.costPerItemCny !== null) {
        //             itemUpdates.costPerItemUsd = cnyToUsd(Number(item.costPerItemCny), rate);
        //             itemUpdated = true;
        //         } else if (item.costPerItemCny === null && item.costPerItemUsd !== null) {
        //             itemUpdates.costPerItemCny = usdToCny(Number(item.costPerItemUsd), rate);
        //             itemUpdated = true;
        //         }

        //         if (itemUpdated) {
        //             await prisma.purchaseOrderItem.update({
        //                 where: { id: item.id },
        //                 data: itemUpdates,
        //             });
        //             itemsUpdated++;
        //         }

        //         // Update inventory batch costs if they exist
        //         if (item.inventoryBatch) {
        //             let batchUpdated = false;
        //             const batchUpdates = {};

        //             if (item.inventoryBatch.costUSD === null && item.inventoryBatch.costCNY !== null) {
        //                 batchUpdates.costUSD = cnyToUsd(Number(item.inventoryBatch.costCNY), rate);
        //                 batchUpdated = true;
        //             } else if (item.inventoryBatch.costCNY === null && item.inventoryBatch.costUSD !== null) {
        //                 batchUpdates.costCNY = usdToCny(Number(item.inventoryBatch.costUSD), rate);
        //                 batchUpdated = true;
        //             }

        //             if (batchUpdated) {
        //                 await prisma.inventoryBatch.update({
        //                     where: { id: item.inventoryBatch.id },
        //                     data: batchUpdates,
        //                 });
        //                 batchesUpdated++;
        //             }
        //         }
        //     }
        // }

        // Update CustomerOrderItem COGS values if flag is set
        if (shouldUpdateCogs) {
            console.log("\nUpdating CustomerOrderItem COGS values from CNY to USD...");

            // Get exchange rates from all purchase orders for lookup
            const exchangeRates = {};
            for (const order of purchaseOrders) {
                if (order.usdToCnyRate && order.batchNumber) {
                    exchangeRates[order.batchNumber] = Number(order.usdToCnyRate);
                }
            }

            // We'll use a standard rate if we can't determine one
            const defaultRate = 7.03; // Default USD to CNY rate if we can't find a specific one

            // Get all CustomerOrderItems with CNY COGS values
            const customerOrderItems = await prisma.customerOrderItem.findMany({
                where: {
                    cogs: {
                        not: null,
                    },
                },
                include: {
                    variant: {
                        include: {
                            inventoryBatches: {
                                include: {
                                    purchaseOrderItem: {
                                        include: {
                                            order: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });

            console.log(`Found ${customerOrderItems.length} customer order items to process`);

            for (const item of customerOrderItems) {
                // Skip if no COGS value
                if (item.cogs === null) continue;

                // Get the exchange rate from the related variant's inventory batches
                let rate = null;

                // Try to find a rate from the related inventory batches
                if (item.variant && item.variant.inventoryBatches && item.variant.inventoryBatches.length > 0) {
                    for (const batch of item.variant.inventoryBatches) {
                        if (
                            batch.purchaseOrderItem &&
                            batch.purchaseOrderItem.order &&
                            batch.purchaseOrderItem.order.usdToCnyRate
                        ) {
                            rate = Number(batch.purchaseOrderItem.order.usdToCnyRate);
                            break;
                        }
                    }
                }

                // If we still don't have a rate, use the default
                if (!rate) {
                    console.log(
                        `Using default exchange rate (${defaultRate}) for item #${item.id} - couldn't find specific rate`
                    );
                    rate = defaultRate;
                }

                // Convert from CNY to USD
                const currentCogsCNY = Number(item.cogs);
                const newCogsUSD = cnyToUsd(currentCogsCNY, rate);

                if (newCogsUSD !== null) {
                    await prisma.customerOrderItem.update({
                        where: { id: item.id },
                        data: { cogs: newCogsUSD },
                    });

                    console.log(
                        `Updated CustomerOrderItem #${item.id}: COGS ¥${currentCogsCNY.toFixed(2)} CNY -> $${newCogsUSD.toFixed(2)} USD (rate: ${rate})`
                    );
                    cogsItemsUpdated++;
                }
            }
        }

        console.log("\n===== UPDATE SUMMARY =====");
        console.log(`Purchase Orders Updated: ${ordersUpdated}`);
        console.log(`Purchase Order Items Updated: ${itemsUpdated}`);
        console.log(`Inventory Batches Updated: ${batchesUpdated}`);
        if (shouldUpdateCogs) {
            console.log(`Customer Order Items (COGS) Updated: ${cogsItemsUpdated}`);
        }
        console.log("=========================\n");
    } catch (error) {
        console.error("Error updating currency values:", error);
    } finally {
        await prisma.$disconnect();
    }
}

// Execute the main function
updatePurchaseOrders()
    .then(() => console.log("Currency update process completed."))
    .catch((e) => console.error("Error running update script:", e));
