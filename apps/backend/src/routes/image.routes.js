import express from "express";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import asyncHandler from "../middleware/asyncHandler.js";
import authenticateToken from "../middleware/authenticateToken.js";
import { v4 as uuidv4 } from "uuid";
import path from "path";

const router = express.Router();

// Configure Multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit for image uploads
    },
});

// Configure S3 client for Cloudflare R2
const s3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const uploadImage = asyncHandler(async (req, res) => {
    if (!req.file) {
        res.status(400);
        throw new Error("No image file uploaded.");
    }

    const file = req.file;
    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;

    const params = {
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: "public-read",
    };

    try {
        const command = new PutObjectCommand(params);
        await s3.send(command);
        const location = `${process.env.R2_PUBLIC_URL}/${fileName}`;

        res.status(201).json({
            message: "Image uploaded successfully.",
            location: location,
        });
    } catch (error) {
        console.error("Error uploading to R2:", error);
        res.status(500);
        throw new Error("Failed to upload image to R2.");
    }
});

router.post("/upload-image", authenticateToken, upload.single("image"), uploadImage);

export default router;
