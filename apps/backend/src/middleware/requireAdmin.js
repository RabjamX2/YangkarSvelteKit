import asyncHandler from "./asyncHandler.js";

// Middleware to check if the authenticated user has admin role
const requireAdmin = asyncHandler(async (req, res, next) => {
    // Check if user is authenticated and has the admin role
    if (!req.user) {
        res.status(401);
        throw new Error("Authentication required");
    }

    if (req.user.role !== "ADMIN") {
        res.status(403);
        throw new Error("Admin access required");
    }

    // If user is an admin, allow the request to proceed
    next();
});

export default requireAdmin;
