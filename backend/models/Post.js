const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text: String,
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    replies: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      text: String,
      likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const PostSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    title: { type: String, trim: true, default: "" },
    content: { type: String, required: true },
    mediaUrls: [String],
    images: [String],
    tags: [{ type: String, trim: true, lowercase: true }],
    hashtags: [String],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [CommentSchema],
    saves: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    sharedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    location: String,
    visibility: { type: String, enum: ["public", "private", "friends_only", "draft"], default: "public" },
    isPublished: { type: Boolean, default: true }
  },
  { timestamps: true }
);

PostSchema.index(
  { title: "text", content: "text", tags: "text", hashtags: "text" },
  { name: "PostTextSearchIndex", weights: { title: 8, tags: 5, hashtags: 4, content: 2 } }
);
PostSchema.index({ author: 1, createdAt: -1 });
PostSchema.index({ visibility: 1, isPublished: 1 });

module.exports = mongoose.models.Post || mongoose.model("Post", PostSchema);
