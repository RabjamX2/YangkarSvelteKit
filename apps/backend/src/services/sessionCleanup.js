// Session cleanup service
import { PrismaClient } from "@prisma/client";
import logger from "../logger.js";

const prisma = new PrismaClient();

/**
 * Probability-based cleanup to avoid running on every request
 * @param {number} probability - Chance to run cleanup (0-1)
 * @returns {Promise<number>} - Number of deleted sessions
 */
export async function maybeCleanupExpiredSessions(probability = 0.01) {
    // Only run cleanup based on probability (default 1%)
    if (Math.random() > probability) {
        return 0;
    }

    try {
        const now = new Date();
        const result = await prisma.session.deleteMany({
            where: {
                expiresAt: {
                    lt: now,
                },
            },
        });

        if (result.count > 0) {
            logger.info(`Cleanup: Removed ${result.count} expired sessions`);
        }

        return result.count;
    } catch (error) {
        logger.error("Failed to clean up expired sessions:", error);
        return 0;
    }
}

/**
 * Force cleanup of all expired sessions
 * @returns {Promise<number>} - Number of deleted sessions
 */
export async function forceCleanupExpiredSessions() {
    try {
        const now = new Date();
        const result = await prisma.session.deleteMany({
            where: {
                expiresAt: {
                    lt: now,
                },
            },
        });

        logger.info(`Forced cleanup: Removed ${result.count} expired sessions`);
        return result.count;
    } catch (error) {
        logger.error("Failed to clean up expired sessions:", error);
        return 0;
    }
}

/**
 * Schedule regular cleanup of expired sessions (every hour)
 */
export function scheduleSessionCleanup() {
    // Run cleanup immediately on server start
    forceCleanupExpiredSessions();

    // Then run every hour
    setInterval(forceCleanupExpiredSessions, 60 * 60 * 1000);

    logger.info("Scheduled regular session cleanup (hourly)");
}
