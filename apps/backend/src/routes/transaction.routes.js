/**
 * Updates customer order info (name, moneyHolder, fulfillmentStatus).
 */
const updateCustomerOrder = asyncHandler(async (req, res) => {
    const orderId = Number(req.params.id);
    const { customerName, moneyHolder, fulfillmentStatus } = req.body;
    const data = {};
    if (typeof customerName === "string") data.customerName = customerName;
    if (typeof moneyHolder === "string") data.moneyHolder = moneyHolder;
    if (typeof fulfillmentStatus === "string") data.fulfillmentStatus = fulfillmentStatus;
    if (Object.keys(data).length === 0) {
        res.status(400);
        throw new Error("No valid fields to update");
    }
    const updated = await prisma.customerOrder.update({
        where: { id: orderId },
        data,
    });
    res.json({ data: updated });
});
import express from "express";
import prismaPkg from "@prisma/client";
import asyncHandler from "../middleware/asyncHandler.js";
import authenticateToken from "../middleware/authenticateToken.js";
import { fulfillStock, receiveStock } from "../services/inventory.service.js";

const { PrismaClient } = prismaPkg;
const router = express.Router();
const prisma = new PrismaClient();

// =========================
// Route Controllers
// =========================
/**
 * Adds a new inventory batch, creating a new variant if needed.
 */
const addInventoryBatch = asyncHandler(async (req, res) => {
    const { sku, color, size, costCNY, costUSD, quantity, productName } = req.body;
    if (!sku || !quantity || (!costCNY && !costUSD)) {
        res.status(400);
        throw new Error("sku, quantity, and costCNY or costUSD are required");
    }
    // Find or create product
    let product = null;
    if (productName) {
        product = await prisma.product.findUnique({ where: { name: productName } });
        if (!product) {
            product = await prisma.product.create({ data: { name: productName, skuBase: sku } });
        }
    }
    // Find or create variant
    let variant = await prisma.productVariant.findFirst({
        where: {
            sku,
            color,
            size,
        },
    });
    if (!variant) {
        variant = await prisma.productVariant.create({
            data: {
                sku,
                color,
                size,
                salePrice: 0,
                stock: 0,
                product: product ? { connect: { id: product.id } } : undefined,
            },
        });
    }
    // Create inventory batch
    const batch = await prisma.inventoryBatch.create({
        data: {
            productVariantId: variant.id,
            quantity,
            costCNY: costCNY || null,
            costUSD: costUSD || null,
        },
        include: { productVariant: true },
    });
    // No direct stock update; stock is tracked via inventory batches only
    res.json(batch);
});
/**
 * Updates quantityOrdered for a specific PurchaseOrderItem and retroactively updates inventory batch and stock if received.
 */
const updatePurchaseOrderItemQuantity = asyncHandler(async (req, res) => {
    const itemId = Number(req.params.id);
    const { quantityOrdered } = req.body;
    if (typeof quantityOrdered !== "number" || isNaN(quantityOrdered) || quantityOrdered < 1) {
        res.status(400);
        throw new Error("quantityOrdered must be a positive number");
    }
    // Update the purchase order item
    const item = await prisma.purchaseOrderItem.update({
        where: { id: itemId },
        data: { quantityOrdered },
        include: { purchaseOrder: true, variant: true },
    });
    // If the purchase order has already arrived, update the inventory batch
    if (item.purchaseOrder.hasArrived) {
        // Find the inventory batch linked to this item
        const batch = await prisma.inventoryBatch.findFirst({
            where: { purchaseOrderItemId: itemId },
        });
        if (batch) {
            // Update the batch quantity
            await prisma.inventoryBatch.update({
                where: { id: batch.id },
                data: { quantity: quantityOrdered },
            });
            // No direct productVariant stock update; stock is tracked via inventory batches only
        }
    }
    res.json(item);
});
/**
 * Updates color for a specific PurchaseOrderItem.
 */
const updatePurchaseOrderItemColor = asyncHandler(async (req, res) => {
    const itemId = Number(req.params.id);
    const { color } = req.body;
    if (typeof color !== "string") {
        res.status(400);
        throw new Error("color must be a string");
    }
    const updatedItem = await prisma.purchaseOrderItem.update({
        where: { id: itemId },
        data: {
            variant: {
                update: { color },
            },
        },
        include: { variant: true },
    });
    res.json(updatedItem);
});

/**
 * Updates costPerItemUsd for a specific PurchaseOrderItem.
 */
const updatePurchaseOrderItemCost = asyncHandler(async (req, res) => {
    const itemId = Number(req.params.id);
    const { costPerItemUsd } = req.body;
    if (typeof costPerItemUsd !== "number" || isNaN(costPerItemUsd)) {
        res.status(400);
        throw new Error("costPerItemUsd must be a number");
    }
    const updatedItem = await prisma.purchaseOrderItem.update({
        where: { id: itemId },
        data: { costPerItemUsd },
    });
    res.json(updatedItem);
});

/**
 * Adds a new item to a purchase order.
 */
const addPurchaseOrderItem = asyncHandler(async (req, res) => {
    const orderId = Number(req.params.id);
    const { sku, name, color, size, quantityOrdered, costPerItemUsd } = req.body;
    if (!sku || !name || !quantityOrdered || !costPerItemUsd) {
        res.status(400);
        throw new Error("sku, name, quantityOrdered, and costPerItemUsd are required");
    }
    // Find existing ProductVariant by sku, color, size
    let variant = await prisma.productVariant.findFirst({
        where: {
            sku,
            color,
            size,
        },
    });
    // If not found, create new ProductVariant
    if (!variant) {
        variant = await prisma.productVariant.create({
            data: {
                sku,
                color,
                size,
                salePrice: 0,
                product: {
                    connectOrCreate: {
                        where: { displayName: name },
                        create: { displayName: name, skuBase: sku },
                    },
                },
            },
        });
    }
    // Add item to purchase order
    const newItem = await prisma.purchaseOrderItem.create({
        data: {
            purchaseOrderId: orderId,
            productVariantId: variant.id,
            quantityOrdered,
            costPerItemUsd,
        },
        include: { variant: { include: { product: true } } },
    });
    res.json(newItem);
});

/**
 * Updates hasArrived for a specific PurchaseOrderItem.
 */
const updatePurchaseOrderItemArrived = asyncHandler(async (req, res) => {
    const itemId = Number(req.params.id);
    const { hasArrived } = req.body;
    if (typeof hasArrived !== "boolean") {
        res.status(400);
        throw new Error("hasArrived must be a boolean");
    }
    const updatedItem = await prisma.purchaseOrderItem.update({
        where: { id: itemId },
        data: { hasArrived },
    });
    res.json({ data: updatedItem });
});

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
            items: {
                include: {
                    variant: {
                        include: {
                            product: true,
                        },
                    },
                },
            },
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
    });
    res.json({ data: changes });
});

/**
 * Creates a new customer order, updates stock, and logs changes.
 */
const createCustomerOrder = asyncHandler(async (req, res) => {
    const userFromToken = req.user;
    const { customer, items, moneyHolder, paymentMethod } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400);
        throw new Error("No items in order");
    }

    // // Find or create customer
    // let dbCustomer;
    // if (customer?.email) {
    //     dbCustomer = await prisma.customer.upsert({
    //         where: { email: customer.email },
    //         update: { name: customer.name, phone: customer.phone },
    //         create: { email: customer.email, name: customer.name, phone: customer.phone },
    //     });
    // } else {
    //     dbCustomer = await prisma.customer.create({
    //         data: { email: `guest-${Date.now()}@guest.local`, name: customer?.name || "Guest", phone: customer?.phone },
    //     });
    // }

    // Create order and items
    const order = await prisma.customerOrder.create({
        data: {
            customerName: customer?.name || "Guest",
            moneyHolder,
            paymentMethod,
            items: {
                create: items.map((item) => ({
                    variant: { connect: { id: item.productVariantId } },
                    quantity: item.quantity,
                    salePrice: item.salePrice,
                })),
            },
        },
        include: { items: true, customer: true },
    });

    // FIFO logic: fulfill stock for each item
    for (const item of order.items) {
        await fulfillStock(item.productVariantId, item.quantity, item.id);
        // Log stock change only; no direct productVariant stock update
        await prisma.stockChange.create({
            data: {
                productVariantId: item.productVariantId,
                change: -item.quantity,
                reason: "Sale",
                user: userFromToken?.username || customer?.name || "Guest",
                orderId: order.id,
                orderType: "CUSTOMER",
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
        await receiveStock(item.productVariantId, item.quantityOrdered, parseFloat(item.costPerItemCny), item.id);
        await prisma.stockChange.create({
            data: {
                productVariantId: item.productVariantId,
                change: item.quantityOrdered,
                changeTime: purchaseOrder.arrivalDate || new Date(),
                reason: "Purchase Order Received",
                user: req.user?.username || "System",
                orderId: purchaseOrder.id,
                orderType: "PURCHASE",
            },
        });
    }
    let updateData = { hasArrived: true };
    if (!purchaseOrder.arrivalDate) {
        updateData.arrivalDate = new Date();
    }
    const updatedPO = await prisma.purchaseOrder.update({
        where: { id: Number(id) },
        data: updateData,
    });
    res.status(200).json(updatedPO);
});

/**
 * Returns all inventory batches with product variant details.
 */
const getInventoryBatches = asyncHandler(async (req, res) => {
    const batches = await prisma.inventoryBatch.findMany({
        include: {
            productVariant: true,
            purchaseOrderItem: {
                include: {
                    order: true,
                },
            },
        },
        orderBy: { createdAt: "asc" },
    });
    res.json({ data: batches });
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
        if (item.cogs > 0 && item.quantityOrdered > 0) {
            // Calculate the original cost per item from the sale
            const costPerItem = parseFloat(item.cogs) / item.quantityOrdered;

            // Create a new inventory batch for the returned items
            await prisma.inventoryBatch.create({
                data: {
                    productVariantId: item.productVariantId,
                    quantity: item.quantityOrdered,
                    cost: costPerItem,
                },
            });

            // No direct productVariant stock update; stock is tracked via inventory batches only

            // Log the stock change
            await prisma.stockChange.create({
                data: {
                    productVariantId: item.productVariantId,
                    change: item.quantityOrdered,
                    reason: "Void Sale",
                    user: order.customer?.name || "Unknown",
                    orderId: order.id,
                    orderType: "CUSTOMER",
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
    const stockChange = await prisma.stockChange.create({
        data: {
            productVariantId: Number(productVariantId),
            change: Number(change),
            reason,
            user: userFromToken?.username || "Manual",
            orderType: "MANUAL",
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
router.patch("/customer-orders/:id", authenticateToken, updateCustomerOrder);
router.post("/void-sale/:orderId", authenticateToken, voidCustomerOrder);

// Purchase Orders
router.get("/purchase-orders", authenticateToken, getPurchaseOrders);
router.post("/receive-purchase-order/:id", authenticateToken, receivePurchaseOrder);
router.post("/purchase-order-items/:id/arrived", authenticateToken, updatePurchaseOrderItemArrived);
router.post("/purchase-order-items/:id/quantity", authenticateToken, updatePurchaseOrderItemQuantity);
router.post("/purchase-order-items/:id/color", authenticateToken, updatePurchaseOrderItemColor);
router.post("/purchase-order-items/:id/cost", authenticateToken, updatePurchaseOrderItemCost);
router.post("/purchase-order-items/:id/add-item", authenticateToken, addPurchaseOrderItem);
// Inventory Batches
router.get("/inventory-batches", authenticateToken, getInventoryBatches);
router.post("/inventory-batches/add", authenticateToken, addInventoryBatch);

// Stock Changes
router.get("/stock-changes", authenticateToken, getStockChanges);
router.post("/stock-changes", authenticateToken, createStockChange);

export default router;
