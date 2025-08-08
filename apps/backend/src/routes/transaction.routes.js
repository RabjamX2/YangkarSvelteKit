// GET /api/stock-changes
const getStockChanges = asyncHandler(async (req, res) => {
    const changes = await prisma.stockChange.findMany({
        include: {
            variant: {
                include: { product: true },
            },
        },
        orderBy: { date: "desc" },
        take: 100, // limit for performance
    });
    res.json({ data: changes });
});

import express from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import asyncHandler from "../middleware/asyncHandler.js";
import authenticateToken from "../middleware/authenticateToken.js";

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/customer-orders

// --- Route Controllers ---
const getCustomerOrders = asyncHandler(async (req, res) => {
    const orders = await prisma.customerOrder.findMany({
        include: {
            customer: true,
            items: {
                include: {
                    variant: true,
                },
            },
        },
        orderBy: { orderDate: "desc" },
    });
    res.json({ data: orders });
});

// GET /api/purchase-orders

const getPurchaseOrders = asyncHandler(async (req, res) => {
    const orders = await prisma.purchaseOrder.findMany({
        include: {
            supplier: true,
            items: {
                include: {
                    variant: true,
                },
            },
        },
        orderBy: { orderDate: "desc" },
    });
    res.json({ data: orders });
});

// POST /api/customer-orders

const createCustomerOrder = asyncHandler(async (req, res) => {
    // User identity from JWT
    const userFromToken = req.user;
    const { customer, items, total, moneyHolder, paymentMethod } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400);
        throw new Error("No items in order");
    }
    // Find or create customer
    let dbCustomer = null;
    if (customer?.email) {
        dbCustomer = await prisma.customer.upsert({
            where: { email: customer.email },
            update: { name: customer.name, phone: customer.phone },
            create: { email: customer.email, name: customer.name, phone: customer.phone },
        });
    } else {
        // Guest/anonymous customer
        dbCustomer = await prisma.customer.create({
            data: { email: `guest-${Date.now()}@guest.local`, name: customer?.name || "Guest", phone: customer?.phone },
        });
    }
    // Create order and items
    const order = await prisma.customerOrder.create({
        data: {
            customerId: dbCustomer.id,
            total: total,
            moneyHolder: moneyHolder,
            paymentMethod: paymentMethod,
            items: {
                create: items.map((item) => ({
                    productVariantId: item.productVariantId,
                    quantity: item.quantity,
                    priceAtTimeOfSale: item.priceAtTimeOfSale,
                })),
            },
        },
        include: { items: true, customer: true },
    });
    // Decrement stock for each variant and log stock change
    for (const item of items) {
        const updated = await prisma.productVariant.update({
            where: { id: item.productVariantId },
            data: { stock: { decrement: item.quantity } },
        });
        await prisma.stockChange.create({
            data: {
                productVariantId: item.productVariantId,
                change: -item.quantity,
                reason: "Sale",
                user: userFromToken?.username || dbCustomer.name || "Guest",
                orderId: order.id,
                orderType: "customer",
            },
        });
    }
    req.log.info({ event: "order_created", orderId: order.id, userId: userFromToken?.id }, "Customer order created");
    res.status(201).json({ data: order });
});

// --- Route Definitions ---

router.get("/customer-orders", getCustomerOrders);
router.get("/purchase-orders", getPurchaseOrders);
router.get("/stock-changes", getStockChanges);

// POST /api/stock-changes (manual entry)
router.post(
    "/stock-changes",
    authenticateToken,
    asyncHandler(async (req, res) => {
        const { productVariantId, change, reason } = req.body;
        const userFromToken = req.user;
        if (!productVariantId || !change || !reason) {
            res.status(400);
            throw new Error("productVariantId, change, and reason are required");
        }
        // Update stock
        const updated = await prisma.productVariant.update({
            where: { id: Number(productVariantId) },
            data: { stock: { increment: Number(change) } },
        });
        // Log stock change
        const stockChange = await prisma.stockChange.create({
            data: {
                productVariantId: Number(productVariantId),
                change: Number(change),
                reason,
                user: userFromToken?.username || "Manual",
            },
        });
        res.status(201).json({ data: stockChange });
    })
);
router.post("/customer-orders", authenticateToken, createCustomerOrder);

export default router;

// POST /api/customer-orders/:id/void
router.post(
    "/customer-orders/:id/void",
    asyncHandler(async (req, res) => {
        const orderId = parseInt(req.params.id);
        if (isNaN(orderId)) {
            res.status(400);
            throw new Error("Invalid order ID");
        }
        // Find the order and its items
        const order = await prisma.customerOrder.findUnique({
            where: { id: orderId },
            include: { items: true, customer: true },
        });
        if (!order) {
            res.status(404);
            throw new Error("Order not found");
        }
        if (order.status === "CANCELLED") {
            res.status(400);
            throw new Error("Order already voided");
        }
        // Restore stock for each item
        for (const item of order.items) {
            await prisma.productVariant.update({
                where: { id: item.productVariantId },
                data: { stock: { increment: item.quantity } },
            });
            await prisma.stockChange.create({
                data: {
                    productVariantId: item.productVariantId,
                    change: item.quantity,
                    reason: "Void Sale",
                    user: order.customer?.name || "Unknown",
                    orderId: order.id,
                    orderType: "customer",
                },
            });
        }
        // Mark order as cancelled
        await prisma.customerOrder.update({
            where: { id: orderId },
            data: { status: "CANCELLED" },
        });
        res.json({ message: "Order voided and stock restored." });
    })
);
