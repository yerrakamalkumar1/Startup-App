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
    content: { type: String, required: true },
    images: [String],
    hashtags: [String],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [CommentSchema],
    saves: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    location: String
  },
  { timestamps: true }
);

module.exports = mongoose.models.Post || mongoose.model("Post", PostSchema);
