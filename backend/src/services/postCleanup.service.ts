import type { ClientSession, Types } from "mongoose";
import { User } from "../models/User.model";

export async function scrubDeletedPostReferences(postId: Types.ObjectId, session?: ClientSession): Promise<number> {
  const result = await User.updateMany(
    { "savedPosts.post": postId },
    { $pull: { savedPosts: { post: postId } } },
    { session }
  );
  return result.modifiedCount;
}
