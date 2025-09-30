import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
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

// Trust proxies like Nginx for correct https detection
app.set("trust proxy", 1);

// Add request logger
app.use((req, res, next) => {
    req.log = logger;
    next();
});

// Add security headers
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "*.yangkarbhoeche.com", "*.cloudflare.com"],
            },
        },
        crossOriginEmbedderPolicy: false,
    })
);

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { error: "Too many requests, please try again later" },
    // Skip rate limiting in development
    skip: () => process.env.NODE_ENV !== "production",
});

// Apply rate limiting to all routes
app.use(apiLimiter);

// --- Middleware Setup ---
app.use(
    cors({
        origin: function (origin, callback) {
            const allowedOrigins = [
                FRONT_END_URL,
                "https://yangkarbhoeche.com",
                "https://www.yangkarbhoeche.com",
                // For development
                "http://localhost:5173",
                "http://localhost:5174",
                // Note: Requests with no origin are handled separately
            ];

            // In development, allow all origins for easier testing
            const isDevelopment = process.env.NODE_ENV !== "production";
            if (isDevelopment) {
                callback(null, true);
                return;
            }

            // In production, enforce the origin check
            if (allowedOrigins.includes(origin)) {
                // Origin is explicitly in our allowed list
                callback(null, true);
            } else if (!origin) {
                // No origin header (server-side requests, Postman, curl, etc.)
                // Log these requests for monitoring and block them
                req.log.warn(
                    {
                        event: "no_origin_request_blocked",
                        ip: req.ip,
                        path: req.path,
                        method: req.method,
                    },
                    "Blocked request with no origin header"
                );
                callback(new Error("Requests without origin headers are currently disabled"));
            } else {
                // Blocked origin
                req.log.warn(
                    {
                        event: "cors_blocked",
                        origin,
                        ip: req.ip,
                        path: req.path,
                    },
                    "Blocked by CORS"
                );
                callback(new Error("Not allowed by CORS"));
            }
        },
        credentials: true, // Allow cookies to be sent and received
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    })
);

// Parse JSON with size limits to prevent large payload attacks
app.use(express.json({ limit: "1mb" }));
// Parse cookies
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
