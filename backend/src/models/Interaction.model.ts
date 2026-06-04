import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IInteraction extends Document {
  actor: Types.ObjectId;
  recipient: Types.ObjectId;
  post?: Types.ObjectId;
  type: "like" | "comment" | "reply" | "follow" | "message";
  text?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const InteractionSchema = new Schema<IInteraction>(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    post: { type: Schema.Types.ObjectId, ref: "Post", index: true },
    type: { type: String, enum: ["like", "comment", "reply", "follow", "message"], required: true, index: true },
    text: { type: String, trim: true, maxlength: 1600 },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

InteractionSchema.index({ recipient: 1, createdAt: -1 });
InteractionSchema.index({ post: 1, type: 1, createdAt: -1 });

export const Interaction: Model<IInteraction> =
  mongoose.models.Interaction as Model<IInteraction> || mongoose.model<IInteraction>("Interaction", InteractionSchema);
