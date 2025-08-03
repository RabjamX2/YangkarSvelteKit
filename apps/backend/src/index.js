import express from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import argon2 from "argon2";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();
const prisma = new PrismaClient();

// --- Middleware Setup ---
app.use(
    cors({
        origin: "http://localhost:5173", // The default SvelteKit dev server URL
        credentials: true, // Allow cookies to be sent and received
    })
);
app.use(express.json());
app.use(cookieParser()); // Middleware to parse cookies from requests

// // --- SIGNUP ROUTE ---
// app.post("/api/signup", async (req, res) => {
//     const { username, password } = req.body;

//     if (!username || typeof username !== "string" || username.length < 3) {
//         return res.status(400).json({ error: "Invalid username" });
//     }
//     if (!password || typeof password !== "string" || password.length < 6) {
//         return res.status(400).json({ error: "Invalid password" });
//     }

//     try {
//         const hashedPassword = await argon2.hash(password);
//         const user = await prisma.user.create({
//             data: { username, password: hashedPassword },
//         });

//         const sessionToken = uuidv4();
//         const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

//         await prisma.session.create({
//             data: { id: sessionToken, userId: user.id, expiresAt },
//         });

//         res.cookie("session_token", sessionToken, {
//             httpOnly: true,
//             secure: process.env.NODE_ENV === "production",
//             sameSite: "lax",
//             expires: expiresAt,
//         });

//         return res.status(201).json({ id: user.id, username: user.username });
//     } catch (e) {
//         console.error(e);
//         return res.status(500).json({ error: "Username likely already taken" });
//     }
// });

// --- LOGIN ROUTE ---
app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user || !(await argon2.verify(user.password, password))) {
            return res.status(400).json({ error: "Invalid username or password" });
        }

        const sessionToken = uuidv4();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await prisma.session.create({
            data: { id: sessionToken, userId: user.id, expiresAt },
        });

        res.cookie("session_token", sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            expires: expiresAt,
        });
        return res.status(200).json({ id: user.id, username: user.username });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "An error occurred" });
    }
});

// --- LOGOUT ROUTE ---
app.post("/api/logout", async (req, res) => {
    const sessionToken = req.cookies.session_token;
    if (sessionToken) {
        try {
            await prisma.session.delete({ where: { id: sessionToken } });
        } catch (error) {
            // Ignore errors
        }
    }
    res.clearCookie("session_token");
    return res.status(200).json({ message: "Logged out" });
});

// --- ME (GET CURRENT USER) ROUTE ---
app.get("/api/me", async (req, res) => {
    const sessionToken = req.cookies.session_token;
    if (!sessionToken) {
        return res.status(401).json({ user: null });
    }

    const session = await prisma.session.findUnique({
        where: { id: sessionToken, expiresAt: { gt: new Date() } },
        include: { user: { select: { id: true, username: true, role: true, name: true } } },
    });

    if (session && session.user) {
        return res.status(200).json({ user: session.user });
    } else {
        return res.status(401).json({ user: null });
    }
});

app.get("/api/products", async (req, res) => {
    // --- Pagination ---
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 24;
    const offset = (page - 1) * limit;

    // --- Sorting ---
    const sort = req.query.sort || "default";

    // Determine the sorting order for the SQL query
    let orderBy;
    switch (sort) {
        case "price_asc":
            orderBy = Prisma.sql`"minSalePrice" ASC`;
            break;
        case "price_desc":
            orderBy = Prisma.sql`"minSalePrice" DESC`;
            break;
        case "alpha":
            orderBy = Prisma.sql`p.name ASC`;
            break;
        default:
            // 'default' sort is by newest product
            orderBy = Prisma.sql`p."createdAt" DESC`;
            break;
    }

    try {
        // This raw SQL query is powerful. It gets each product and calculates
        // its minimum sale price from its variants in a new `minSalePrice` column.
        // It also gets the image from that cheapest variant.
        const products = await prisma.$queryRaw`
      SELECT
        p.id,
        p."skuBase",
        p.name,
        p."createdAt",
        (
          SELECT MIN(pv."salePrice")
          FROM "ProductVariant" pv
          WHERE pv."productSkuBase" = p."skuBase" AND pv."salePrice" IS NOT NULL
        ) as "minSalePrice",
        (
          SELECT pv."imgUrl"
          FROM "ProductVariant" pv
          WHERE pv."productSkuBase" = p."skuBase" AND pv."salePrice" IS NOT NULL
          ORDER BY pv."salePrice" ASC
          LIMIT 1
        ) as "displayImageUrl"
      FROM
        "Product" p
      ORDER BY
        ${orderBy}
      LIMIT ${limit}
      OFFSET ${offset}
    `;

        // We also need the total count of all products for pagination metadata
        const totalProductsResult = await prisma.product.count();

        // --- Response ---
        res.json({
            data: products,
            meta: {
                totalProducts: totalProductsResult,
                currentPage: page,
                totalPages: Math.ceil(totalProductsResult / limit),
            },
        });
    } catch (error) {
        console.error("Failed to fetch products with variant prices:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// --- CREATE A NEW PRODUCT (ADMIN ONLY) ---
app.post("/api/products", async (req, res) => {
    // 1. Check for a valid session
    const sessionToken = req.cookies.session_token;
    if (!sessionToken) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    const session = await prisma.session.findUnique({
        where: { id: sessionToken, expiresAt: { gt: new Date() } },
        include: { user: true }, // Include the full user object
    });

    // 2. Check if the user is an ADMIN
    if (!session || !session.user || session.user.role !== "ADMIN") {
        return res.status(403).json({ error: "Not authorized" });
    }

    // 3. If authorized, create the product
    try {
        const { name, description, price, imageUrl } = req.body;
        // Basic validation
        if (!name || !description || !price || !imageUrl) {
            return res.status(400).json({ error: "All product fields are required." });
        }

        const product = await prisma.product.create({
            data: {
                name,
                description,
                price: parseInt(price, 10), // Ensure price is an integer
                imageUrl,
            },
        });
        res.status(201).json(product);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "An error occurred while creating the product." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend server listening on port ${PORT}`);
});
