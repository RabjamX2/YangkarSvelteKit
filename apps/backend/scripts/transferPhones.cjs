// Using 'require' for importing modules, which is standard in basic Node.js scripts.
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");

// Initialize the Prisma Client
const prisma = new PrismaClient();

/**
 * Main function to run the data transfer script for phoneList.csv.
 */
async function main() {
    // Path to phoneList.csv
    const filePath = path.resolve(__dirname, "phoneOrders.csv");
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

    const phonesFromCSV = parseResult.data;
    console.log(`Found ${phonesFromCSV.length} rows in the CSV file.`);

    // For phoneList.csv, treat all as a single batch (batchNumber = 1)
    const batchNumber = 4;
    const batchItems = phonesFromCSV;

    // Find or create PurchaseOrder for this batchNumber
    let purchaseOrder = await prisma.purchaseOrder.findFirst({
        where: { batchNumber: batchNumber },
    });
    if (!purchaseOrder) {
        purchaseOrder = await prisma.purchaseOrder.create({
            data: {
                batchNumber: batchNumber,
                arrivalDate: null,
            },
        });
    }

    for (const [index, item] of batchItems.entries()) {
        try {
            // Required fields: Category, Style, Color / Type, Size, Item name, CNY Per, USD Per, Quantity
            if (
                !item["Category"] ||
                !item["Style"] ||
                !item["Color / Type"] ||
                !item["Size"] ||
                !item["Item name"] ||
                !item["ORDER DATE"]
            ) {
                console.warn(`Skipping row ${index + 1} due to missing required fields.`);
                continue;
            }
            // Use a default supplier for phone cases
            const supplierName = "Phone Supplier";
            let supplier = await prisma.supplier.findFirst({
                where: { name: { equals: supplierName, mode: "insensitive" } },
            });
            if (!supplier) {
                supplier = await prisma.supplier.create({
                    data: {
                        name: supplierName,
                        idString: "phone",
                    },
                });
                console.log(`Created new supplier: ${supplier.name}`);
            }
            // Find or create Category
            let category = await prisma.category.findFirst({
                where: { name: { equals: item["Category"], mode: "insensitive" } },
            });
            if (!category) {
                category = await prisma.category.create({
                    data: { name: item["Category"] },
                });
                console.log(`Created new category: ${category.name}`);
            }
            // Product: skuBase = phoneCase + Style (e.g., "phoneCaseSnowlion")
            const skuBase = `phon_phon_${item["Style"].toLowerCase().replace(/\s+/g, "-")}`;
            const product = await prisma.product.upsert({
                where: { skuBase },
                update: {
                    displayName: item["Item name"] || skuBase,
                    style: item["Style"],
                    notes: null,
                    supplierID: supplier.id,
                    categoryID: category.id,
                },
                create: {
                    skuBase,
                    displayName: item["Item name"] || skuBase,
                    style: item["Style"],
                    notes: null,
                    supplierID: supplier.id,
                    categoryID: category.id,
                },
            });
            // ProductVariant: sku = skuBase + Color/Type + Size (e.g., "phoneCaseSnowlioniPhone13")
            const sku = `${skuBase}_${item["Color / Type"].toLowerCase().replace(/\s+/g, "-")}_${item["Size"].toLowerCase().replace(/\s+/g, "-")}`;
            const variant = await prisma.productVariant.upsert({
                where: { sku },
                update: {
                    color: item["Color / Type"] || null,
                    size: item["Size"] || null,
                    salePrice: item["USD Per"] ? parseFloat(item["USD Per"].replace(/[$,]/g, "")) : null,
                    productID: product.id,
                },
                create: {
                    sku,
                    color: item["Color / Type"] || null,
                    size: item["Size"] || null,
                    salePrice: item["USD Per"] ? parseFloat(item["USD Per"].replace(/[$,]/g, "")) : null,
                    productID: product.id,
                },
            });
            // Create PurchaseOrderItem
            await prisma.purchaseOrderItem.create({
                data: {
                    quantityOrdered: item["Quantity"] ? parseInt(item["Quantity"], 10) : 0,
                    costPerItemCny: item["CNY Per"] ? parseFloat(item["CNY Per"].replace(/[¥,]/g, "")) : null,
                    costPerItemUsd: item["USD Per"] ? parseFloat(item["USD Per"].replace(/[$,]/g, "")) : null,
                    PurchaseOrderID: purchaseOrder.id,
                    ProductVariantID: variant.id,
                },
            });
            console.log(`Processed row ${index + 1}: ${sku}`);
        } catch (err) {
            console.error(`Error processing row ${index + 1}:`, err);
        }
    }

    console.log("✅ Phone cases transferred successfully!");
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
