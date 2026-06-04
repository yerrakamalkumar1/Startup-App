import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/error.middleware";
import { searchSettingsActions } from "../services/settingsSearch.service";

export const settingsSearchController = asyncHandler(async (req: Request, res: Response) => {
  const payload = await searchSettingsActions(req.query.q);
  res.json(payload);
});
