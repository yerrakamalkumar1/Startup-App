import { Router } from "express";
import { getSavedPostsController, toggleSavedPostController } from "../controllers/savedPosts.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { volatileRouteLimiter } from "../middleware/rateLimit.middleware";

export const savedPostsRouter = Router();

savedPostsRouter.post("/posts/save/:id", volatileRouteLimiter, requireAuth, toggleSavedPostController);
savedPostsRouter.get("/users/saved", requireAuth, getSavedPostsController);
