import express from "express";
import { PrismaClient } from "@prisma/client";
import asyncHandler from "../middleware/asyncHandler.js";
import authenticateToken from "../middleware/authenticateToken.js";
import { fulfillStock, receiveStock } from "../services/inventory.service.js";

const router = express.Router();
const prisma = new PrismaClient();

// =========================
// Route Controllers
// =========================

/**
 * Returns all customer orders with customer and item details.
 */
const getCustomerOrders = asyncHandler(async (req, res) => {
    const orders = await prisma.customerOrder.findMany({
        include: {
            customer: true,
            items: { include: { variant: true } },
        },
        orderBy: { orderDate: "desc" },
    });
    res.json({ data: orders });
});

/**
 * Returns all purchase orders with item and variant details.
 */
const getPurchaseOrders = asyncHandler(async (req, res) => {
    const orders = await prisma.purchaseOrder.findMany({
        include: {
            items: { include: { variant: true } },
        },
        orderBy: { createdAt: "asc" },
    });
    res.json({ data: orders });
});

/**
 * Returns recent stock changes with variant and product details.
 */
const getStockChanges = asyncHandler(async (req, res) => {
    const changes = await prisma.stockChange.findMany({
        include: {
            variant: { include: { product: true } },
        },
        orderBy: { date: "desc" },
        take: 100, // limit for performance
    });
    res.json({ data: changes });
});

/**
 * Creates a new customer order, updates stock, and logs changes.
 */
const createCustomerOrder = asyncHandler(async (req, res) => {
    const userFromToken = req.user;
    const { customer, items, total, moneyHolder, paymentMethod } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400);
        throw new Error("No items in order");
    }

    // Find or create customer
    let dbCustomer;
    if (customer?.email) {
        dbCustomer = await prisma.customer.upsert({
            where: { email: customer.email },
            update: { name: customer.name, phone: customer.phone },
            create: { email: customer.email, name: customer.name, phone: customer.phone },
        });
    } else {
        dbCustomer = await prisma.customer.create({
            data: { email: `guest-${Date.now()}@guest.local`, name: customer?.name || "Guest", phone: customer?.phone },
        });
    }

    // Create order and items
    const order = await prisma.customerOrder.create({
        data: {
            customerId: dbCustomer.id,
            total,
            moneyHolder,
            paymentMethod,
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

    // FIFO logic: fulfill stock for each item
    for (const item of order.items) {
        await fulfillStock(item.productVariantId, item.quantity, item.id);
    }

    // Decrement stock and log stock change
    for (const item of items) {
        await prisma.productVariant.update({
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

/**
 * Receives a purchase order and updates stock for each item.
 */
const receivePurchaseOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
        where: { id: Number(id) },
        include: { items: true },
    });
    if (!purchaseOrder) {
        return res.status(404).json({ message: "Purchase order not found" });
    }
    for (const item of purchaseOrder.items) {
        await receiveStock(item.productVariantId, item.quantity, parseFloat(item.cost), item.id);
    }
    const updatedPO = await prisma.purchaseOrder.update({
        where: { id: Number(id) },
        data: { status: "Received" },
    });
    res.status(200).json(updatedPO);
});

/**
 * Voids a customer order and restores stock.
 */
const voidCustomerOrder = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const order = await prisma.customerOrder.findUnique({
        where: { id: orderId },
        include: { items: true },
    });
    if (!order) {
        res.status(404);
        throw new Error("Order not found");
    }
    if (order.status === "CANCELLED") {
        res.status(400);
        throw new Error("Order already voided");
    }
    for (const item of order.items) {
        if (item.cogs > 0 && item.quantity > 0) {
            // Calculate the original cost per item from the sale
            const costPerItem = parseFloat(item.cogs) / item.quantity;

            // Create a new inventory batch for the returned items
            await prisma.inventoryBatch.create({
                data: {
                    productVariantId: item.productVariantId,
                    quantity: item.quantity,
                    cost: costPerItem,
                },
            });

            // Update the main stock count as well
            await prisma.productVariant.update({
                where: { id: item.productVariantId },
                data: { stock: { increment: item.quantity } },
            });

            // Log the stock change
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
    }
    // Mark order as cancelled
    await prisma.customerOrder.update({
        where: { id: orderId },
        data: { status: "CANCELLED" },
    });
    res.json({ message: "Order voided and stock restored." });
});

/**
 * Manually creates a stock change and updates stock.
 */
const createStockChange = asyncHandler(async (req, res) => {
    const { productVariantId, change, reason } = req.body;
    const userFromToken = req.user;
    if (!productVariantId || !change || !reason) {
        res.status(400);
        throw new Error("productVariantId, change, and reason are required");
    }
    await prisma.productVariant.update({
        where: { id: Number(productVariantId) },
        data: { stock: { increment: Number(change) } },
    });
    const stockChange = await prisma.stockChange.create({
        data: {
            productVariantId: Number(productVariantId),
            change: Number(change),
            reason,
            user: userFromToken?.username || "Manual",
        },
    });
    res.status(201).json({ data: stockChange });
});

// =========================
// Route Definitions
// =========================

// Customer Orders
router.get("/customer-orders", authenticateToken, getCustomerOrders);
router.post("/customer-orders", authenticateToken, createCustomerOrder);

router.post("/void-sale/:orderId", authenticateToken, voidCustomerOrder);

// Purchase Orders
router.get("/purchase-orders", authenticateToken, getPurchaseOrders);
router.post("/receive-purchase-order/:id", authenticateToken, receivePurchaseOrder);

// Stock Changes
router.get("/stock-changes", authenticateToken, getStockChanges);
router.post("/stock-changes", authenticateToken, createStockChange);

export default router;
