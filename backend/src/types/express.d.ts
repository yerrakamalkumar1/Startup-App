import type { Types } from "mongoose";

declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      mongoId?: Types.ObjectId;
      email?: string;
      name?: string;
      role?: string;
    }

    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
