import jwt from "jsonwebtoken";
import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg;
const prisma = new PrismaClient();

// Environment variables (should be set in your .env file)
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "change-me-access-secret";

const authenticateToken = async (req, res, next) => {
    // Check for access token
    const accessToken = req.cookies.access_token;
    if (!accessToken) {
        return res.status(401).json({ message: "Authentication required" });
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
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ message: "Token expired", code: "TOKEN_EXPIRED" });
        }

        return res.status(401).json({ message: "Invalid token" });
    }
};

export default authenticateToken;
