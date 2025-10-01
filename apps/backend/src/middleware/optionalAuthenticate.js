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
    // Get access token only from cookies
    let accessToken = req.cookies.access_token;
    let authMethod = "cookie"; // Only using cookies now

    // No longer supporting Authorization header (Bearer token)

    // Log authentication attempt (with less detail than the required authenticator)
    console.log(`*** OPTIONAL AUTH *** ${req.method} ${req.path}`, {
        hasAccessToken: !!accessToken,
        authMethod: "cookie", // Only using cookies now
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
