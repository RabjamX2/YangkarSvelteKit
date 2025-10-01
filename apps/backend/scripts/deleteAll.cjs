const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const tableNameList2 = [
    "InventoryBatch",
    "StockChange",
    "PurchaseOrderItem",
    "PurchaseOrder",
    "CustomerOrderItem",
    "CustomerOrder",
    "Customer",
    "ProductVariant",
    "Product",
];
const tableNameList = ["CustomerOrderItem", "CustomerOrder", "Customer"];
const tableNameList3 = ["InventoryBatch", "StockChange", "CustomerOrderItem", "CustomerOrder", "Customer"];
const tableNameList4 = [
    "InventoryBatch",
    "StockChange",
    "PurchaseOrderItem",
    "PurchaseOrder",
    "CustomerOrderItem",
    "CustomerOrder",
    "Customer",
];

async function main() {
    for (const tableName of tableNameList4) {
        await prisma.$executeRawUnsafe(`DELETE FROM "${tableName}" CASCADE`);
        await prisma.$executeRawUnsafe(`ALTER SEQUENCE "${tableName}_id_seq" RESTART WITH 1`);
        // Set all entries in a table to null for a specific column
        if (tableName === "InventoryBatch") {
            await prisma.$executeRawUnsafe(`UPDATE "PurchaseOrder" SET "hasArrived" = false`);
        }
        console.log("All entries deleted and ID sequence reset for table:", tableName);
    }
}

main()
    .catch((e) => console.error(e))
    .finally(() => prisma.$disconnect());
