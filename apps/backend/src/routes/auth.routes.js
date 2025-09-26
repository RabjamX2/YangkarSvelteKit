import express from "express";
import prismaPkg from "@prisma/client";
import argon2 from "argon2";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import asyncHandler from "../middleware/asyncHandler.js";

const { PrismaClient } = prismaPkg;
const router = express.Router();
const prisma = new PrismaClient();

const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const getCookieOptions = () => {
    if (process.env.NODE_ENV === "production") {
        // Production settings
        return {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            domain: ".yangkarbhoeche.com",
            expires: new Date(Date.now() + SESSION_DURATION),
        };
    } else {
        // Development settings
        return {
            httpOnly: true,
            secure: false, // Allow HTTP
            sameSite: "none",
            expires: new Date(Date.now() + SESSION_DURATION),
        };
    }
};

// --- Route Controllers ---

const signup = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || typeof username !== "string" || username.length < 3) {
        res.status(400);
        throw new Error("Username must be at least 3 characters long");
    }
    if (!email || typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email)) {
        res.status(400);
        throw new Error("Please provide a valid email address");
    }
    if (!password || typeof password !== "string" || password.length < 6) {
        res.status(400);
        throw new Error("Password must be at least 6 characters long");
    }

    const hashedPassword = await argon2.hash(password);
    const user = await prisma.user.create({
        data: { username, email, password: hashedPassword },
    });
    req.log.info({ event: "user_signup", userId: user.id, username: user.username }, "User signed up");

    const sessionToken = uuidv4();
    const expiresAt = new Date(Date.now() + SESSION_DURATION);

    await prisma.session.create({
        data: { id: sessionToken, userId: user.id, expiresAt },
    });

    res.cookie("session_token", sessionToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        domain: ".yangkarbhoeche.com",
        expires: expiresAt,
    });

    res.status(201).json({ id: user.id, username: user.username, role: user.role });
});

const login = asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user || !(await argon2.verify(user.password, password))) {
        res.status(401);
        throw new Error("Invalid username or password");
    }

    const sessionToken = uuidv4();
    const expiresAt = new Date(Date.now() + SESSION_DURATION);

    await prisma.session.create({
        data: { id: sessionToken, userId: user.id, expiresAt },
    });

    const cookieOptions = getCookieOptions();
    cookieOptions.expires = expiresAt; // Set the correct expiration date

    res.cookie("session_token", sessionToken, cookieOptions);

    req.log.info({ event: "user_login", userId: user.id, username: user.username }, "User logged in");
    res.status(200).json({ id: user.id, username: user.username, role: user.role });
});

const logout = asyncHandler(async (req, res) => {
    const sessionToken = req.cookies.session_token;
    if (sessionToken) {
        await prisma.session.delete({ where: { id: sessionToken } }).catch(() => {});
    }
    res.clearCookie("session_token");
    res.status(200).json({ message: "Logged out" });
});

const getCurrentUser = asyncHandler(async (req, res) => {
    const sessionToken = req.cookies.session_token;
    if (!sessionToken) {
        return res.status(200).json({ user: null }); // Not an error, just no user
    }

    const session = await prisma.session.findUnique({
        where: { id: sessionToken, expiresAt: { gt: new Date() } },
        include: { user: { select: { id: true, username: true, role: true, name: true, email: true } } },
    });

    if (session?.user) {
        const newExpiresAt = new Date(Date.now() + SESSION_DURATION);
        await prisma.session.update({
            where: { id: sessionToken },
            data: { expiresAt: newExpiresAt },
        });

        res.cookie("session_token", sessionToken, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            domain: ".yangkarbhoeche.com",
            expires: newExpiresAt,
        });

        return res.status(200).json({ user: session.user });
    } else {
        res.clearCookie("session_token");
        return res.status(200).json({ user: null });
    }
});

const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) {
        res.status(400);
        throw new Error("Email is required");
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
        const resetToken = crypto.randomBytes(32).toString("hex");
        const passwordResetToken = crypto.createHash("sha256").update(resetToken).digest("hex");
        const passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await prisma.user.update({
            where: { email },
            data: { passwordResetToken, passwordResetExpires },
        });

        const resetUrl = `${API_BASE_URL}/reset-password/${resetToken}`;
        console.log("--------------------");
        console.log("PASSWORD RESET LINK (for testing only):");
        console.log(resetUrl);
        console.log("--------------------");
    }

    res.status(200).json({ message: "If a user with that email exists, a password reset link has been sent." });
});

const resetPassword = asyncHandler(async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) {
        res.status(400);
        throw new Error("Token and new password are required.");
    }
    if (password.length < 6) {
        res.status(400);
        throw new Error("Password must be at least 6 characters long");
    }

    const passwordResetToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await prisma.user.findFirst({
        where: {
            passwordResetToken,
            passwordResetExpires: { gt: new Date() },
        },
    });

    if (!user) {
        res.status(400);
        throw new Error("Password reset token is invalid or has expired.");
    }

    const hashedPassword = await argon2.hash(password);
    await prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            passwordResetToken: null,
            passwordResetExpires: null,
        },
    });

    await prisma.session.deleteMany({ where: { userId: user.id } });

    res.status(200).json({ message: "Password has been reset successfully." });
});

// --- Route Definitions ---
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", getCurrentUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
