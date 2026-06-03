const mongoose = require("mongoose");

const ConnectionSchema = new mongoose.Schema(
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending", index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Connection || mongoose.model("Connection", ConnectionSchema);
