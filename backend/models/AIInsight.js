let mongoose = null;
try {
  mongoose = require("mongoose");
} catch {
  mongoose = null;
}

let AIInsight = null;
if (mongoose) {
  const AIInsightSchema = new mongoose.Schema(
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
      insightType: { type: String, required: true, index: true },
      data: { type: Object, default: {} },
      generatedAt: { type: Date, default: Date.now },
      expiresAt: { type: Date, index: true }
    },
    { timestamps: true }
  );
  AIInsight = mongoose.models.AIInsight || mongoose.model("AIInsight", AIInsightSchema);
}

module.exports = AIInsight || {};
