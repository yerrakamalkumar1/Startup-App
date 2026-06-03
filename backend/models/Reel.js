const mongoose = require("mongoose");

const ReelSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    videoUrl: String,
    thumbnail: String,
    caption: String,
    views: { type: Number, default: 0 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, text: String, createdAt: { type: Date, default: Date.now } }],
    duration: { type: Number, default: 30 }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Reel || mongoose.model("Reel", ReelSchema);
