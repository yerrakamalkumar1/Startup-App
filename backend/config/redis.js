const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_TLS_URL || "";

const DEFAULT_TTL = parseInt(process.env.REDIS_DEFAULT_TTL || "300");
let client = null;
let ready = false;

async function createClient() {
  if (client && ready) return client;
  if (!REDIS_URL) return null;

  try {
    const redis = require("redis");
    const opts = {
      url: REDIS_URL,
      socket: {
        reconnectStrategy: retries => Math.min(retries * 100, 3000),
        connectTimeout: 5000
      }
    };

    if (REDIS_URL.startsWith("rediss://")) {
      opts.socket.tls = true;
      opts.socket.rejectUnauthorized = false;
    }

    client = redis.createClient(opts);

    client.on("connect", () => console.log("[Redis] Connecting..."));
    client.on("ready", () => {
      ready = true;
      console.log("[Redis] Ready");
    });
    client.on("error", err => console.error("[Redis] Error:", err.message));
    client.on("end", () => {
      ready = false;
      console.log("[Redis] Connection closed");
    });
    client.on("reconnecting", () => console.log("[Redis] Reconnecting..."));

    await client.connect();
    return client;
  } catch (err) {
    console.error("[Redis] Failed to create client:", err.message);
    return null;
  }
}

async function getCached(key) {
  if (!client || !ready) return null;
  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

async function setCache(key, data, ttl = DEFAULT_TTL) {
  if (!client || !ready) return;
  try {
    await client.setEx(key, ttl, JSON.stringify(data));
  } catch {}
}

async function delCache(key) {
  if (!client || !ready) return;
  try {
    await client.del(key);
  } catch {}
}

async function invalidatePattern(pattern) {
  if (!client || !ready) return;
  try {
    const keys = await client.keys(pattern);
    if (keys.length) await client.del(keys);
  } catch {}
}

module.exports = {
  createClient,
  getCached,
  setCache,
  delCache,
  invalidatePattern,
  get client() { return client; },
  get ready() { return ready; }
};
