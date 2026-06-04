import crypto from "crypto";
import jwt, { JwtPayload } from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { env } from "../config/env";

interface ConnectHubTokenPayload extends JwtPayload {
  id?: string;
  userId?: string;
  email?: string;
  name?: string;
  role?: string;
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function verifyLegacyToken(token: string): ConnectHubTokenPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac("sha256", env.jwtSecret).update(encoded).digest("base64url");
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const payload = JSON.parse(decodeBase64Url(encoded)) as ConnectHubTokenPayload;
  if (payload.exp && typeof payload.exp === "number" && Date.now() > payload.exp) return null;
  return payload;
}

function verifyToken(token: string): ConnectHubTokenPayload | null {
  try {
    if (token.split(".").length === 2) return verifyLegacyToken(token);
    return jwt.verify(token, env.jwtSecret) as ConnectHubTokenPayload;
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ success: false, message: "Unauthorized. Please sign in again." });
    return;
  }

  const id = payload.id || payload.userId || payload.sub || payload.email;
  if (!id) {
    res.status(401).json({ success: false, message: "Token is missing user identity." });
    return;
  }

  req.user = {
    id,
    mongoId: Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : undefined,
    email: payload.email,
    name: payload.name,
    role: payload.role
  };

  next();
}
