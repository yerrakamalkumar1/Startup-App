import mongoose, { Document, Model, Schema } from "mongoose";

export interface ISettingsAction extends Document {
  key: string;
  keywordTokens: string[];
  displayName: string;
  category: string;
  deepLinkRoute: string;
  description: string;
  icon: string;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

const SettingsActionSchema = new Schema<ISettingsAction>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    keywordTokens: [{ type: String, required: true, lowercase: true, trim: true }],
    displayName: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    deepLinkRoute: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    icon: { type: String, default: "settings" },
    priority: { type: Number, default: 50, index: true }
  },
  { timestamps: true }
);

SettingsActionSchema.index(
  { displayName: "text", category: "text", keywordTokens: "text", description: "text" },
  {
    name: "SettingsActionTextIndex",
    weights: { displayName: 8, keywordTokens: 7, category: 4, description: 2 }
  }
);

SettingsActionSchema.index({ keywordTokens: 1, priority: -1 });

export const SettingsAction: Model<ISettingsAction> =
  mongoose.models.SettingsAction as Model<ISettingsAction> || mongoose.model<ISettingsAction>("SettingsAction", SettingsActionSchema);
