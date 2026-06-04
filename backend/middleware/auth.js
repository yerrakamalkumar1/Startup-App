const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "connecthub-free-tier-dev-secret-change-in-render";

function decodeBase64Url(value) {
  return Buffer.from(String(value || "").replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function verifyConnectHubToken(token) {
  if (!token || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length === 2) {
    const [encoded, signature] = parts;
    const expected = crypto.createHmac("sha256", JWT_SECRET).update(encoded).digest("base64url");
    if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const payload = JSON.parse(decodeBase64Url(encoded));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  }

  if (parts.length === 3) {
    const [header, body, signature] = parts;
    const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
    if (signature !== expected) return null;
    const payload = JSON.parse(decodeBase64Url(body));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  }

  return null;
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = verifyConnectHubToken(token);

  if (!payload) {
    return res.status(401).json({ success: false, message: "Unauthorized. Sign in again." });
  }

  req.user = {
    id: payload.id || payload._id || payload.userId || payload.email,
    email: payload.email,
    name: payload.name,
    role: payload.role
  };
  return next();
}

module.exports = { requireAuth, verifyConnectHubToken };
