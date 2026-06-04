export interface EnvConfig {
  nodeEnv: string;
  port: number;
  mongoUri: string;
  jwtSecret: string;
  corsOrigin: string;
  cloudinaryCloudName?: string;
  cloudinaryApiKey?: string;
  cloudinaryApiSecret?: string;
}

export const env: EnvConfig = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/connecthub",
  jwtSecret: process.env.JWT_SECRET || process.env.SESSION_SECRET || "connecthub-free-tier-dev-secret-change-in-render",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET
};
