/**
 * Role-based authorization middleware
 * Use this middleware after authenticateToken to check if the user has the required role
 * Example usage: app.get("/admin-only", authenticateToken, authorizeRoles(["ADMIN"]), adminController);
 */

const authorizeRoles = (roles = []) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required" });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
        }

        next();
    };
};

export default authorizeRoles;
