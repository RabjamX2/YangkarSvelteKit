const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * Registers a new user
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function register(req, res) {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        const user = await prisma.user.create({
            data: { username, password: hashedPassword },
        });
        res.status(201).json({ user });
    } catch (err) {
        res.status(500).json({ error: "User creation failed" });
    }
}

/**
 * Logs in a user
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function login(req, res) {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });
    res.json({ user });
}

module.exports = { register, login };
