const { PrismaClient, PaymentStatus } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");

const prisma = new PrismaClient();

async function main() {
    // Read invoices.csv
    const invoicesPath = path.resolve(__dirname, "invoices.csv");
    const invoicesContent = fs.readFileSync(invoicesPath, "utf8");
    const invoicesResult = Papa.parse(invoicesContent, { header: true, skipEmptyLines: true });
    if (invoicesResult.errors.length > 0) {
        console.error("Errors parsing invoices.csv:", invoicesResult.errors);
        throw new Error("Failed to parse invoices.csv");
    }
    const invoices = invoicesResult.data;

    // Read invoiceItems.csv
    const itemsPath = path.resolve(__dirname, "invoiceItems.csv");
    const itemsContent = fs.readFileSync(itemsPath, "utf8");
    const itemsResult = Papa.parse(itemsContent, { header: true, skipEmptyLines: true });
    if (itemsResult.errors.length > 0) {
        console.error("Errors parsing invoiceItems.csv:", itemsResult.errors);
        throw new Error("Failed to parse invoiceItems.csv");
    }
    const invoiceItems = itemsResult.data;

    function sanitizeInvoiceNumber(invoiceNum) {
        if (invoiceNum && /^[A-Za-z]{2}0+\d+$/.test(invoiceNum)) {
            return invoiceNum.replace(/^([A-Za-z]{2})0+/, "$1");
        } else if (invoiceNum && /^[A-Za-z]{3}0+\d+$/.test(invoiceNum)) {
            return invoiceNum.replace(/^([A-Za-z]{3})0+/, "$1");
        } else {
            console.error(`Invoice number ${invoiceNum} does not match expected format.`);
            return false; // Return as is if it doesn't match expected format
        }
    }

    // Group items by Invoice#
    const itemsByInvoice = {};
    for (const item of invoiceItems) {
        let rawInvoiceNum = item["Invoice#"]?.trim();
        // Remove leading zeros after the first two or three letters (e.g., AB000123 -> AB123, ABS00123 -> ABS123)
        // This assumes invoice numbers start with letters followed by digits
        let invoiceNum = sanitizeInvoiceNumber(rawInvoiceNum);
        if (!invoiceNum) continue;
        if (!itemsByInvoice[invoiceNum]) itemsByInvoice[invoiceNum] = [];
        itemsByInvoice[invoiceNum].push(item);
    }

    let createdCount = 0;
    for (const invoice of invoices) {
        let rawInvoiceNum = invoice["Invoice#"]?.trim();
        let invoiceNum = sanitizeInvoiceNumber(rawInvoiceNum);

        if (!invoiceNum) continue;
        const items = itemsByInvoice[invoiceNum] || [];
        if (items.length === 0) {
            console.error(`No items found for invoice ${invoiceNum}`);
            continue;
        }
        try {
            let customerName = invoice["Customer Name"]?.trim() || null;
            let orderSalesChannel;
            // if invoice["Customer Name"] includes the string "In-Person" at all (case insensitive), set to IN_PERSON
            if (invoice["Customer Name"]?.toLowerCase().includes("in-person")) {
                orderSalesChannel = "IN_PERSON";
                // if it also include "(name)", then the name is the customerName
                if (invoice["Customer Name"].includes("(") && invoice["Customer Name"].includes(")")) {
                    const nameMatch = invoice["Customer Name"].match(/\(([^)]+)\)/);
                    if (nameMatch) {
                        customerName = nameMatch[1].trim();
                    }
                }
            } else if (invoice["Sales platform"]?.toLowerCase() === "online") {
                orderSalesChannel = "ONLINE";
            }

            let orderFulfillmentStatus;
            // If i use this later, add check for Status column
            if (orderSalesChannel === "IN_PERSON" && invoice["Paid?"] === "TRUE") {
                orderFulfillmentStatus = "PICKED_UP";
            } else if (orderSalesChannel === "ONLINE" && invoice["Paid?"] === "TRUE") {
                orderFulfillmentStatus = "DELIVERED";
            } else {
                console.error(`Cannot determine fulfillmentStatus for invoice ${invoiceNum}, setting to PROCESSING`);
                orderFulfillmentStatus = "PROCESSING";
            }

            let orderPaymentMethod;
            let orderMoneyHolder = null;
            if (invoice["Payment Type"]) {
                if (invoice["Payment Type"].toLowerCase().includes("cash")) {
                    orderPaymentMethod = "CASH";
                } else if (invoice["Payment Type"].toLowerCase().includes("zelle")) {
                    orderPaymentMethod = "ZELLE";
                    // If Zelle, set moneyHolder if available. for example, "Zelle R" mean recipient is "R" etc
                    // So remove "zelle" and trim. If nothing is left, set to null
                    // for example, If it includes "zelle r" (case insensitive), set moneyHolder to "R"
                    const moneyHolderMatch = invoice["Payment Type"].toLowerCase().match(/zelle\s*(.*)/)[1];
                    if (moneyHolderMatch[1]) {
                        console.log(`Money holder match for invoice ${invoiceNum}:`, moneyHolderMatch);
                        let orderMoneyHolderLetter = moneyHolderMatch[1].trim();
                        switch (orderMoneyHolderLetter) {
                            case "r":
                                orderMoneyHolder = "Rabjam";
                                break;
                            case "p":
                                orderMoneyHolder = "Pema";
                                break;
                            case "d":
                                orderMoneyHolder = "Dechen";
                                break;
                            default:
                                orderMoneyHolder = null;
                        }
                        console.log(console.log(`                      is `, orderMoneyHolder));
                    }
                }
            } else {
                orderPaymentMethod = null;
            }

            const order = await prisma.customerOrder.create({
                data: {
                    // TODO: If these enum definitions work, remove above enum parsing
                    legacyInvoiceNumber: invoiceNum,
                    salesChannel: orderSalesChannel,
                    fulfillmentStatus: orderFulfillmentStatus,
                    fulfilledAt: new Date(invoice["Order date"]),
                    customerName,
                    orderDate: invoice["Order date"] ? new Date(invoice["Order date"]) : undefined,
                    paymentStatus: PaymentStatus.PAID, // TODO: change if all aren't paid in this dataset
                    paymentMethod: orderPaymentMethod,
                    moneyHolder: orderMoneyHolder,
                    moneyCollected: true,
                    notes: invoice["Notes"] || null,
                    items: {
                        create: await Promise.all(
                            items.map(async (item) => {
                                // Find productVariant by SKU (Product column)
                                const variantSku = item["Product"]?.trim();
                                let variant = null;
                                if (variantSku) {
                                    variant = await prisma.productVariant.findFirst({
                                        where: { legacySku: variantSku },
                                    });
                                }
                                if (!variant) {
                                    console.error(
                                        `No productVariant found for legacySku: ${variantSku} (invoice ${invoiceNum})`
                                    );
                                    variant = await prisma.productVariant.findFirst({
                                        where: { sku: variantSku },
                                    });
                                    if (!variant) {
                                        console.error(
                                            `No productVariant found for SKU: ${variantSku} (invoice ${invoiceNum}) _______`
                                        );
                                        return null;
                                    } else {
                                        console.log(
                                            `! Found productVariant by SKU for sku: ${variantSku} (invoice ${invoiceNum})`
                                        );
                                    }
                                }
                                return {
                                    variant: { connect: { id: variant.id } },
                                    quantity: Number(item["Quantity"] || 0),
                                    salePrice:
                                        Number(item["Total Final Price"].replace(/[$,]/g, "")) /
                                        Number(item["Quantity"]), // Total Final Price divided by quantity
                                };
                            })
                        ),
                    },
                },
                include: { items: true },
            });

            // FIFO fulfillment: update inventory and COGS for each item
            for (const item of order.items) {
                try {
                    // FIFO fulfillment
                    const batches = await prisma.inventoryBatch.findMany({
                        where: {
                            productVariantId: item.productVariantId,
                            quantity: { gt: 0 },
                        },
                        include: {
                            purchaseOrderItem: {
                                include: { order: true },
                            },
                        },
                    });
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
                    let quantityToFulfill = item.quantity;
                    let totalCogs = 0;
                    for (const batch of batches) {
                        if (quantityToFulfill === 0) break;
                        const quantityFromThisBatch = Math.min(quantityToFulfill, batch.quantity);
                        const cost = batch.costCNY ?? batch.costUSD ?? 0;
                        totalCogs += quantityFromThisBatch * parseFloat(cost);
                        await prisma.inventoryBatch.update({
                            where: { id: batch.id },
                            data: {
                                quantity: { decrement: quantityFromThisBatch },
                            },
                        });
                        quantityToFulfill -= quantityFromThisBatch;
                    }
                    await prisma.customerOrderItem.update({
                        where: { id: item.id },
                        data: { cogs: totalCogs },
                    });

                    // Log stock change for sale
                    await prisma.stockChange.create({
                        data: {
                            productVariantId: item.productVariantId,
                            variant: { connect: { id: item.productVariantId } },
                            change: -item.quantity,
                            changeTime: order.fulfilledAt,
                            reason: "Sale",
                            user: "Imported",
                            orderId: order.id,
                            orderType: "CUSTOMER",
                        },
                    });

                    console.log(`Stock before changes for invoice ${invoiceNum}:`, stockAfterChanges);
                } catch (fifoErr) {
                    console.error(`FIFO fulfillment error for item ${item.id} in order ${order.id}:`, fifoErr);
                }
            }
            createdCount++;
            console.log(`Created CustomerOrder for invoice ${invoiceNum} with ${items.length} items.`);
        } catch (err) {
            console.error(`Error creating order for invoice ${invoiceNum}:`, err);
        }
    }
    console.log(`✅ Created ${createdCount} CustomerOrders.`);
}

main()
    .catch((e) => {
        console.error("❌ An error occurred during checkout transfer:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
