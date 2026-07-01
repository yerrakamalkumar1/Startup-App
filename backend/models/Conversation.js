const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  lastMessage: { type: String, default: "" },
  lastMessageAt: { type: Date },
  status: { type: String, enum: ["request", "accepted"], default: "request" },
  requester: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  messageRequestAck: { type: Boolean, default: false }
}, { timestamps: true });

ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ requester: 1, status: 1 });

module.exports = mongoose.models.Conversation || mongoose.model("Conversation", ConversationSchema);
