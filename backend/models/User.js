const mongoose = require("mongoose");

const MatchScoreSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  score: Number,
  reasons: [String]
}, { _id: false });

const SavedPostSchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
  savedAt: { type: Date, default: Date.now }
}, { _id: false });

const ActiveSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  deviceType: { type: String, default: "Unknown device" },
  ipAddress: { type: String, default: "" },
  location: { type: String, default: "Unknown location" },
  lastActive: { type: Date, default: Date.now }
}, { _id: false });

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ["freelancer", "startup_admin", "investor", "admin"], required: true },
  whatsapp: String,
  password: String,
  avatar: String,
  coverPhoto: String,
  title: String,
  bio: String,
  tagline: String,
  skills: [String],
  sector: String,
  city: String,
  state: String,
  location: {
    type: { type: String, default: "Point" },
    coordinates: { type: [Number], default: [78.4867, 17.385] },
    city: String,
    state: String
  },
  skillTitle: String,
  hourlyRate: Number,
  portfolio: [{ type: Object }],
  businessName: String,
  stage: String,
  fundingGoal: String,
  teamSize: Number,
  firmName: String,
  focusSectors: [String],
  ticketSizeMin: Number,
  ticketSizeMax: Number,
  verified: { type: Boolean, default: false },
  connections: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  savedPosts: [SavedPostSchema],
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  mutedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  activeSessions: { type: [ActiveSessionSchema], default: [] },
  accountPrivacy: { type: String, enum: ["public", "private"], default: "public" },
  messagingPrivacy: { type: String, enum: ["everyone", "network", "none"], default: "everyone" },
  preferredLanguage: { type: String, enum: ["en", "hi", "te", "ta", "kn", "mr"], default: "en" },
  fontSizePreference: { type: String, enum: ["small", "medium", "large", "extra-large"], default: "medium" },
  profileViews: { type: Number, default: 0 },
  joinedAt: { type: Date, default: Date.now },
  lastActive: Date,
  settings: { type: Object, default: {} },
  profileVector: [Number],
  profileScore: { type: Number, default: 0 },
  matchScores: [MatchScoreSchema],
  churnRiskScore: { type: Number, default: 0 },
  languagePreference: { type: String, enum: ["en", "hi"], default: "en" },
  fraudScore: { type: Number, default: 0 }
}, { timestamps: true });

UserSchema.index({ location: "2dsphere" });

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);
