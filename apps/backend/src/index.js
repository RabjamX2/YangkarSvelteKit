import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import logger from "./logger.js";

// Import route handlers
import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import transactionRoutes from "./routes/transaction.routes.js"; // Import transaction routes
import imageRoutes from "./routes/image.routes.js"; // Import image routes

// Import middleware
import errorHandler from "./middleware/errorHandler.js";

const FRONT_END_URL = process.env.FRONT_END_URL;
const PORT = process.env.PORT;

const app = express();
app.use((req, res, next) => {
    req.log = logger;
    next();
});

// --- Middleware Setup ---
app.use(
    cors({
        origin: `${FRONT_END_URL}`, // The default SvelteKit dev server URL
        credentials: true, // Allow cookies to be sent and received
    })
);

app.use(express.json());
app.use(cookieParser());

// --- API Routes ---
// All authentication routes
app.use("/api", authRoutes);
// All product-related routes
app.use("/api", productRoutes);
// All cart-related routes
app.use("/api", cartRoutes); // Use cart routes
app.use("/api", transactionRoutes); // Use transaction routes
// All image-related routes
app.use("/api", imageRoutes);

// --- Centralized Error Handler ---
// This should be the LAST middleware you use
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Backend server listening on port ${PORT}`);
    logger.info(`Backend server listening on port ${PORT}`);
});
