const mongoose = require("mongoose");

const MatchScoreSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  score: Number,
  reasons: [String]
}, { _id: false });

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ["freelancer", "startup_admin", "investor", "admin"], required: true },
  title: String,
  bio: String,
  skills: [String],
  sector: String,
  city: String,
  state: String,
  profileVector: [Number],
  profileScore: { type: Number, default: 0 },
  matchScores: [MatchScoreSchema],
  churnRiskScore: { type: Number, default: 0 },
  languagePreference: { type: String, enum: ["en", "hi"], default: "en" },
  fraudScore: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);
