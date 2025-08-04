/**
 * @description This wrapper function catches errors from async Express route handlers
 * and passes them to the next middleware (our error handler), so you don't
 * have to write try-catch blocks in every controller.
 * @param {Function} fn The async route handler function.
 * @returns {Function} An Express route handler.
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
