const mongoose = require("mongoose");

const MatchedFreelancerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  score: Number,
  reason: String
}, { _id: false });

const OpportunitySchema = new mongoose.Schema({
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  requiredSkills: [String],
  sector: String,
  matchedFreelancers: [MatchedFreelancerSchema],
  spamScore: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Opportunity || mongoose.model("Opportunity", OpportunitySchema);
