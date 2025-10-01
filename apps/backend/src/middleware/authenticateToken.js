import jwt from "jsonwebtoken";
import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg;
const prisma = new PrismaClient();

// Environment variables (should be set in your .env file)
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "change-me-access-secret";

const authenticateToken = async (req, res, next) => {
    // Get access token only from cookies
    let accessToken = req.cookies.access_token;
    let authMethod = "cookie"; // Only using cookies now

    // No longer supporting Authorization header (Bearer token)

    // ***CRITICAL DEBUGGING*** - Always log authentication requests regardless of environment
    const isProd = process.env.NODE_ENV === "production";

    // Get raw cookie header information directly
    const cookieHeader = req.headers.cookie || "no-cookie-header";
    const cookieParts = cookieHeader.split(";").map((c) => c.trim());
    const accessTokenCookie = cookieParts.find((c) => c.startsWith("access_token="));

    // Log detailed authentication information
    console.log(`*** AUTH DEBUG *** ${req.method} ${req.path}`, {
        hasAccessToken: !!accessToken,
        authMethodUsed: "cookie", // Only using cookies now
        rawCookieHeader: cookieHeader.substring(0, 100) + (cookieHeader.length > 100 ? "..." : ""),
        accessTokenInHeader: accessTokenCookie ? `${accessTokenCookie.substring(0, 20)}...` : "not-found",
        cookieKeys: Object.keys(req.cookies),
        allHeaders: Object.keys(req.headers).join(", "),
        origin: req.headers.origin || "not-set",
        referer: req.headers.referer || "not-set",
        host: req.headers.host || "not-set",
    });

    if (!accessToken) {
        return res
            .status(401)
            .json({ message: "Authentication required", debug: isProd ? "No access_token cookie" : undefined });
    }

    try {
        // Debug the token we're about to verify
        console.log(`Verifying token using cookie authentication`, {
            tokenLength: accessToken.length,
            tokenFirstChars: accessToken.substring(0, 10) + "...",
            tokenLastChars: "..." + accessToken.substring(accessToken.length - 10),
            secretKeyLength: JWT_ACCESS_SECRET.length,
        });

        // Verify access token
        const decoded = jwt.verify(accessToken, JWT_ACCESS_SECRET);

        console.log("Token verified successfully:", {
            userId: decoded.id,
            tokenIssued: new Date(decoded.iat * 1000).toISOString(),
            tokenExpires: new Date(decoded.exp * 1000).toISOString(),
            hasCsrfToken: !!decoded.csrf,
        });

        // Check CSRF token if this is a non-GET/HEAD request
        if (!["GET", "HEAD"].includes(req.method)) {
            const csrfToken = req.headers["x-csrf-token"];

            if (!csrfToken || csrfToken !== decoded.csrf) {
                console.warn("CSRF token validation failed", {
                    headerToken: csrfToken ? csrfToken.substring(0, 10) + "..." : "missing",
                    decodedToken: decoded.csrf ? decoded.csrf.substring(0, 10) + "..." : "missing",
                    method: req.method,
                });
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

        // Log successful authentication
        console.log(`*** AUTH SUCCESS *** ${req.method} ${req.path}`, {
            userId: user.id,
            username: user.username,
            role: user.role,
            authMethod: authMethod,
            timestamp: new Date().toISOString(),
        });

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
