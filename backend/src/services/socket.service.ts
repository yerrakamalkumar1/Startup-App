import type { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { env } from "../config/env";

export interface EngagementEvent {
  userId: string;
  actorId: string;
  postId: string;
  type: "post_saved" | "post_liked" | "post_commented" | "message_received";
  message: string;
  createdAt: string;
}

let io: Server | null = null;

function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function initializeSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigin,
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = String(socket.handshake.auth?.userId || socket.handshake.query?.userId || "");
    if (userId) {
      socket.join(userRoom(userId));
      socket.emit("connecthub:handshake", { success: true, userId, room: userRoom(userId) });
    }

    socket.on("connecthub:join-user-room", (payload: { userId?: string }) => {
      if (!payload.userId) return;
      socket.join(userRoom(payload.userId));
      socket.emit("connecthub:room-joined", { room: userRoom(payload.userId) });
    });

    socket.on("disconnect", () => {
      socket.removeAllListeners();
    });
  });

  return io;
}

export function emitEngagement(event: EngagementEvent): void {
  if (!io) return;
  io.to(userRoom(event.userId)).emit("connecthub:engagement", event);
}

export function getSocketServer(): Server | null {
  return io;
}
