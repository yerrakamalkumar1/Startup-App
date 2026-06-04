const mongoose = require("mongoose");
const User = require("../models/User");
const Post = require("../models/Post");
const { AppError } = require("../middleware/errorHandler");

function userLookup(user) {
  if (mongoose.Types.ObjectId.isValid(user.id)) return { _id: user.id };
  if (user.email) return { email: String(user.email).toLowerCase() };
  return { _id: user.id };
}

async function toggleSavedPost(req, res, next) {
  try {
    const { postId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(postId)) throw new AppError(400, "Invalid post id.");

    const [user, post] = await Promise.all([
      User.findOne(userLookup(req.user)),
      Post.findById(postId).select("_id")
    ]);
    if (!user) throw new AppError(404, "User not found.");
    if (!post) throw new AppError(404, "Post not found.");

    const existingIndex = (user.savedPosts || []).findIndex(item => String(item.post) === String(postId));
    const saved = existingIndex === -1;

    if (saved) {
      user.savedPosts.unshift({ post: post._id, savedAt: new Date() });
    } else {
      user.savedPosts.splice(existingIndex, 1);
    }

    await user.save();

    return res.json({
      success: true,
      saved,
      postId,
      savedCount: user.savedPosts.length
    });
  } catch (error) {
    return next(error);
  }
}

async function getSavedPosts(req, res, next) {
  try {
    const user = await User.findOne(userLookup(req.user))
      .populate({
        path: "savedPosts.post",
        populate: { path: "author", select: "name avatar title role city state" }
      });

    if (!user) throw new AppError(404, "User not found.");

    const populated = (user.savedPosts || [])
      .filter(item => item.post)
      .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0))
      .map(item => ({
        savedAt: item.savedAt,
        post: item.post
      }));

    if (populated.length !== (user.savedPosts || []).length) {
      user.savedPosts = populated.map(item => ({ post: item.post._id, savedAt: item.savedAt }));
      await user.save();
    }

    return res.json({ success: true, savedPosts: populated });
  } catch (error) {
    return next(error);
  }
}

module.exports = { toggleSavedPost, getSavedPosts };
