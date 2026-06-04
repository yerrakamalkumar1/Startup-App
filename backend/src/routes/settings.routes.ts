import { Router } from "express";
import { getSecurityHubController, updatePreferencesController } from "../controllers/accountSettings.controller";
import { settingsSearchController } from "../controllers/settingsSearch.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { volatileRouteLimiter } from "../middleware/rateLimit.middleware";

export const settingsRouter = Router();

settingsRouter.get("/search", volatileRouteLimiter, settingsSearchController);
settingsRouter.get("/security", requireAuth, getSecurityHubController);
settingsRouter.patch("/preferences", requireAuth, updatePreferencesController);
