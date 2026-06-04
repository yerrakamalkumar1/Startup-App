const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text: String,
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const PostSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    title: { type: String, trim: true, default: "" },
    content: { type: String, required: true },
    mediaUrls: [String],
    images: [String],
    tags: [{ type: String, trim: true, lowercase: true }],
    hashtags: [String],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [CommentSchema],
    saves: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    location: String
  },
  { timestamps: true }
);

// MongoDB text search uses this compound text index for fast keyword relevance.
// Weights make title hits rank above body and tag-only hits.
PostSchema.index(
  { title: "text", content: "text", tags: "text", hashtags: "text" },
  {
    name: "PostTextSearchIndex",
    weights: { title: 8, tags: 5, hashtags: 4, content: 2 }
  }
);

module.exports = mongoose.models.Post || mongoose.model("Post", PostSchema);
