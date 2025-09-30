import jwt from "jsonwebtoken";
import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg;
const prisma = new PrismaClient();

// Environment variables (should be set in your .env file)
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "change-me-access-secret";

/**
 * Optional authentication middleware - will authenticate the user if a token is provided,
 * but will not fail the request if no token is present or if the token is invalid.
 * This is useful for routes like logout that should work regardless of authentication state.
 */
const optionalAuthenticate = async (req, res, next) => {
    // Try to get access token from multiple sources
    // 1. First check Authorization header (primary source)
    // 2. Then fall back to cookies if header isn't present
    let accessToken = null;
    let authMethod = "none"; // Track which auth method was used

    // First check Authorization header (Bearer token) - PRIORITY METHOD
    if (req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith("Bearer ")) {
            accessToken = authHeader.substring(7); // Remove "Bearer " prefix
            authMethod = "bearer"; // Mark that we're using the Authorization header
        }
    }

    // If no Authorization header, fall back to cookies
    if (!accessToken && req.cookies.access_token) {
        accessToken = req.cookies.access_token;
        authMethod = "cookie"; // Mark that we're using cookies
    }

    // Log authentication attempt (with less detail than the required authenticator)
    console.log(`*** OPTIONAL AUTH *** ${req.method} ${req.path}`, {
        hasAccessToken: !!accessToken,
        authMethod: authMethod,
    });

    // If no token provided, just continue without authentication
    if (!accessToken) {
        console.log("No authentication token provided, continuing without authentication");
        return next();
    }

    // If a token is provided, try to authenticate the user
    try {
        // Verify the token
        const decoded = jwt.verify(accessToken, JWT_ACCESS_SECRET);

        // Get user from database
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, username: true, email: true, role: true, name: true },
        });

        if (user) {
            // Add user to request object
            req.user = user;
            console.log(`User authenticated: ${user.username} (${user.id})`);
        }

        // Continue regardless of whether we found a valid user
        next();
    } catch (error) {
        // Log error but don't fail the request
        console.log(`Token validation error: ${error.message}`);

        // Continue without authentication
        next();
    }
};

export default optionalAuthenticate;
