import express from "express";
import prismaPkg from "@prisma/client";
import asyncHandler from "../middleware/asyncHandler.js";

const { PrismaClient } = prismaPkg;
const router = express.Router();
const prisma = new PrismaClient();

const validateCart = asyncHandler(async (req, res) => {
    const { items } = req.body; // Expect an array of { productVariantId: number, quantity: number }

    if (!Array.isArray(items) || items.length === 0) {
        res.status(400);
        throw new Error("Cart items are required.");
    }

    const validationResults = [];
    let allItemsValid = true;

    for (const item of items) {
        const variant = await prisma.productVariant.findUnique({
            where: { id: item.productVariantId },
        });

        if (!variant) {
            validationResults.push({
                productVariantId: item.productVariantId,
                isValid: false,
                reason: "Product not found.",
            });
            allItemsValid = false;
        } else if (variant.stock < item.quantity) {
            validationResults.push({
                productVariantId: item.productVariantId,
                isValid: false,
                reason: `Insufficient stock. Only ${variant.stock} left.`,
                availableStock: variant.stock,
            });
            allItemsValid = false;
        } else {
            validationResults.push({
                productVariantId: item.productVariantId,
                isValid: true,
                reason: "In stock.",
                availableStock: variant.stock,
            });
        }
    }

    res.status(200).json({
        isValid: allItemsValid,
        validationResults,
    });
});

router.post("/cart/validate", validateCart);

export default router;
