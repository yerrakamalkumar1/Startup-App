import { Router } from "express";
import { searchController } from "../controllers/search.controller";
import { volatileRouteLimiter } from "../middleware/rateLimit.middleware";

export const searchRouter = Router();

searchRouter.get("/", volatileRouteLimiter, searchController);
