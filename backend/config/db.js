const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL || "";

const MAX_POOL_SIZE = parseInt(process.env.MONGO_POOL_SIZE || "10");
const MIN_POOL_SIZE = parseInt(process.env.MONGO_MIN_POOL_SIZE || "2");
const SERVER_SELECTION_TIMEOUT = parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT || "5000");
const CONNECT_TIMEOUT = parseInt(process.env.MONGO_CONNECT_TIMEOUT || "10000");

let cachedConnection = null;

async function connectDB() {
  if (cachedConnection) return cachedConnection;
  if (!MONGO_URI) return null;

  try {
    const opts = {
      maxPoolSize: MAX_POOL_SIZE,
      minPoolSize: MIN_POOL_SIZE,
      serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT,
      connectTimeoutMS: CONNECT_TIMEOUT,
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      w: "majority"
    };

    if (mongoose.connection.readyState === 1) {
      cachedConnection = mongoose.connection;
      return cachedConnection;
    }

    cachedConnection = await mongoose.connect(MONGO_URI, opts);
    console.log(`[DB] MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);

    mongoose.connection.on("error", err => {
      console.error("[DB] MongoDB error:", err.message);
      cachedConnection = null;
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("[DB] MongoDB disconnected");
      cachedConnection = null;
    });

    mongoose.connection.on("reconnected", () => {
      console.log("[DB] MongoDB reconnected");
    });

    return cachedConnection;
  } catch (err) {
    console.error("[DB] MongoDB connection failed:", err.message);
    cachedConnection = null;
    return null;
  }
}

async function isDBConnected() {
  return mongoose.connection.readyState === 1;
}

process.on("SIGINT", async () => {
  try {
    await mongoose.connection.close();
    console.log("[DB] MongoDB connection closed on app termination");
  } catch {}
  process.exit(0);
});

module.exports = { connectDB, isDBConnected, mongoose };
