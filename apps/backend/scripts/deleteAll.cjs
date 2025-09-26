const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const tableNameList2 = [
    "InventoryBatch",
    "StockChange",
    "PurchaseOrderItem",
    "PurchaseOrder",
    "ProductVariant",
    "Product",
    "CustomerOrderItem",
    "CustomerOrder",
    "Customer",
];
const tableNameList = ["CustomerOrderItem", "CustomerOrder", "Customer"];
// const tableNameList3 = [
//     "InventoryBatch",
//     "StockChange",
//     "PurchaseOrderItem",
//     "PurchaseOrder",
//     "ProductVariant",
//     "Product",
//     "CustomerOrderItem",
//     "CustomerOrder",
//     "Customer",
// ];

async function main() {
    for (const tableName of tableNameList2) {
        // await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY;`);
        await prisma.$executeRawUnsafe(`DELETE FROM "${tableName}" CASCADE`);
        await prisma.$executeRawUnsafe(`ALTER SEQUENCE "${tableName}_id_seq" RESTART WITH 1`);
        console.log("All entries deleted and ID sequence reset for table:", tableName);
    }
}

main()
    .catch((e) => console.error(e))
    .finally(() => prisma.$disconnect());
