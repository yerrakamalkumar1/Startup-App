import mongoose, { Document, Model, Query, Schema, Types } from "mongoose";
import { scrubDeletedPostReferences } from "../services/postCleanup.service";

export interface IPost extends Document {
  author: Types.ObjectId;
  title: string;
  excerpt: string;
  body: string;
  mediaUrls: string[];
  tags: string[];
  likeCount: number;
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    excerpt: { type: String, trim: true, maxlength: 320, default: "" },
    body: { type: String, required: true, trim: true },
    mediaUrls: [{ type: String }],
    tags: [{ type: String, trim: true, lowercase: true, index: true }],
    likeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

// Native MongoDB full-text index. Search queries use $text and sort by textScore.
PostSchema.index(
  { title: "text", excerpt: "text", tags: "text" },
  {
    name: "PostTitleExcerptTagsTextIndex",
    weights: { title: 10, tags: 6, excerpt: 3 }
  }
);

PostSchema.index({ author: 1, createdAt: -1 });
PostSchema.index({ tags: 1, createdAt: -1 });

async function cleanupAfterQueryDelete(this: Query<unknown, IPost>): Promise<void> {
  const filter = this.getFilter();
  const deletedId = filter._id;
  if (deletedId) await scrubDeletedPostReferences(new Types.ObjectId(String(deletedId)));
}

PostSchema.post("findOneAndDelete", async function (doc: IPost | null) {
  if (doc?._id) await scrubDeletedPostReferences(doc._id);
});

PostSchema.post("deleteOne", { query: true, document: false }, cleanupAfterQueryDelete);

export const Post: Model<IPost> = mongoose.models.Post as Model<IPost> || mongoose.model<IPost>("Post", PostSchema);
