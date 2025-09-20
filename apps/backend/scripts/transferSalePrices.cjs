const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");

const prisma = new PrismaClient();

async function main() {
    const filePath = path.resolve(__dirname, "products.csv");
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

    const productsFromCSV = parseResult.data;
    console.log(`Found ${productsFromCSV.length} rows in the CSV file.`);

    let updatedCount = 0;
    for (const [index, row] of productsFromCSV.entries()) {
        const legacySku = row["Full SKU"]?.trim();
        let salePriceRaw = row["Sale Price"]?.trim();
        // Sanitize salePrice: remove $ and commas
        const salePrice = salePriceRaw ? salePriceRaw.replace(/[$,]/g, "") : "";
        if (!legacySku || !salePrice || isNaN(Number(salePrice))) {
            console.warn(`Skipping row ${index + 1}: missing or invalid Full SKU or Sale Price.`);
            continue;
        }
        try {
            const variant = await prisma.productVariant.findUnique({
                where: { legacySku: legacySku },
            });
            if (!variant) {
                console.warn(`No productVariant found for legacySku: ${legacySku} (row ${index + 1})`);
                continue;
            }
            await prisma.productVariant.update({
                where: { id: variant.id },
                data: { salePrice: Number(salePrice) },
            });
            updatedCount++;
            console.log(`Updated salePrice for legacySku: ${legacySku} to ${salePrice}`);
        } catch (err) {
            console.error(`Error updating variant for legacySku: ${legacySku} (row ${index + 1}):`, err);
        }
    }
    console.log(`✅ Updated salePrice for ${updatedCount} productVariants.`);
}

main()
    .catch((e) => {
        console.error("❌ An error occurred during sale price transfer:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
