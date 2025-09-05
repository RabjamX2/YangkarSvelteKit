// Using 'require' for importing modules, which is standard in basic Node.js scripts.
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");
const { CLIENT_RENEG_WINDOW } = require("tls");

// Initialize the Prisma Client
const prisma = new PrismaClient();

/**
 * Main function to run the data transfer script.
 */
async function main() {
    // Path to the new orderList.csv
    const filePath = path.resolve(__dirname, "orderList.csv");
    console.log(`Reading CSV file from: ${filePath}`);

    const fileContent = fs.readFileSync(filePath, "utf8");
    const parseResult = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
    });

    if (parseResult.errors.length > 0) {
        console.error("Errors parsing CSV:", parseResult.errors);
        throw new Error("Failed to parse CSV file.");
    }

    const ordersFromCSV = parseResult.data;
    console.log(`Found ${ordersFromCSV.length} rows in the CSV file.`);

    // Helper: supplierDict for idString
    const supplierDict = {
        "Bhod Thakchen": "bt",
        "Phama Tsering Logya": "ptl",
        Gyencha: "gc",
        TaoBao: "tb",
        DeFish: "df",
        BhodLa: "bl",
        Losan: "los",
        "Men You Ping": "myp",
        Jama: "jm",
    };

    // Group all rows by batchNumber
    const batchGroups = {};
    for (const item of ordersFromCSV) {
        const batchNumber = item["BatchNumber"] ? parseInt(item["BatchNumber"], 10) : 1;
        if (!batchGroups[batchNumber]) batchGroups[batchNumber] = [];
        batchGroups[batchNumber].push(item);
    }

    for (const batchNumber in batchGroups) {
        const batchItems = batchGroups[batchNumber];
        // Find earliest orderDate in batch
        const orderDates = batchItems.map((i) => new Date(i["ORDER DATE"])).filter((d) => !isNaN(d));
        const orderDate = orderDates.length ? new Date(Math.min(...orderDates.map((d) => d.getTime()))) : new Date();
        // hasArrived if any item in batch has arrived
        const hasArrived = batchItems.some((i) => i["Arrived?"] === "TRUE");
        // shipDate/arrivalDate left null for now

        // Find or create PurchaseOrder for this batchNumber
        let purchaseOrder = await prisma.purchaseOrder.findFirst({
            where: { batchNumber: parseInt(batchNumber, 10) },
        });
        if (!purchaseOrder) {
            purchaseOrder = await prisma.purchaseOrder.create({
                data: {
                    batchNumber: parseInt(batchNumber, 10),
                    arrivalDate: null,
                    hasArrived,
                },
            });
        }

        for (const [index, item] of batchItems.entries()) {
            try {
                if (
                    !item["Seller"] ||
                    !item["Category"] ||
                    !item["SKU Main"] ||
                    !item["SKU Specific"] ||
                    !item["ORDER DATE"]
                ) {
                    console.warn(`Skipping row ${index + 1} in batch ${batchNumber} due to missing required fields.`);
                    console.warn(
                        `Missing fields are: ${!item["Seller"] ? "Seller " : ""}${!item["Category"] ? "Category " : ""}${!item["SKU Main"] ? "SKU Main " : ""}${!item["SKU Specific"] ? "SKU Specific " : ""}${!item["ORDER DATE"] ? "ORDER DATE " : ""}`
                    );
                    continue;
                }
                // 1. Find or create Supplier
                let supplier = await prisma.supplier.findFirst({
                    where: { name: { equals: item["Seller"], mode: "insensitive" } },
                });
                if (!supplier) {
                    supplier = await prisma.supplier.create({
                        data: {
                            name: item["Seller"],
                            idString: supplierDict[item["Seller"]] || item["Seller"].toLowerCase().replace(/\s/g, ""),
                        },
                    });
                    console.log(`Created new supplier: ${supplier.name}`);
                }
                // 2. Find or create Category
                let category = await prisma.category.findFirst({
                    where: { name: { equals: item["Category"], mode: "insensitive" } },
                });
                if (!category) {
                    category = await prisma.category.create({
                        data: { name: item["Category"] },
                    });
                    console.log(`Created new category: ${category.name}`);
                }
                // 3. Find or create Product (skuBase = SKU Main)
                const product = await prisma.product.upsert({
                    where: { skuBase: item["SKU Main"] },
                    update: {
                        name: item["Item name"] || item["SKU Main"],
                        style: item["Style"],
                        notes: item["Notes"] || null,
                        supplierName: supplier.name,
                        categoryName: category.name,
                    },
                    create: {
                        skuBase: item["SKU Main"],
                        name: item["Item name"] || item["SKU Main"],
                        style: item["Style"],
                        notes: item["Notes"] || null,
                        supplierName: supplier.name,
                        categoryName: category.name,
                    },
                });
                // 4. Upsert ProductVariant (sku = SKU Specific)
                const variant = await prisma.productVariant.upsert({
                    where: { sku: item["SKU Specific"] },
                    update: {
                        color: item["Color / Type"] || null,
                        size: item["Size"] || null,
                        costCny: item["CNY Per"] ? parseFloat(item["CNY Per"].replace(/[¥,]/g, "")) : null,
                        costUsd: item["USD Per"] ? parseFloat(item["USD Per"].replace(/[$,]/g, "")) : null,
                        stock: item["Quantity"] ? parseInt(item["Quantity"], 10) : 0,
                        productSkuBase: product.skuBase,
                    },
                    create: {
                        sku: item["SKU Specific"],
                        color: item["Color / Type"] || null,
                        size: item["Size"] || null,
                        costCny: item["CNY Per"] ? parseFloat(item["CNY Per"].replace(/[¥,]/g, "")) : null,
                        costUsd: item["USD Per"] ? parseFloat(item["USD Per"].replace(/[$,]/g, "")) : null,
                        stock: item["Quantity"] ? parseInt(item["Quantity"], 10) : 0,
                        productSkuBase: product.skuBase,
                    },
                });
                // 5. Create PurchaseOrderItem
                await prisma.purchaseOrderItem.create({
                    data: {
                        quantityOrdered: item["Quantity"] ? parseInt(item["Quantity"], 10) : 0,
                        costPerItemCny: item["CNY Per"] ? parseFloat(item["CNY Per"].replace(/[¥,]/g, "")) : null,
                        costPerItemUsd: item["USD Per"] ? parseFloat(item["USD Per"].replace(/[$,]/g, "")) : null,
                        purchaseOrderId: purchaseOrder.id,
                        productVariantId: variant.id,
                    },
                });
                console.log(`Processed row ${index + 1} in batch ${batchNumber}: ${item["SKU Specific"]}`);
            } catch (err) {
                console.error(`Error processing row ${index + 1} in batch ${batchNumber}:`, err);
            }
        }
    }

    console.log("✅ Purchase orders and items transferred successfully!");
}

// Execute the main function and handle potential errors.
main()
    .catch((e) => {
        console.error("❌ An error occurred during the transfer:", e);
        process.exit(1);
    })
    .finally(async () => {
        // Ensure the Prisma client is disconnected when the script finishes.
        await prisma.$disconnect();
    });
