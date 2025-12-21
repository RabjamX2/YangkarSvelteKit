import express from "express";
import prismaPkg from "@prisma/client";
import asyncHandler from "../middleware/asyncHandler.js";
import authenticateToken from "../middleware/authenticateToken.js";
import requireAdmin from "../middleware/requireAdmin.js";

const { PrismaClient } = prismaPkg;
const router = express.Router();
const prisma = new PrismaClient();

// Get all sellers/suppliers
const getSellers = asyncHandler(async (req, res) => {
    const sellers = await prisma.supplier.findMany({
        orderBy: {
            name: "asc",
        },
        include: {
            _count: {
                select: { products: true },
            },
        },
    });

    res.json(sellers);
});

// Get a single seller by ID
const getSellerById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const seller = await prisma.supplier.findUnique({
        where: { id: parseInt(id) },
        include: {
            products: {
                include: {
                    category: true,
                    variants: true,
                },
            },
        },
    });

    if (!seller) {
        return res.status(404).json({ error: "Seller not found" });
    }

    res.json(seller);
});

// Create a new seller
const createSeller = asyncHandler(async (req, res) => {
    const { idString, name, tibetanName, contactPerson, contactMethod } = req.body;

    if (!idString || !name) {
        return res.status(400).json({ error: "idString and name are required" });
    }

    const seller = await prisma.supplier.create({
        data: {
            idString,
            name,
            tibetanName,
            contactPerson,
            contactMethod,
        },
    });

    res.status(201).json(seller);
});

// Update a seller
const updateSeller = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { idString, name, tibetanName, contactPerson, contactMethod } = req.body;

    const seller = await prisma.supplier.update({
        where: { id: parseInt(id) },
        data: {
            idString,
            name,
            tibetanName,
            contactPerson,
            contactMethod,
        },
    });

    res.json(seller);
});

// Delete a seller
const deleteSeller = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if seller has products
    const productCount = await prisma.product.count({
        where: { supplierId: parseInt(id) },
    });

    if (productCount > 0) {
        return res.status(400).json({
            error: `Cannot delete seller with ${productCount} associated products`,
        });
    }

    await prisma.supplier.delete({
        where: { id: parseInt(id) },
    });

    res.json({ message: "Seller deleted successfully" });
});

// --- Routes ---
router.get("/sellers", getSellers);
router.get("/sellers/:id", getSellerById);
router.post("/sellers", authenticateToken, requireAdmin, createSeller);
router.put("/sellers/:id", authenticateToken, requireAdmin, updateSeller);
router.delete("/sellers/:id", authenticateToken, requireAdmin, deleteSeller);

export default router;
