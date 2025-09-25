import prismaPkg from "@prisma/client";
const { PrismaClient } = prismaPkg;

const prisma = new PrismaClient();

const authenticateToken = async (req, res, next) => {
    const sessionToken = req.cookies.session_token;
    if (!sessionToken) return res.status(401).json({ message: `No session token provided for ${req.path}` });

    try {
        const session = await prisma.session.findUnique({
            where: { id: sessionToken, expiresAt: { gt: new Date() } },
            include: { user: true },
        });
        if (!session || !session.user) {
            return res.status(401).json({ message: "Invalid or expired session" });
        }
        req.user = session.user;
        next();
    } catch (err) {
        return res.status(500).json({ message: "Authentication error", error: err.message });
    }
};

export default authenticateToken;
