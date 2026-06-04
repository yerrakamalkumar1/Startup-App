import http from "http";
import mongoose from "mongoose";
import { createApp } from "./app";
import { env } from "./config/env";
import { seedSettingsActions } from "./services/settingsSearch.service";
import { initializeSocketServer } from "./services/socket.service";

async function bootstrap(): Promise<void> {
  await mongoose.connect(env.mongoUri);
  await seedSettingsActions();

  const app = createApp();
  const server = http.createServer(app);
  initializeSocketServer(server);

  server.listen(env.port, () => {
    console.log(`ConnectHub API listening on ${env.port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received. Closing ConnectHub API.`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

bootstrap().catch(error => {
  console.error("ConnectHub API failed to start.", error);
  process.exit(1);
});
