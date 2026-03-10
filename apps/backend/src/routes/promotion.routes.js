import express from "express";
import prismaPkg from "@prisma/client";
import asyncHandler from "../middleware/asyncHandler.js";
import authenticateToken from "../middleware/authenticateToken.js";

const { PrismaClient } = prismaPkg;
const router = express.Router();
const prisma = new PrismaClient();

// Include shape for promotion items
const itemInclude = {
    variant: {
        include: {
            product: {
                select: { displayName: true, skuBase: true },
            },
        },
    },
};

// GET /api/promotions — all promotions with their items
const getPromotions = asyncHandler(async (req, res) => {
    const promotions = await prisma.promotion.findMany({
        include: {
            items: { include: itemInclude },
        },
        orderBy: { startDate: "desc" },
    });
    res.json(promotions);
});

// POST /api/promotions — create a new promotion
const createPromotion = asyncHandler(async (req, res) => {
    const { name, description, startDate, endDate, isActive, discountType, discountValue } = req.body;

    if (!name || !startDate || !endDate) {
        return res.status(400).json({ error: "name, startDate, and endDate are required" });
    }

    const promotion = await prisma.promotion.create({
        data: {
            name,
            description: description || null,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            isActive: isActive !== undefined ? Boolean(isActive) : true,
            discountType: discountType || null,
            discountValue: discountValue != null && discountValue !== "" ? parseFloat(discountValue) : null,
        },
        include: { items: { include: itemInclude } },
    });

    res.status(201).json(promotion);
});

// PUT /api/promotions/:id — update promotion metadata
const updatePromotion = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const allowed = ["name", "description", "startDate", "endDate", "isActive"];
    const data = {};

    for (const key of allowed) {
        if (req.body[key] !== undefined) {
            if (key === "startDate" || key === "endDate") {
                data[key] = new Date(req.body[key]);
            } else {
                data[key] = req.body[key];
            }
        }
    }

    // Handle discount fields — allow explicit null to clear them
    if ("discountType" in req.body) {
        data.discountType = req.body.discountType || null;
    }
    if ("discountValue" in req.body) {
        data.discountValue =
            req.body.discountValue != null && req.body.discountValue !== "" ? parseFloat(req.body.discountValue) : null;
    }

    const promotion = await prisma.promotion.update({
        where: { id },
        data,
        include: { items: { include: itemInclude } },
    });

    res.json(promotion);
});

// DELETE /api/promotions/:id — delete promotion and all its items (cascade)
const deletePromotion = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    await prisma.promotion.delete({ where: { id } });
    res.json({ success: true });
});

// POST /api/promotions/:id/items — add a variant to a promotion
const addPromotionItem = asyncHandler(async (req, res) => {
    const promotionId = parseInt(req.params.id);
    const { productVariantId, promotionPrice } = req.body;

    if (!productVariantId || promotionPrice === undefined || promotionPrice === null) {
        return res.status(400).json({ error: "productVariantId and promotionPrice are required" });
    }

    const item = await prisma.promotionItem.create({
        data: {
            promotionId,
            productVariantId: parseInt(productVariantId),
            promotionPrice: parseFloat(promotionPrice),
        },
        include: itemInclude,
    });

    res.status(201).json(item);
});

// PUT /api/promotions/:id/items/:itemId — update a promotion item's price
const updatePromotionItem = asyncHandler(async (req, res) => {
    const itemId = parseInt(req.params.itemId);
    const { promotionPrice } = req.body;

    if (promotionPrice === undefined || promotionPrice === null) {
        return res.status(400).json({ error: "promotionPrice is required" });
    }

    const item = await prisma.promotionItem.update({
        where: { id: itemId },
        data: { promotionPrice: parseFloat(promotionPrice) },
        include: itemInclude,
    });

    res.json(item);
});

// DELETE /api/promotions/:id/items/:itemId — remove a variant from a promotion
const deletePromotionItem = asyncHandler(async (req, res) => {
    const itemId = parseInt(req.params.itemId);
    await prisma.promotionItem.delete({ where: { id: itemId } });
    res.json({ success: true });
});

// --- Route Registration ---
router.get("/promotions", authenticateToken, getPromotions);
router.post("/promotions", authenticateToken, createPromotion);
router.put("/promotions/:id", authenticateToken, updatePromotion);
router.delete("/promotions/:id", authenticateToken, deletePromotion);
router.post("/promotions/:id/items", authenticateToken, addPromotionItem);
router.put("/promotions/:id/items/:itemId", authenticateToken, updatePromotionItem);
router.delete("/promotions/:id/items/:itemId", authenticateToken, deletePromotionItem);

export default router;
