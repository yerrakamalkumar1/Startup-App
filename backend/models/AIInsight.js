const mongoose = require("mongoose");

const AIInsightSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  insightType: { type: String, required: true, index: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  generatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, index: true }
}, { timestamps: true });

module.exports = mongoose.models.AIInsight || mongoose.model("AIInsight", AIInsightSchema);
