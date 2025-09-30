import express from "express";
import prismaPkg from "@prisma/client";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import asyncHandler from "../middleware/asyncHandler.js";
import authenticateToken from "../middleware/authenticateToken.js";
import optionalAuthenticate from "../middleware/optionalAuthenticate.js";
import rateLimit from "express-rate-limit";

const { PrismaClient } = prismaPkg;
const router = express.Router();
const prisma = new PrismaClient();

// Environment variables (should be set in your .env file)
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "change-me-access-secret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "change-me-refresh-secret";
const JWT_RESET_SECRET = process.env.JWT_RESET_SECRET || "change-me-reset-secret";

// Token durations
const ACCESS_TOKEN_EXPIRY = "15m"; // 15 minutes
const REFRESH_TOKEN_EXPIRY = "7d"; // 7 days
const RESET_TOKEN_EXPIRY = "10m"; // 10 minutes

// Rate limiting for authentication attempts
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per windowMs per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts, please try again later" },
});

// Cookie settings based on environment
const getCookieOptions = (maxAge) => {
    // Force production mode if we detect we're on the production domain
    const isProduction =
        process.env.NODE_ENV === "production" ||
        process.env.FORCE_PRODUCTION === "true" ||
        process.env.FRONT_END_URL?.includes("yangkarbhoeche.com");

    // Log environment detection
    console.log(`Cookie environment detection:`, {
        NODE_ENV: process.env.NODE_ENV,
        FORCE_PRODUCTION: process.env.FORCE_PRODUCTION,
        FRONT_END_URL: process.env.FRONT_END_URL,
        isProductionMode: isProduction,
    });

    // Base cookie options
    const options = {
        httpOnly: true, // Cannot be accessed by client-side JS
        secure: true, // Always use HTTPS for auth cookies
        maxAge: maxAge, // Time in milliseconds
        path: "/", // Make sure cookies are available on all paths
    };

    // Add production-specific settings
    if (isProduction) {
        // *IMPORTANT* For cross-domain cookies, DON'T set a domain at all
        // Let the browser handle the domain based on the request
        // This is more likely to work with cross-domain requests
        // options.domain = "api.yangkarbhoeche.com";  // Commented out as this might be causing issues

        // Use 'none' for cross-domain cookies, required for cross-domain auth
        options.sameSite = "none";

        console.log(`Using production cookie settings:`, options);
    } else {
        options.sameSite = "lax";
        console.log(`Using development cookie settings:`, options);
    }
    return options;
};

// Verify password - handles both raw and pre-hashed passwords
const verifyPassword = async (storedHash, providedPassword, hashMethod) => {
    // If the password was pre-hashed on the client side with SHA-256
    if (hashMethod === "sha256-client") {
        try {
            // We need a special verification approach:
            // 1. First try normal verification (in case passwords were stored pre-hashed)
            const normalVerify = await argon2.verify(storedHash, providedPassword);
            if (normalVerify) return true;

            // 2. If that fails, we need to try getting the raw input that was used
            //    to create the Argon2 hash, then SHA-256 hash it ourselves to compare
            //    This is a best-effort approach as we can't extract the original password

            // For now, we'll use standard verification but log the attempt
            console.log("Client-side hashed password received - verification might not work correctly");
            return await argon2.verify(storedHash, providedPassword);
        } catch (err) {
            console.error("Error verifying client-side hashed password:", err);
            return false;
        }
    }

    // Default: Use Argon2 to verify the password (standard way)
    return await argon2.verify(storedHash, providedPassword);
};

// Generate tokens for user
const generateTokens = (user) => {
    // Generate payload (don't include sensitive data)
    const tokenPayload = {
        id: user.id,
        username: user.username,
        role: user.role,
    };

    // Create CSRF token for front-end validation
    const csrfToken = crypto.randomBytes(16).toString("hex");

    // Create access token with CSRF
    const accessToken = jwt.sign({ ...tokenPayload, csrf: csrfToken }, JWT_ACCESS_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    // Create refresh token (no CSRF in refresh token)
    const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

    return { accessToken, refreshToken, csrfToken };
};

// --- Route Controllers ---

const signup = asyncHandler(async (req, res) => {
    const { username, email, password, passwordHashMethod } = req.body;

    // Enhanced validation
    if (!username || typeof username !== "string" || username.length < 3) {
        res.status(400);
        throw new Error("Username must be at least 3 characters long");
    }
    if (!email || typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email)) {
        res.status(400);
        throw new Error("Please provide a valid email address");
    }

    // Strong password requirements - skip complex validation if it's already client-side hashed
    if (passwordHashMethod === "sha256-client") {
        // For client-side hashed passwords, just check that we got something valid
        if (!password || typeof password !== "string" || password.length !== 64) {
            res.status(400);
            throw new Error("Invalid hashed password format");
        }
        console.log("Client-side hashed password validated, length:", password.length);
    } else {
        // For plain passwords, do full validation
        if (!password || typeof password !== "string" || password.length < 8) {
            res.status(400);
            throw new Error("Password must be at least 8 characters long");
        }

        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
            res.status(400);
            throw new Error(
                "Password must contain at least one lowercase letter, one uppercase letter, and one number"
            );
        }
    }

    // Check for existing user
    const existingUser = await prisma.user.findFirst({
        where: {
            OR: [{ username }, { email }],
        },
    });

    if (existingUser) {
        res.status(400);
        throw new Error("Username or email already exists");
    }

    // Hash password with Argon2, handling client-side pre-hashed passwords
    let finalPassword = password;

    // If we received a client-side SHA-256 hashed password, log it for debugging
    if (passwordHashMethod === "sha256-client") {
        console.log("Received client-side SHA-256 hashed password during signup");
        // We still hash with Argon2 on the server for extra security
    }

    const hashedPassword = await argon2.hash(finalPassword, {
        type: argon2.argon2id, // Most secure variant of Argon2
        memoryCost: 2 ** 16, // 64MB memory usage
        timeCost: 3, // 3 iterations
        parallelism: 1, // 1 thread
    });

    // Create user in database
    const user = await prisma.user.create({
        data: { username, email, password: hashedPassword },
    });

    req.log.info({ event: "user_signup", userId: user.id, username: user.username }, "User signed up V4");

    // Generate tokens
    const { accessToken, refreshToken, csrfToken } = generateTokens(user);

    // Store refresh token in database
    const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

    await prisma.session.create({
        data: {
            id: refreshTokenHash,
            userId: user.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
    });

    // Set cookies
    const accessMaxAge = 15 * 60 * 1000; // 15 minutes in ms
    const refreshMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

    res.cookie("access_token", accessToken, getCookieOptions(accessMaxAge));
    res.cookie("refresh_token", refreshToken, getCookieOptions(refreshMaxAge));

    // Return user data, tokens, and CSRF token
    res.status(201).json({
        id: user.id,
        username: user.username,
        role: user.role,
        accessToken,
        refreshToken,
        csrfToken,
    });
});

const login = asyncHandler(async (req, res) => {
    const { username, password, passwordHashMethod } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });

    // Verify user and password using the appropriate method
    if (!user || !(await verifyPassword(user.password, password, passwordHashMethod))) {
        res.status(401);
        throw new Error("Invalid username or password");
    }

    // Generate tokens
    const { accessToken, refreshToken, csrfToken } = generateTokens(user);

    // Store hashed refresh token
    const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

    await prisma.session.create({
        data: {
            id: refreshTokenHash,
            userId: user.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
    });

    // Set cookies
    const accessMaxAge = 15 * 60 * 1000; // 15 minutes in ms
    const refreshMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

    const accessOptions = getCookieOptions(accessMaxAge);
    const refreshOptions = getCookieOptions(refreshMaxAge);

    // Enhanced debugging for authentication cookies
    console.log(`LOGIN - Setting authentication cookies:`, {
        accessTokenFirstChars: accessToken.substring(0, 10) + "...",
        refreshTokenFirstChars: refreshToken.substring(0, 10) + "...",
        accessOptions,
        refreshOptions,
        requestOrigin: req.headers.origin || "unknown",
        requestReferer: req.headers.referer || "unknown",
        userAgent: req.headers["user-agent"],
        requestHost: req.headers.host,
        xForwardedFor: req.headers["x-forwarded-for"] || "none",
    });

    // Log cookie settings for debugging
    req.log.info(
        {
            event: "setting_auth_cookies",
            accessOptions,
            refreshOptions,
            env: process.env.NODE_ENV,
            frontEndUrl: process.env.FRONT_END_URL,
        },
        "Setting auth cookies"
    );

    res.cookie("access_token", accessToken, accessOptions);
    res.cookie("refresh_token", refreshToken, refreshOptions);

    // Add response header debugging to verify cookie was set
    console.log(`LOGIN - Cookie headers set in response:`, {
        "set-cookie": res.getHeader("set-cookie")?.map((c) => c.split(";")[0] + ";[rest-hidden]"),
    });

    req.log.info({ event: "user_login", userId: user.id, username: user.username }, "User logged in. BACKEND V4");

    // Return user data, tokens, and CSRF token
    res.status(200).json({
        id: user.id,
        username: user.username,
        role: user.role,
        accessToken,
        refreshToken,
        csrfToken,
    });
});

const refreshToken = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refresh_token;

    if (!refreshToken) {
        res.status(401);
        throw new Error("No refresh token provided");
    }

    try {
        // Verify refresh token
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

        // Get refresh token hash
        const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

        // Check if token exists in database and hasn't expired
        const session = await prisma.session.findUnique({
            where: { id: refreshTokenHash },
            include: { user: true },
        });

        if (!session || !session.user || session.expiresAt < new Date()) {
            res.status(401);
            throw new Error("Invalid or expired refresh token");
        }

        // Generate new tokens
        const { accessToken, refreshToken: newRefreshToken, csrfToken } = generateTokens(session.user);

        // Update session in database with new refresh token
        const newRefreshTokenHash = crypto.createHash("sha256").update(newRefreshToken).digest("hex");

        // Delete old session
        await prisma.session.delete({
            where: { id: refreshTokenHash },
        });

        // Create new session
        await prisma.session.create({
            data: {
                id: newRefreshTokenHash,
                userId: session.user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
        });

        // Set new cookies
        const accessMaxAge = 15 * 60 * 1000; // 15 minutes in ms
        const refreshMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

        const accessOptions = getCookieOptions(accessMaxAge);
        const refreshOptions = getCookieOptions(refreshMaxAge);

        // Enhanced debugging for refreshed tokens
        console.log(`REFRESH - Setting new authentication cookies:`, {
            accessTokenFirstChars: accessToken.substring(0, 10) + "...",
            newRefreshTokenFirstChars: newRefreshToken.substring(0, 10) + "...",
            accessOptions,
            refreshOptions,
            requestOrigin: req.headers.origin || "unknown",
            requestReferer: req.headers.referer || "unknown",
            userAgent: req.headers["user-agent"],
        });

        res.cookie("access_token", accessToken, accessOptions);
        res.cookie("refresh_token", newRefreshToken, refreshOptions);

        // Add response header debugging to verify cookie was set
        console.log(`REFRESH - Cookie headers set in response:`, {
            "set-cookie": res.getHeader("set-cookie")?.map((c) => c.split(";")[0] + ";[rest-hidden]"),
        });

        // Return user data, tokens, and CSRF token
        res.status(200).json({
            user: {
                id: session.user.id,
                username: session.user.username,
                role: session.user.role,
                email: session.user.email,
                name: session.user.name,
            },
            accessToken,
            refreshToken: newRefreshToken,
            csrfToken,
        });
    } catch (error) {
        res.clearCookie("access_token");
        res.clearCookie("refresh_token");
        res.status(401);
        throw new Error("Invalid refresh token");
    }
});

const logout = asyncHandler(async (req, res) => {
    // Try to get refresh token from both cookie and request body
    let refreshToken = req.cookies.refresh_token;
    let logoutSource = "cookie";

    // If no cookie, check request body (used when token is stored in localStorage)
    if (!refreshToken && req.body.refreshToken) {
        refreshToken = req.body.refreshToken;
        logoutSource = "body";
    }

    // Get user ID if authenticated
    const userId = req.user?.id;

    // Log logout attempt
    console.log("Logout attempt", {
        hasRefreshToken: !!refreshToken,
        tokenSource: logoutSource,
        authenticatedUser: userId || "none",
    });

    if (refreshToken) {
        try {
            // Hash the refresh token to find it in the database
            const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

            // Delete the session
            await prisma.session
                .delete({ where: { id: refreshTokenHash } })
                .then(() => {
                    console.log("Session deleted successfully");
                })
                .catch((error) => {
                    console.warn("Failed to delete session during logout", {
                        error: error.message,
                        code: error.code,
                    });
                });
        } catch (error) {
            // Log errors during logout but continue
            console.error("Error processing refresh token during logout:", error.message);
        }
    } else if (userId) {
        // If no token but we have a userId from authentication, try to delete all user's sessions
        try {
            // Delete all sessions for this user as a security measure
            await prisma.session
                .deleteMany({ where: { userId } })
                .then((result) => {
                    console.log(`Deleted ${result.count} sessions for user ${userId}`);
                })
                .catch((error) => {
                    console.warn("Failed to delete user sessions during logout", {
                        error: error.message,
                        userId,
                    });
                });
        } catch (error) {
            console.error("Error deleting user sessions during logout:", error.message);
        }
    }

    // Clear cookies with appropriate settings based on environment
    const cookieOptions = getCookieOptions(0);
    res.clearCookie("access_token", cookieOptions);
    res.clearCookie("refresh_token", cookieOptions);

    // Return success regardless of token invalidation success
    res.status(200).json({ message: "Logged out successfully" });
});

const getCurrentUser = asyncHandler(async (req, res) => {
    const accessToken = req.cookies.access_token;

    if (!accessToken) {
        return res.status(200).json({ user: null }); // Not an error, just no user
    }

    try {
        // Verify the token
        const decoded = jwt.verify(accessToken, JWT_ACCESS_SECRET);

        // Get user from database
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, username: true, role: true, name: true, email: true },
        });

        if (!user) {
            return res.status(200).json({ user: null });
        }

        // Return the CSRF token for the front end to use
        return res.status(200).json({
            user,
            csrfToken: decoded.csrf,
        });
    } catch (error) {
        // Token expired or invalid - try to refresh
        return res.status(200).json({ user: null });
    }
});

const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) {
        res.status(400);
        throw new Error("Email is required");
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
        // Generate reset token using JWT
        const resetToken = jwt.sign({ id: user.id, email: user.email }, JWT_RESET_SECRET, {
            expiresIn: RESET_TOKEN_EXPIRY,
        });

        // Hash the token for storage
        const passwordResetToken = crypto.createHash("sha256").update(resetToken).digest("hex");

        const passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await prisma.user.update({
            where: { email },
            data: { passwordResetToken, passwordResetExpires },
        });

        // In a real app, you'd send an email here with the reset link
        // For testing purposes, log the link
        const API_BASE_URL = process.env.FRONT_END_URL || "http://localhost:5173";
        const resetUrl = `${API_BASE_URL}/reset-password/${resetToken}`;

        console.log("--------------------");
        console.log("PASSWORD RESET LINK (for testing only):");
        console.log(resetUrl);
        console.log("--------------------");
    }

    // Always return 200 to prevent email enumeration
    res.status(200).json({ message: "If a user with that email exists, a password reset link has been sent." });
});

const resetPassword = asyncHandler(async (req, res) => {
    const { token, password } = req.body;

    if (!token || !password) {
        res.status(400);
        throw new Error("Token and new password are required.");
    }

    // Password strength validation
    if (password.length < 8) {
        res.status(400);
        throw new Error("Password must be at least 8 characters long");
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
        res.status(400);
        throw new Error("Password must contain at least one lowercase letter, one uppercase letter, and one number");
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, JWT_RESET_SECRET);

        // Hash the token to look it up in the database
        const passwordResetToken = crypto.createHash("sha256").update(token).digest("hex");

        const user = await prisma.user.findFirst({
            where: {
                id: decoded.id,
                email: decoded.email,
                passwordResetToken,
                passwordResetExpires: { gt: new Date() },
            },
        });

        if (!user) {
            res.status(400);
            throw new Error("Password reset token is invalid or has expired.");
        }

        // Hash the new password
        const hashedPassword = await argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 2 ** 16,
            timeCost: 3,
            parallelism: 1,
        });

        // Update the user's password and clear reset token
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                passwordResetToken: null,
                passwordResetExpires: null,
            },
        });

        // Invalidate all existing sessions for security
        await prisma.session.deleteMany({ where: { userId: user.id } });

        res.status(200).json({ message: "Password has been reset successfully." });
    } catch (error) {
        res.status(400);
        throw new Error("Password reset token is invalid or has expired.");
    }
});

// --- Route Definitions ---
router.post("/signup", signup);
router.post("/login", authLimiter, login); // Apply rate limiting to login
router.post("/refresh", refreshToken);
router.post("/logout", optionalAuthenticate, logout); // Try to authenticate but don't require it
router.get("/me", authenticateToken, getCurrentUser);
router.post("/forgot-password", authLimiter, forgotPassword); // Apply rate limiting
router.post("/reset-password", resetPassword);

export default router;
