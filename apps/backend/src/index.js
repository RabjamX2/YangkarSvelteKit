import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// Import route handlers
import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import cartRoutes from "./routes/cart.routes.js";

// Import middleware
import errorHandler from "./middleware/errorHandler.js";

const app = express();

// --- Middleware Setup ---
app.use(
    cors({
        origin: "http://localhost:5173", // The default SvelteKit dev server URL
        credentials: true, // Allow cookies to be sent and received
    })
);
app.use(express.json());
app.use(cookieParser());

// --- API Routes ---
// All authentication routes will be prefixed with /api
app.use("/api", authRoutes);
// All product-related routes will be prefixed with /api
app.use("/api", productRoutes);
// All cart-related routes will be prefixed with /api
app.use("/api", cartRoutes); // Use cart routes

// --- Centralized Error Handler ---
// This should be the LAST middleware you use
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend server listening on port ${PORT}`);
});
