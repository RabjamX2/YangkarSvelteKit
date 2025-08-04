/**
 * @description Centralized error handler for the Express application.
 * This middleware should be the last one added to the app stack.
 * It catches all errors passed via `next(error)` and sends a
 * structured JSON response.
 */
const errorHandler = (err, req, res, next) => {
    console.error("ERROR STACK: ", err.stack);

    // Use the status code from the error if it exists, otherwise default to 500
    let statusCode = err.statusCode || 500;
    let message = err.message || "Internal Server Error";

    // Handle specific Prisma errors for more user-friendly messages
    if (err.code === "P2002") {
        statusCode = 409; // Conflict
        // Provides a more specific message, e.g., "A record with this username already exists."
        message = `A record with this ${err.meta.target.join(", ")} already exists.`;
    }

    res.status(statusCode).json({
        error: message,
        // Only show the stack trace in development for debugging purposes
        stack: process.env.NODE_ENV === "production" ? null : err.stack,
    });
};

export default errorHandler;
