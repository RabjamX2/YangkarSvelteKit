// Using 'require' for importing modules, which is standard in basic Node.js scripts.
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");

// Initialize the Prisma Client
const prisma = new PrismaClient();

/**
 * Main function to run the data transfer script.
 */
async function main() {
    // Construct the path to your CSV file.
    // This script assumes the CSV file is in a 'data' directory
    // relative to the script's location.
    // Adjust this path if your file is located elsewhere.
    const filePath = path.resolve(__dirname, "test.csv");

    console.log(`Reading CSV file from: ${filePath}`);

    // Read the CSV file from the filesystem.
    const fileContent = fs.readFileSync(filePath, "utf8");

    // Parse the CSV data using papaparse.
    // `header: true` tells papaparse to use the first row as object keys.
    const parseResult = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
    });

    if (parseResult.errors.length > 0) {
        console.error("Errors parsing CSV:", parseResult.errors);
        throw new Error("Failed to parse CSV file.");
    }

    const productsFromCSV = parseResult.data;
    console.log(`Found ${productsFromCSV.length} products in the CSV file.`);

    // Process each row individually (no transaction)
    for (const [index, item] of productsFromCSV.entries()) {
        try {
            console.log(`Processing item ${index + 1}/${productsFromCSV.length}: ${item["Full SKU"]}`);

            if (!item["Supplier Name"] || !item["Category"] || !item["SKU Name"] || !item["Full SKU"]) {
                console.warn(`Skipping row ${index + 1} due to missing required fields.`);
                continue;
            }

            // 1. Find or create the Supplier
            let supplier = await prisma.supplier.findFirst({
                where: { name: { equals: item["Supplier Name"], mode: "insensitive" } },
            });

            let supplierDict = {
                "Bhod Thakchen": "bt",
                "Phama Tsering Logya": "ptl",
                Gyencha: "gc",
                TaoBao: "tb",
                DeFish: "df",
                BhodLa: "bl",
                Losan: "los",
            };

            if (!supplier) {
                supplier = await prisma.supplier.create({
                    data: {
                        name: item["Supplier Name"],
                        idString: supplierDict[item["Supplier Name"]],
                    },
                });
                console.log(`Created new supplier: ${supplier.name}`);
            }

            // 2. Find or create the Category
            let category = await prisma.category.findFirst({
                where: { name: { equals: item["Category"], mode: "insensitive" } },
            });

            if (!category) {
                category = await prisma.category.create({
                    data: {
                        name: item["Category"],
                    },
                });
                console.log(`Created new category: ${category.name}`);
            }

            // 3. Find or create the parent Product (upsert)
            const product = await prisma.product.upsert({
                where: { skuBase: item["SKU Name"] },
                update: {
                    name: item["Item Name"],
                    style: item["Types"],
                    notes: item["Notes"],
                    supplierId: supplier.id,
                    categoryId: category.id,
                },
                create: {
                    skuBase: item["SKU Name"],
                    name: item["Item Name"],
                    style: item["Types"],
                    notes: item["Notes"],
                    supplierId: supplier.id,
                    categoryId: category.id,
                },
            });

            // 4. Create or update the Product Variant (upsert)
            await prisma.productVariant.upsert({
                where: { sku: item["Full SKU"] },
                update: {
                    color: item["Types"],
                    size: item["Sizes"],
                    costCny: parseFloat(item["Price"]) || 0,
                    costUsd: parseFloat(item["Price USD"]) || 0,
                    salePrice: parseFloat(item["Sale Price"]) || 0,
                    stock: parseInt(item["Stock"], 10) || 0,
                    productId: product.id,
                },
                create: {
                    sku: item["Full SKU"],
                    color: item["Types"],
                    size: item["Sizes"],
                    costCny: parseFloat(item["Price"]) || 0,
                    costUsd: parseFloat(item["Price USD"]) || 0,
                    salePrice: parseFloat(item["Sale Price"]) || 0,
                    stock: parseInt(item["Stock"], 10) || 0,
                    productId: product.id,
                },
            });
        } catch (err) {
            console.error(`Error processing item ${index + 1}:`, err);
        }
    }

    console.log("✅ Products transferred successfully!");
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
