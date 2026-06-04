import type { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import { Post } from "../models/Post.model";
import { User } from "../models/User.model";
import { ApiError, asyncHandler } from "../middleware/error.middleware";

function currentUserQuery(req: Request) {
  if (req.user?.mongoId) return { _id: req.user.mongoId };
  if (req.user?.email) return { email: req.user.email.toLowerCase() };
  return { _id: req.user?.id };
}

export const toggleSavedPostController = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Unauthorized.");
  if (!Types.ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid post id.");

  const postId = new Types.ObjectId(req.params.id);
  const session = await mongoose.startSession();
  let saved = false;

  try {
    await session.withTransaction(async () => {
      const postExists = await Post.exists({ _id: postId }).session(session);
      if (!postExists) throw new ApiError(404, "Post not found.");

      const user = await User.findOne(currentUserQuery(req)).session(session);
      if (!user) throw new ApiError(404, "User not found.");

      const alreadySaved = user.savedPosts.some(item => String(item.post) === String(postId));
      saved = !alreadySaved;

      if (alreadySaved) {
        await User.updateOne(
          { _id: user._id },
          { $pull: { savedPosts: { post: postId } } },
          { session }
        );
      } else {
        await User.updateOne(
          { _id: user._id, "savedPosts.post": { $ne: postId } },
          { $push: { savedPosts: { $each: [{ post: postId, savedAt: new Date() }], $position: 0 } } },
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }

  res.json({ success: true, saved });
});

export const getSavedPostsController = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Unauthorized.");

  const user = await User.findOne(currentUserQuery(req))
    .select("savedPosts")
    .populate({
      path: "savedPosts.post",
      populate: { path: "author", select: "name avatar title role city state" }
    });

  if (!user) throw new ApiError(404, "User not found.");

  const hydrated = user.savedPosts
    .filter(item => item.post)
    .sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime())
    .map(item => ({ savedAt: item.savedAt, post: item.post }));

  if (hydrated.length !== user.savedPosts.length) {
    user.savedPosts = hydrated.map(item => ({
      post: (item.post as unknown as { _id: Types.ObjectId })._id,
      savedAt: item.savedAt
    }));
    await user.save();
  }

  res.json({ success: true, savedPosts: hydrated });
});
