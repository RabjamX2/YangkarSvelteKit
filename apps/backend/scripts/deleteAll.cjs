const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const tableName = "Product"; // Change this to your target table name

async function main() {
    await prisma.$executeRawUnsafe(`DELETE FROM "${tableName}" CASCADE`);
    // await prisma.$executeRawUnsafe(`ALTER SEQUENCE "${tableName}_id_seq" RESTART WITH 1`);
    console.log("All entries deleted and ID sequence reset for table:", tableName);
}

main()
    .catch((e) => console.error(e))
    .finally(() => prisma.$disconnect());
