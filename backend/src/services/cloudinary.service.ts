import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { env } from "../config/env";
import { ApiError } from "../middleware/error.middleware";

cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
  secure: true
});

export interface UploadedAsset {
  publicId: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
}

export async function uploadImageBuffer(file: Express.Multer.File): Promise<UploadedAsset> {
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    throw new ApiError(503, "Cloudinary is not configured. Add CLOUDINARY_* variables.");
  }

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "connecthub/posts",
        resource_type: "image",
        transformation: [
          { width: 1600, crop: "limit" },
          { quality: "auto:good", fetch_format: "auto" }
        ]
      },
      (error, response) => {
        if (error || !response) reject(error || new Error("Cloudinary upload failed."));
        else resolve(response);
      }
    );

    stream.end(file.buffer);
  });

  return {
    publicId: result.public_id,
    url: result.secure_url,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
    format: result.format
  };
}
