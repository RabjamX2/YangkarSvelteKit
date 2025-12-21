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
import sellerRoutes from "./routes/seller.routes.js"; // Import seller routes

// Import services
import { maybeCleanupExpiredSessions, scheduleSessionCleanup } from "./services/sessionCleanup.js";

// Import middleware
import errorHandler from "./middleware/errorHandler.js";

const FRONT_END_URL = process.env.FRONT_END_URL;
const PORT = process.env.PORT;

const app = express();

// Configure Express to trust proxies - needed when behind Nginx, Cloudflare, etc.
// This tells Express to trust the X-Forwarded-For header for IP identification
// Important for rate limiting to work correctly in production
app.set("trust proxy", true);

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

// Helper to normalize IP addresses (handle IPv6 subnet isolation)
const normalizeIP = (ip) => {
    if (!ip) return "unknown";

    // For IPv6, only use the first 4 segments to group users by subnet
    // This prevents treating each user in the same IPv6 network as a separate entity
    if (ip.includes(":")) {
        const segments = ip.split(":");
        // Take just the first few segments (subnet)
        return segments.slice(0, 4).join(":");
    }

    // For IPv4, return as is
    return ip;
};

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 300, // Increased from 100 to 300 to be more accommodating
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { error: "Too many requests, please try again later" },
    // Skip rate limiting in development
    skip: () => process.env.NODE_ENV !== "production",
    // Properly handle proxied requests in production
    keyGenerator: (req) => {
        // Use the leftmost IP in X-Forwarded-For as it's the client IP
        // This works correctly when the app is behind a reverse proxy like Nginx or Cloudflare
        // But only if 'trust proxy' is enabled
        const rawIP =
            req.ip ||
            (req.headers["x-forwarded-for"]
                ? req.headers["x-forwarded-for"].split(",")[0].trim()
                : req.socket.remoteAddress);

        // Normalize the IP address (particularly important for IPv6)
        const normalizedIP = normalizeIP(rawIP);

        // Only log occasional checks to reduce log noise
        if (Math.random() < 0.05) {
            // Log only 5% of rate limit checks
            console.log(`Rate limit check for IP: ${normalizedIP} (original: ${rawIP}) (path: ${req.path})`);
        }

        return normalizedIP;
    },
});

// Create a more lenient rate limiter for public endpoints
const publicApiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes window instead of 15
    max: 500, // Much higher limit for public endpoints
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
    skip: () => process.env.NODE_ENV !== "production",
    keyGenerator: (req) => {
        const rawIP =
            req.ip ||
            (req.headers["x-forwarded-for"]
                ? req.headers["x-forwarded-for"].split(",")[0].trim()
                : req.socket.remoteAddress);

        return normalizeIP(rawIP); // No logging for public endpoints to reduce noise
    },
});

// Create a specialized limiter for auth-related endpoints that need to be called frequently
const authEndpointsLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute window (much shorter)
    max: 30, // Higher limit per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many auth requests, please try again later" },
    skip: () => process.env.NODE_ENV !== "production",
    keyGenerator: (req) =>
        normalizeIP(
            req.ip ||
                (req.headers["x-forwarded-for"]
                    ? req.headers["x-forwarded-for"].split(",")[0].trim()
                    : req.socket.remoteAddress)
        ),
});

// Apply different rate limiters based on route patterns
// 1. Auth endpoints that get called frequently (/api/me and /api/refresh)
app.use(["/api/me", "/api/refresh"], authEndpointsLimiter);

// 2. Public endpoints get the more lenient limiter
app.use(["/api/products", "/api/categories"], publicApiLimiter);

// 3. Apply the standard rate limiter to all other routes
app.use(apiLimiter);

// --- Middleware Setup ---
app.use(
    cors({
        origin: function (origin, callback) {
            const allowedOrigins = [
                FRONT_END_URL,
                "https://yangkarbhoeche.com",
                "https://www.yangkarbhoeche.com",
                // Include all possible variations of your domain
                "https://yangkarbhoeche.com",
                "https://www.yangkarbhoeche.com",
                "http://yangkarbhoeche.com",
                "http://www.yangkarbhoeche.com",
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

            // Log all origin checks in production for debugging
            if (process.env.NODE_ENV === "production") {
                logger.info({
                    event: "cors_origin_check",
                    origin: origin || "no-origin",
                    frontEndUrl: FRONT_END_URL,
                    allowed: allowedOrigins.includes(origin) || !origin,
                });
            }

            // In production, enforce the origin check
            if (allowedOrigins.includes(origin)) {
                // Origin is explicitly in our allowed list
                callback(null, true);
            } else if (!origin) {
                // No origin header (server-side requests, Postman, curl, etc.)
                // In production we need to allow these for cookie auth to work properly
                // Some browsers may send credentials without origin in some cases
                callback(null, true);

                // Log these but don't block them anymore
                logger.info({
                    event: "no_origin_request_allowed",
                    message: "Allowed request with no origin header",
                });
            } else {
                // Blocked origin
                logger.warn({
                    event: "cors_blocked",
                    origin,
                    message: "Blocked by CORS",
                });
                callback(new Error("Not allowed by CORS"));
            }
        },
        credentials: true, // Allow cookies to be sent and received
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "X-CSRF-Token",
            "Cookie",
            "Origin",
            "Accept",
            "Cache-Control",
            "Pragma",
        ],
    })
);

// Parse JSON with size limits to prevent large payload attacks
app.use(express.json({ limit: "1mb" }));
// Parse cookies
app.use(cookieParser());

// Schedule regular cleanup of expired sessions (runs on server start and every hour)
scheduleSessionCleanup();

// Add low-probability cleanup middleware to auth routes
// This gives a small chance of cleaning up expired sessions on any auth request
app.use(
    "/api",
    async (req, res, next) => {
        // Only run on auth-related endpoints with 1% probability
        if (req.path.includes("/auth") || req.path.includes("/login") || req.path.includes("/refresh")) {
            maybeCleanupExpiredSessions(0.01).catch((err) => {
                console.error("Background cleanup error:", err);
            });
        }
        next(); // Always continue processing the request
    },
    authRoutes
);

// --- API Routes ---
// All product-related routes
app.use("/api", productRoutes);
// All cart-related routes
app.use("/api", cartRoutes); // Use cart routes
app.use("/api", transactionRoutes); // Use transaction routes
// All image-related routes
app.use("/api", imageRoutes);
// All seller-related routes
app.use("/api", sellerRoutes);

// --- Centralized Error Handler ---
// This should be the LAST middleware you use
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Backend server listening on port ${PORT}`);
    logger.info(`Backend server listening on port ${PORT}`);
});
