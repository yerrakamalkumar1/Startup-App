import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface SavedPostRef {
  post: Types.ObjectId;
  savedAt: Date;
}

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash?: string;
  role: "freelancer" | "startup_admin" | "investor" | "admin";
  avatar?: string;
  title?: string;
  bio?: string;
  city?: string;
  state?: string;
  skills: string[];
  sector?: string;
  savedPosts: SavedPostRef[];
  createdAt: Date;
  updatedAt: Date;
}

const SavedPostSchema = new Schema<SavedPostRef>(
  {
    post: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    savedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    role: {
      type: String,
      enum: ["freelancer", "startup_admin", "investor", "admin"],
      required: true,
      index: true
    },
    avatar: String,
    title: { type: String, trim: true },
    bio: String,
    city: { type: String, index: true },
    state: String,
    skills: [{ type: String, trim: true, lowercase: true }],
    sector: { type: String, trim: true, index: true },
    savedPosts: { type: [SavedPostSchema], default: [] }
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 });
UserSchema.index({ "savedPosts.post": 1, updatedAt: -1 });

export const User: Model<IUser> = mongoose.models.User as Model<IUser> || mongoose.model<IUser>("User", UserSchema);
