import { Router } from "express";
import { deleteSessionController } from "../controllers/accountSettings.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { volatileRouteLimiter } from "../middleware/rateLimit.middleware";

export const authRouter = Router();

authRouter.delete("/sessions/:sessionId", volatileRouteLimiter, requireAuth, deleteSessionController);
