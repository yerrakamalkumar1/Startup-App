let mongoose = null;
try {
  mongoose = require("mongoose");
} catch {
  mongoose = null;
}

let Notification = null;
if (mongoose) {
  const NotificationSchema = new mongoose.Schema(
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
      to: { type: String, index: true },
      type: { type: String, index: true },
      text: { type: String, required: true },
      cta: { type: String, default: "" },
      icon: { type: String, default: "sparkles" },
      read: { type: Boolean, default: false, index: true },
      metadata: { type: Object, default: {} }
    },
    { timestamps: true }
  );
  Notification = mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);
}

module.exports = Notification || {};
