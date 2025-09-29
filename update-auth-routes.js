import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { writeFileSync } from "fs";

/**
 * This script updates the auth.routes.js file to add support for client-side hashed passwords.
 * It adds the necessary functions to verify both pre-hashed and raw passwords.
 */

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the backend auth routes file
const authRoutesPath = join(__dirname, "..", "apps", "backend", "src", "routes", "auth.routes.js");

// Read the file content
const fs = require("fs");
const content = fs.readFileSync(authRoutesPath, "utf8");

// Add the verifyPassword function after the getCookieOptions function
const newContent = content.replace(
    `// Generate tokens for user
const generateTokens = (user) => {`,
    `// Verify password - handles both raw and pre-hashed passwords
const verifyPassword = async (storedHash, providedPassword, hashMethod) => {
    // If the password was pre-hashed on the client side
    if (hashMethod === 'sha256-client') {
        // Convert stored password to SHA-256 for comparison with client-side hash
        const encoder = new TextEncoder();
        const data = encoder.encode(providedPassword);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const serverSideHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        // Compare the server-generated hash with the client-provided hash
        return serverSideHash === providedPassword;
    }
    
    // Default: Use Argon2 to verify the password (standard way)
    return await argon2.verify(storedHash, providedPassword);
};

// Generate tokens for user
const generateTokens = (user) => {`
);

// Update the login function to use verifyPassword
const updatedContent = newContent.replace(
    `const login = asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });

    // Verify user and password
    if (!user || !(await argon2.verify(user.password, password))) {
        res.status(401);
        throw new Error("Invalid username or password");
    }`,
    `const login = asyncHandler(async (req, res) => {
    const { username, password, passwordHashMethod } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });

    // Verify user and password
    if (!user || !(await verifyPassword(user.password, password, passwordHashMethod))) {
        res.status(401);
        throw new Error("Invalid username or password");
    }`
);

// Write the updated content back to the file
fs.writeFileSync(authRoutesPath, updatedContent, "utf8");
console.log("Updated auth.routes.js to support client-side hashed passwords");
