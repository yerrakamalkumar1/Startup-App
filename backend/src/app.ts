import express from "express";
import { env } from "./config/env";
import { errorHandler, notFound } from "./middleware/error.middleware";
import { authRouter } from "./routes/auth.routes";
import { savedPostsRouter } from "./routes/savedPosts.routes";
import { searchRouter } from "./routes/search.routes";
import { settingsRouter } from "./routes/settings.routes";
import { uploadRouter } from "./routes/upload.routes";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", env.corsOrigin);
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    next();
  });

  app.get("/api/v1/health", (_req, res) => res.json({ success: true, status: "ok" }));
  app.use("/api/v1/search", searchRouter);
  app.use("/api/v1/settings", settingsRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1", savedPostsRouter);
  app.use("/api/v1", uploadRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
