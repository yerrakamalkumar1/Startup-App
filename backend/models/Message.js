const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    content: String,
    mediaUrl: String,
    read: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Message || mongoose.model("Message", MessageSchema);
