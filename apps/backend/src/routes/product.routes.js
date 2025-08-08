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

const getProductBySku = asyncHandler(async (req, res) => {
    const { skuBase } = req.params;
    const product = await prisma.product.findUnique({
        where: { skuBase },
        include: {
            variants: {
                orderBy: [{ color: "asc" }, { size: "asc" }],
            },
        },
    });

    if (!product) {
        res.status(404);
        throw new Error("Product not found");
    }

    res.json(product);
});

const getCategories = asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
        orderBy: { name: "asc" },
    });
    res.json(categories);
});

const updateProductVariant = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    // Only allow updating certain fields for safety
    const allowedFields = ["sku", "color", "size", "salePrice", "stock"];
    const updateData = {};
    for (const field of allowedFields) {
        if (field in data) updateData[field] = data[field];
    }
    const updated = await prisma.productVariant.update({
        where: { id: Number(id) },
        data: updateData,
    });
    res.json(updated);
});

const getProductsWithVariants = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    // If limit param is provided, use it; otherwise, use 1000 for admin POS, else 24
    let limit = 24;
    if (typeof req.query.limit !== "undefined") {
        limit = parseInt(req.query.limit) || 24;
    } else if (req.query.all === "true" || req.headers["x-admin-pos"] === "true") {
        limit = 1000;
    }
    const offset = (page - 1) * limit;
    const products = await prisma.product.findMany({
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
            variants: {
                orderBy: [{ color: "asc" }, { size: "asc" }],
            },
        },
    });
    const totalProducts = await prisma.product.count();
    res.json({
        data: products,
        meta: {
            totalProducts,
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
        },
    });
});

// --- Route Definitions ---
router.get("/products", getProducts);
router.get("/products-with-variants", getProductsWithVariants);
router.get("/products/:skuBase", getProductBySku); // New route for single product
router.get("/categories", getCategories);
router.put("/variants/:id", updateProductVariant);
// You would add POST, PUT, DELETE product routes here later

export default router;
