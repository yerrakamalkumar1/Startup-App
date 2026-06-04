import { Router } from "express";
import multer from "multer";
import { uploadMediaController } from "../controllers/upload.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { volatileRouteLimiter } from "../middleware/rateLimit.middleware";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 6 * 1024 * 1024,
    files: 6
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image uploads are allowed."));
      return;
    }
    cb(null, true);
  }
});

export const uploadRouter = Router();

uploadRouter.post("/media/upload", volatileRouteLimiter, requireAuth, upload.array("files", 6), uploadMediaController);
