import jwt from "jsonwebtoken";
import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg;
const prisma = new PrismaClient();

// Environment variables (should be set in your .env file)
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "change-me-access-secret";

const authenticateToken = async (req, res, next) => {
    // Check for access token
    const accessToken = req.cookies.access_token;

    // Log detailed information about the request in production
    const isProd = process.env.NODE_ENV === "production";
    if (isProd) {
        // Get more detailed cookie information
        const cookieHeader = req.headers.cookie || "no-cookie-header";
        const cookieParts = cookieHeader.split(";").map((c) => c.trim());
        const accessTokenCookie = cookieParts.find((c) => c.startsWith("access_token="));

        console.log(`Auth check for ${req.method} ${req.path}`, {
            hasAccessToken: !!accessToken,
            accessTokenFromCookies: !!req.cookies.access_token,
            rawCookieHeader: cookieHeader,
            accessTokenInHeader: accessTokenCookie ? `${accessTokenCookie.substring(0, 20)}...` : "not-found",
            cookieKeys: Object.keys(req.cookies),
            origin: req.headers.origin || "not-set",
            referer: req.headers.referer || "not-set",
            host: req.headers.host,
            userAgent: req.headers["user-agent"],
            "x-forwarded-host": req.headers["x-forwarded-host"] || "not-set",
            "x-forwarded-proto": req.headers["x-forwarded-proto"] || "not-set",
        });
    }

    if (!accessToken) {
        return res
            .status(401)
            .json({ message: "Authentication required", debug: isProd ? "No access_token cookie" : undefined });
    }

    try {
        // Verify access token
        const decoded = jwt.verify(accessToken, JWT_ACCESS_SECRET);

        // Check CSRF token if this is a non-GET/HEAD request
        if (!["GET", "HEAD"].includes(req.method)) {
            const csrfToken = req.headers["x-csrf-token"];

            if (!csrfToken || csrfToken !== decoded.csrf) {
                return res.status(403).json({ message: "Invalid CSRF token" });
            }
        }

        // Get user from database to ensure they still exist and have proper permissions
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, username: true, email: true, role: true, name: true },
        });

        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }

        // Add user to request object
        req.user = user;
        next();
    } catch (error) {
        // Provide more detailed error information
        const isProd = process.env.NODE_ENV === "production";
        if (isProd) {
            console.error("Token verification error:", {
                errorName: error.name,
                errorMessage: error.message,
                tokenFirstChars: accessToken ? `${accessToken.substring(0, 10)}...` : "null",
            });
        }

        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({
                message: "Token expired",
                code: "TOKEN_EXPIRED",
                debug: isProd ? "JWT token has expired" : undefined,
            });
        }

        return res.status(401).json({
            message: "Invalid token",
            debug: isProd ? `JWT verification failed: ${error.message}` : undefined,
        });
    }
};

export default authenticateToken;
