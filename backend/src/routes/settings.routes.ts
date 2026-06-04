import { Router } from "express";
import { settingsSearchController } from "../controllers/settingsSearch.controller";
import { volatileRouteLimiter } from "../middleware/rateLimit.middleware";

export const settingsRouter = Router();

settingsRouter.get("/search", volatileRouteLimiter, settingsSearchController);
