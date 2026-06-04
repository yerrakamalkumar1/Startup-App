import rateLimit from "express-rate-limit";

export const volatileRouteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please wait a minute and try again."
  }
});
