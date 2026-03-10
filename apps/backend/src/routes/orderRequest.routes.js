import express from "express";
import prismaPkg from "@prisma/client";
import asyncHandler from "../middleware/asyncHandler.js";
import authenticateToken from "../middleware/authenticateToken.js";
import requireAdmin from "../middleware/requireAdmin.js";

const { PrismaClient } = prismaPkg;
const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/order-requests
 * Public. Creates an order request from a customer's cart.
 * Body: { customerName, customerEmail, customerPhone, customerInstagram, notes, items }
 * items: [{ id, sku, skuBase, name, color, size, salePrice, imgUrl, quantity }]
 */
router.post(
    "/order-requests",
    asyncHandler(async (req, res) => {
        const { customerName, customerEmail, customerPhone, customerInstagram, notes, items } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            res.status(400);
            throw new Error("Cart items are required.");
        }

        // At least one contact method must be provided
        if (!customerEmail && !customerPhone && !customerInstagram) {
            res.status(400);
            throw new Error("Please provide at least one contact method: email, phone, or Instagram.");
        }

        // Validate that every item has minimum required fields
        for (const item of items) {
            if (!item.sku || !item.name || !item.quantity || item.quantity < 1) {
                res.status(400);
                throw new Error("Each item must have sku, name, and a positive quantity.");
            }
        }

        // Sanitize free-text fields
        const safeItems = items.map((item) => ({
            id: item.id,
            sku: String(item.sku).slice(0, 200),
            skuBase: item.skuBase ? String(item.skuBase).slice(0, 200) : null,
            name: String(item.name).slice(0, 300),
            color: item.color ? String(item.color).slice(0, 100) : null,
            size: item.size ? String(item.size).slice(0, 100) : null,
            salePrice: item.salePrice != null ? String(item.salePrice).slice(0, 50) : null,
            imgUrl: item.imgUrl ? String(item.imgUrl).slice(0, 500) : null,
            quantity: Math.max(1, Math.floor(Number(item.quantity))),
        }));

        const request = await prisma.onlineOrderRequest.create({
            data: {
                customerName: customerName ? String(customerName).slice(0, 200) : null,
                customerEmail: customerEmail ? String(customerEmail).slice(0, 200) : null,
                customerPhone: customerPhone ? String(customerPhone).slice(0, 50) : null,
                customerInstagram: customerInstagram ? String(customerInstagram).slice(0, 100) : null,
                notes: notes ? String(notes).slice(0, 1000) : null,
                items: safeItems,
            },
        });

        res.status(201).json({ data: request });
    }),
);

/**
 * GET /api/order-requests
 * Admin only. Returns all order requests, newest first.
 */
router.get(
    "/order-requests",
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
        const { status } = req.query;
        const where = {};
        if (status && ["PENDING", "ACCEPTED", "REJECTED"].includes(status)) {
            where.status = status;
        }

        const requests = await prisma.onlineOrderRequest.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });

        res.json({ data: requests });
    }),
);

/**
 * PATCH /api/order-requests/:id
 * Admin only. Update status and/or adminNotes.
 * Body: { status?, adminNotes? }
 */
router.patch(
    "/order-requests/:id",
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            res.status(400);
            throw new Error("Invalid order request ID.");
        }

        const { status, adminNotes } = req.body;

        const data = {};
        if (status) {
            if (!["PENDING", "ACCEPTED", "REJECTED"].includes(status)) {
                res.status(400);
                throw new Error("Invalid status. Must be PENDING, ACCEPTED, or REJECTED.");
            }
            data.status = status;
        }
        if (adminNotes !== undefined) {
            data.adminNotes = adminNotes ? String(adminNotes).slice(0, 2000) : null;
        }

        if (Object.keys(data).length === 0) {
            res.status(400);
            throw new Error("No valid fields provided.");
        }

        const updated = await prisma.onlineOrderRequest.update({
            where: { id },
            data,
        });

        res.json({ data: updated });
    }),
);

/**
 * DELETE /api/order-requests/:id
 * Admin only. Hard-delete a request.
 */
router.delete(
    "/order-requests/:id",
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            res.status(400);
            throw new Error("Invalid order request ID.");
        }

        await prisma.onlineOrderRequest.delete({ where: { id } });
        res.json({ message: "Deleted." });
    }),
);

export default router;
