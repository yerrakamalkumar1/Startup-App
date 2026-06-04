import type { Request, Response } from "express";
import { User } from "../models/User.model";
import { ApiError, asyncHandler } from "../middleware/error.middleware";

const ALLOWED_LANGUAGES = new Set(["en", "hi", "te", "ta", "kn", "mr"]);
const ALLOWED_FONT_SIZES = new Set(["small", "medium", "large", "extra-large"]);
const ALLOWED_ACCOUNT_PRIVACY = new Set(["public", "private"]);
const ALLOWED_MESSAGING_PRIVACY = new Set(["everyone", "network", "none"]);

function currentUserQuery(req: Request) {
  if (req.user?.mongoId) return { _id: req.user.mongoId };
  if (req.user?.email) return { email: req.user.email.toLowerCase() };
  return { _id: req.user?.id };
}

export const updatePreferencesController = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Unauthorized.");

  const patch: Record<string, string> = {};
  const { preferredLanguage, fontSizePreference, accountPrivacy, messagingPrivacy } = req.body || {};

  if (preferredLanguage) {
    if (!ALLOWED_LANGUAGES.has(preferredLanguage)) throw new ApiError(400, "Unsupported language.");
    patch.preferredLanguage = preferredLanguage;
  }
  if (fontSizePreference) {
    if (!ALLOWED_FONT_SIZES.has(fontSizePreference)) throw new ApiError(400, "Unsupported font size.");
    patch.fontSizePreference = fontSizePreference;
  }
  if (accountPrivacy) {
    if (!ALLOWED_ACCOUNT_PRIVACY.has(accountPrivacy)) throw new ApiError(400, "Unsupported account privacy.");
    patch.accountPrivacy = accountPrivacy;
  }
  if (messagingPrivacy) {
    if (!ALLOWED_MESSAGING_PRIVACY.has(messagingPrivacy)) throw new ApiError(400, "Unsupported messaging privacy.");
    patch.messagingPrivacy = messagingPrivacy;
  }

  const user = await User.findOneAndUpdate(currentUserQuery(req), { $set: patch }, { new: true })
    .select("accountPrivacy messagingPrivacy preferredLanguage fontSizePreference activeSessions blockedUsers mutedUsers")
    .lean();
  if (!user) throw new ApiError(404, "User not found.");

  res.json({ success: true, preferences: user });
});

export const getSecurityHubController = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Unauthorized.");

  const user = await User.findOne(currentUserQuery(req))
    .select("accountPrivacy messagingPrivacy activeSessions blockedUsers mutedUsers")
    .populate("blockedUsers", "name avatar title role")
    .populate("mutedUsers", "name avatar title role")
    .lean();
  if (!user) throw new ApiError(404, "User not found.");

  res.json({ success: true, security: user });
});

export const deleteSessionController = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Unauthorized.");

  const { sessionId } = req.params;
  const update = sessionId === "all"
    ? { $set: { activeSessions: [] } }
    : { $pull: { activeSessions: { sessionId } } };

  const user = await User.findOneAndUpdate(currentUserQuery(req), update, { new: true })
    .select("activeSessions")
    .lean();
  if (!user) throw new ApiError(404, "User not found.");

  res.json({ success: true, removedSessionId: sessionId, activeSessions: user.activeSessions || [] });
});
