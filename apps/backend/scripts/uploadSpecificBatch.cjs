const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");

const prisma = new PrismaClient();

async function main() {
    const filePath = path.resolve(__dirname, "ordersBatch5.csv");
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
        "Bhod Thakchen": 1,
        "Phama Tsering Logya": 2,
        Gyencha: 3,
        TaoBao: 4,
        DeFish: 5,
        BhodLa: 6,
        Losan: 7,
        "Men You Ping": 8,
        Jama: 9,
        "Phone Supplier": 10,
        "Tsering Dolkar": 11,
        "Ram's Clothing": 12,
        "G-Purple": 13,
    };
    const supplierNames = {
        "Bhod Thakchen": "bt",
        "Phama Tsering Logya": "ptl",
        Gyencha: "gc",
        TaoBao: "tb",
        DeFish: "df",
        BhodLa: "bl",
        Losan: "ls",
        "Men You Ping": "myp",
        Jama: "jm",
        "Phone Supplier": "phon",
        "Tsering Dolkar": "mm",
        "Ram's Clothing": "rc",
        "G-Purple": "gp",
    };

    const categoryDict = {
        Chupa: 1,
        Wonju: 2,
        Jewelry: 3,
        "Phone Cases": 4,
    };
    const categoryNames = {
        Chupa: "chup",
        Wonju: "wonj",
        Jewelry: "jewe",
        "Phone Cases": "phon",
    };

    // Check if categories and suppliers exist
    const existingCategories = await prisma.category.findMany();
    const existingSuppliers = await prisma.supplier.findMany();
    for (const categoryName of Object.keys(categoryDict)) {
        if (!existingCategories.find((cat) => cat.name.toLowerCase() === categoryName.toLowerCase())) {
            console.error(`Category "${categoryName}" not found in database. Making them now.`);
        }
        await prisma.category.upsert({
            where: { name: categoryName },
            update: {
                code: categoryNames[categoryName],
            },
            create: {
                id: categoryDict[categoryName],
                name: categoryName,
                code: categoryNames[categoryName],
            },
        });
    }
    for (const supplierName of Object.keys(supplierDict)) {
        if (!existingSuppliers.find((sup) => sup.name.toLowerCase() === supplierName.toLowerCase())) {
            console.error(`Supplier "${supplierName}" not found in database. Making them now.`);
        }
        await prisma.supplier.upsert({
            where: { name: supplierName },
            update: {
                idString: supplierNames[supplierName],
            },
            create: {
                id: supplierDict[supplierName],
                name: supplierName,
                idString: supplierNames[supplierName],
            },
        });
    }

    // Group all rows by batchNumber
    const batchGroups = {};
    for (const item of ordersFromCSV) {
        const batchNumber = item["BatchNumber"] ? parseInt(item["BatchNumber"], 10) : 404;
        if (!batchGroups[batchNumber]) batchGroups[batchNumber] = [];
        batchGroups[batchNumber].push(item);
    }

    for (const batchNumber in batchGroups) {
        const batchItems = batchGroups[batchNumber];
        const newBatchNumber = 5; // Since we're only processing batch 5 CSV here

        // Find or create PurchaseOrder for this batchNumber
        let purchaseOrder = await prisma.purchaseOrder.findFirst({
            where: { batchNumber: parseInt(newBatchNumber, 10) },
        });

        let arrivalDate = new Date("2025-10-30 EST");
        if (!purchaseOrder) {
            purchaseOrder = await prisma.purchaseOrder.create({
                data: {
                    batchNumber: parseInt(newBatchNumber, 10),
                    arrivalDate,
                    hasArrived: false,
                },
            });
        }

        for (const [index, item] of batchItems.entries()) {
            try {
                if (!item["Style"] || !item["Category"] || !item["ORDER DATE"] || !item["Seller"]) {
                    console.warn(
                        `Skipping row ${index + 1} in batch ${newBatchNumber} due to missing required fields.`
                    );
                    console.warn(
                        `Missing fields are: ${!item["Seller"] ? "Seller " : ""}${!item["Category"] ? "Category " : ""}${!item["SKU Main"] ? "SKU Main " : ""}${!item["SKU Specific"] ? "SKU Specific " : ""}${!item["ORDER DATE"] ? "ORDER DATE " : ""}`
                    );
                    continue;
                }
                // 1. Find or create Supplier
                let supplier = await prisma.supplier.findFirst({
                    where: { id: { equals: supplierDict[item["Seller"]] } },
                });

                if (!supplier) {
                    console.log(`Supplier not found for ${item["Seller"]}`);
                    break;
                }

                // 2. Find or create Category
                let category = await prisma.category.findFirst({
                    where: { name: { equals: item["Category"], mode: "insensitive" } },
                });
                if (!category) {
                    console.log(`Category not found for ${item["Category"]}`);
                    break;
                }

                // Make it so the first part of SKU Main is a two digit supplier ID + two digit category ID
                // e.g., supplierDict["Bhod Thakchen"] = 1, categoryDict["Chupa"] = 1 => "0101"
                let skuIntBase = `${supplierDict[item["Seller"]].toString().padStart(2, "0")}${categoryDict[item["Category"]].toString().padStart(2, "0")}`;

                let skuBase = `${supplierNames[item["Seller"]]}_${categoryNames[item["Category"]]}_${item["Style"].toLowerCase().replace(/\s+/g, "-")}`;

                // 3. Find or create Product (skuBase = SKU Main)
                const product = await prisma.product.upsert({
                    where: { skuBase: skuBase },
                    update: {
                        displayName: item["Item name"],
                        style: item["Style"],
                        supplierId: supplier.id,
                        categoryId: category.id,
                    },
                    create: {
                        skuBase: skuBase,
                        displayName: item["Item name"],
                        style: item["Style"],
                        notes: item["Notes"] || null,
                        supplierId: supplier.id,
                        categoryId: category.id,
                    },
                });

                let skuSpecific = `${skuBase}_${item["Color / Type"].toLowerCase().replace(/\s+/g, "-") || "N/A"}_${item["Size"].toLowerCase().replace(/\s+/g, "-") || "N/A"}`;
                // 4. Upsert ProductVariant (sku = SKU Specific)
                const variant = await prisma.productVariant.upsert({
                    where: { sku: skuSpecific },
                    update: {
                        color: item["Color / Type"] || null,
                        size: item["Size"] || null,
                        productId: product.id,
                    },
                    create: {
                        sku: skuSpecific,
                        legacySku: item["SKU Specific"] || null,
                        color: item["Color / Type"] || null,
                        size: item["Size"] || null,
                        productId: product.id,
                    },
                });
                // 5. Find or create PurchaseOrderItem
                let purchaseOrderItem = await prisma.purchaseOrderItem.findFirst({
                    where: {
                        purchaseOrderId: purchaseOrder.id,
                        productVariantId: variant.id,
                    },
                });

                if (purchaseOrderItem) {
                    console.log(
                        `Updating existing item for row ${index + 1} in batch ${newBatchNumber}: ${skuSpecific}`
                    );
                    await prisma.purchaseOrderItem.update({
                        where: {
                            id: purchaseOrderItem.id,
                        },
                        data: {
                            quantityOrdered: item["Quantity"] ? parseInt(item["Quantity"], 10) : 0,
                            costPerItemCny: item["CNY Per"] ? parseFloat(item["CNY Per"].replace(/[¥,]/g, "")) : null,
                            costPerItemUsd: item["USD Per"] ? parseFloat(item["USD Per"].replace(/[$,]/g, "")) : null,
                        },
                    });
                } else {
                    console.log(`Creating new item for row ${index + 1} in batch ${newBatchNumber}: ${skuSpecific}`);
                    purchaseOrderItem = await prisma.purchaseOrderItem.create({
                        data: {
                            quantityOrdered: item["Quantity"] ? parseInt(item["Quantity"], 10) : 0,
                            costPerItemCny: item["CNY Per"] ? parseFloat(item["CNY Per"].replace(/[¥,]/g, "")) : null,
                            costPerItemUsd: item["USD Per"] ? parseFloat(item["USD Per"].replace(/[$,]/g, "")) : null,
                            order: { connect: { id: purchaseOrder.id } },
                            variant: { connect: { id: variant.id } },
                        },
                    });
                }
                console.log(`Processed row ${index + 1} in batch ${newBatchNumber}: ${skuSpecific}`);
            } catch (err) {
                console.error(`Error processing row ${index + 1} in batch ${newBatchNumber}:`, err);
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
