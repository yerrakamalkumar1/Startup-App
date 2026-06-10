const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, default: "" },
    type: {
      type: String,
      enum: ["text", "image", "location", "voice", "file", "emoji"],
      default: "text"
    },
    mediaUrl: { type: String, default: null },
    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent"
    },
    deliveredAt: { type: Date, default: null },
    seenAt: { type: Date, default: null },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    reactions: [{ emoji: String, userId: mongoose.Schema.Types.ObjectId }],
    deleted: { type: Boolean, default: false },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId }],
    read: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

MessageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
MessageSchema.index({ receiver: 1, status: 1 });

module.exports = mongoose.models.Message || mongoose.model("Message", MessageSchema);
