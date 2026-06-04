import type { Request, Response } from "express";
import { ApiError, asyncHandler } from "../middleware/error.middleware";
import { uploadImageBuffer } from "../services/cloudinary.service";

export const uploadMediaController = asyncHandler(async (req: Request, res: Response) => {
  const files = (req.files || []) as Express.Multer.File[];
  if (!files.length) throw new ApiError(400, "At least one image file is required.");

  const assets = await Promise.all(files.map(file => uploadImageBuffer(file)));
  res.status(201).json({ success: true, assets });
});
