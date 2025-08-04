import express from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import asyncHandler from "../middleware/asyncHandler.js";

const router = express.Router();
const prisma = new PrismaClient();

// --- Route Controllers ---

const getProducts = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 24;
    const offset = (page - 1) * limit;
    const sort = req.query.sort || "default";
    const categories = req.query.category ? req.query.category.split(",") : [];

    let orderBy;
    switch (sort) {
        case "price_asc":
            orderBy = Prisma.sql`"minSalePrice" ASC NULLS LAST`;
            break;
        case "price_desc":
            orderBy = Prisma.sql`"minSalePrice" DESC NULLS LAST`;
            break;
        case "alpha":
            orderBy = Prisma.sql`p.name ASC`;
            break;
        default:
            orderBy = Prisma.sql`p."createdAt" DESC`;
            break;
    }

    const whereClauses = [];
    if (categories.length > 0) {
        whereClauses.push(Prisma.sql`p."categoryName" IN (${Prisma.join(categories)})`);
    }
    const where = whereClauses.length > 0 ? Prisma.sql`WHERE ${Prisma.join(whereClauses, " AND ")}` : Prisma.empty;

    const products = await prisma.$queryRaw`
      SELECT
        p.id, p."skuBase", p.name, p."createdAt",
        (SELECT MIN(pv."salePrice") FROM "ProductVariant" pv WHERE pv."productSkuBase" = p."skuBase" AND pv."salePrice" IS NOT NULL) as "minSalePrice",
        (SELECT pv."imgUrl" FROM "ProductVariant" pv WHERE pv."productSkuBase" = p."skuBase" AND pv."salePrice" IS NOT NULL ORDER BY pv."salePrice" ASC LIMIT 1) as "displayImageUrl"
      FROM "Product" p
      ${where}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const whereFilter = categories.length > 0 ? { categoryName: { in: categories } } : {};
    const totalProductsResult = await prisma.product.count({ where: whereFilter });

    res.json({
        data: products,
        meta: {
            totalProducts: totalProductsResult,
            currentPage: page,
            totalPages: Math.ceil(totalProductsResult / limit),
        },
    });
});

const getCategories = asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
        orderBy: { name: "asc" },
    });
    res.json(categories);
});

// --- Route Definitions ---
router.get("/products", getProducts);
router.get("/categories", getCategories);
// You would add POST, PUT, DELETE product routes here later

export default router;
