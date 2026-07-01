const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");
let Server = null;
try {
  ({ Server } = require("socket.io"));
} catch {
  Server = null;
}
let nodemailer = null;
try {
  nodemailer = require("nodemailer");
} catch {
  nodemailer = null;
}
let handleAiApi = null;
try {
  ({ handleAiApi } = require("./routes/ai"));
} catch {
  handleAiApi = null;
}
let handleAiHubApi = null;
try {
  ({ handleAiHubApi } = require("./routes/aihub"));
} catch {
  handleAiHubApi = null;
}
let aiService = null;
try {
  aiService = require("./services/aiService");
} catch {
  aiService = null;
}
let socketIO = null;
const onlineUsers = new Map();
const exploreCache = new Map();
const serverStartedAt = new Date();

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = process.env.CONNECTHUB_DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "connecthub-db.json");
const USERS_FILE = path.join(DATA_DIR, "connecthub-users.json");
const OTP_FILE = path.join(DATA_DIR, "connecthub-otps.json");
const AUDIT_FILE = path.join(DATA_DIR, "connecthub-audit.json");
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "connecthub-free-tier-dev-secret-change-in-render";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const rateLimitBuckets = new Map();

function securityHeaders(extra = {}) {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
    ...extra
  };
}

function rateLimitConfig(route, method) {
  if (route === "/api/health" || route === "/api/realtime/status") return null;
  if (/\/api\/(login|register|auth|password)/.test(route)) {
    return { windowMs: 15 * 60 * 1000, max: 30, label: "auth" };
  }
  if (route === "/api/posts" && method === "POST") {
    return { windowMs: 60 * 60 * 1000, max: 30, label: "post-create" };
  }
  if (route.startsWith("/api/")) return { windowMs: 60 * 1000, max: 180, label: "api" };
  return null;
}

function isRateLimited(req, route) {
  const config = rateLimitConfig(route, req.method);
  if (!config) return false;
  const now = Date.now();
  const ip = getRealIP(req);
  const key = `${config.label}:${ip}`;
  const bucket = rateLimitBuckets.get(key) || { count: 0, resetAt: now + config.windowMs };
  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + config.windowMs;
  }
  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);
  if (rateLimitBuckets.size > 5000) {
    for (const [bucketKey, value] of rateLimitBuckets) {
      if (value.resetAt <= now) rateLimitBuckets.delete(bucketKey);
    }
  }
  return bucket.count > config.max;
}

const DEMO_USERS = {
  "sarah@connecthub.in": {
    name: "Sarah Jenkins",
    role: "freelancer",
    title: "Brand & Growth Designer",
    avatarInitials: "SJ",
    earnings: "Rs 18,500",
    activeContracts: 1
  },
  "rohan@connecthub.in": {
    name: "Rohan Sharma",
    role: "startup_admin",
    title: "Founder, NexaLocal Commerce",
    avatarInitials: "RS",
    startupId: "st-1",
    companyName: "NexaLocal Commerce"
  },
  "ananya@connecthub.in": {
    name: "Ananya Sen",
    role: "investor",
    title: "Partner, India Venture Fund",
    avatarInitials: "AS",
    fundsCommitted: "Rs 5,00,000",
    portfolioSize: 1
  },
  "kamal@connecthub.in": {
    name: "Kamal Kumar",
    role: "freelancer",
    title: "Video Editor & Photographer",
    avatarInitials: "KK",
    city: "Hyderabad",
    state: "Telangana",
    bio: "Creates reels, product videos, and photo campaigns for Indian startups.",
    skills: ["Video Editing", "Photography", "Reels", "Social Media"]
  },
  "meera@connecthub.in": {
    name: "Meera Nair",
    role: "freelancer",
    title: "Frontend Developer",
    avatarInitials: "MN",
    city: "Bengaluru",
    state: "Karnataka",
    bio: "Builds clean React and mobile-first web interfaces for SaaS teams.",
    skills: ["React", "Tailwind", "UI Development"]
  },
  "vikram@connecthub.in": {
    name: "Vikram Reddy",
    role: "startup_admin",
    title: "Founder, FoodLoop",
    avatarInitials: "VR",
    companyName: "FoodLoop",
    city: "Chennai",
    state: "Tamil Nadu",
    bio: "Food and hospitality startup connecting cafes with local digital talent.",
    skills: ["FoodTech", "Operations", "Marketing"]
  }
};

const INITIAL_DB = {
  startups: [
    {
      id: "st-1",
      name: "NexaLocal Commerce",
      sector: "Commerce & Retail",
      stage: "Seed",
      valuation: "Rs 45 Lakh",
      raised: "Rs 12 Lakh",
      target: "Rs 20 Lakh",
      description: "Growing local commerce startup building a faster ordering, fulfilment, and customer-retention system.",
      logoColor: "#ea580c",
      logoInitials: "CP",
      views: [45, 60, 80, 110, 125, 140, 155],
      engagement: [3, 4, 6, 8, 9, 11, 14]
    },
    {
      id: "st-2",
      name: "UrbanNest Platforms",
      sector: "Property & Infrastructure",
      stage: "Series A",
      valuation: "Rs 3.2 Crore",
      raised: "Rs 80 Lakh",
      target: "Rs 1.5 Crore",
      description: "Hyperlocal platform connecting customers, verified operators, and service partners in high-trust sectors.",
      logoColor: "#2563eb",
      logoInitials: "HH",
      views: [90, 115, 130, 145, 160, 190, 210],
      engagement: [5, 6, 8, 9, 11, 12, 16]
    },
    {
      id: "st-3",
      name: "SwiftServe Labs",
      sector: "Consumer Services",
      stage: "Pre-seed",
      valuation: "Rs 25 Lakh",
      raised: "Rs 3 Lakh",
      target: "Rs 10 Lakh",
      description: "Consumer-services startup using operations tech, creator marketing, and local partner networks.",
      logoColor: "#dc2626",
      logoInitials: "TE",
      views: [25, 30, 45, 55, 60, 75, 80],
      engagement: [1, 2, 2, 4, 4, 5, 7]
    }
  ],
  jobs: [
    {
      id: "job-1",
      startupId: "st-1",
      title: "Launch Creative Designer",
      description: "Design a clean launch kit with social creatives, offer graphics, and a mobile-first brand presentation.",
      tags: ["Design", "Canva", "Branding"],
      hourlyRate: 500,
      estimatedHours: 15,
      status: "Active",
      applicants: 4,
      media: null,
      mediaType: ""
    }
  ],
  freelancerAds: [
    {
      id: "fa-1",
      freelancerName: "Sarah Jenkins",
      title: "Brand Launch Creative Pack",
      price: "Rs 6,000",
      category: "Branding & Creative",
      description: "Launch graphics, offer creatives, carousel posts, and campaign templates for early-stage teams.",
      tags: ["Graphic Design", "Branding", "Social Media"],
      appliedDate: "18 May 2026",
      contactPhone: "6301394850",
      media: null,
      mediaType: ""
    }
  ],
  startupPromotions: [],
  applications: [
    {
      id: "app-1",
      jobId: "job-1",
      startupName: "NexaLocal Commerce",
      jobTitle: "Launch Creative Designer",
      proposedRate: 500,
      appliedDate: "19 May 2026",
      status: "Interviewing",
      candidateName: "Sarah Jenkins"
    }
  ],
  events: [],
  investments: [],
  connections: [],
  messages: [],
  notifications: [],
  investorInterests: [],
  reviews: []
};

const SETTINGS_FEATURE_MAP = [
  { key: "change-password", keywordTokens: ["password", "passcode", "security", "credentials", "otp", "login", "reset"], displayName: "Change Password", category: "Security", deepLinkRoute: "/settings/security/update", description: "Send OTP and update your ConnectHub passcode securely.", icon: "key-round", priority: 100 },
  { key: "privacy-visibility", keywordTokens: ["privacy", "visibility", "public", "private", "profile", "hide"], displayName: "Profile Visibility", category: "Privacy", deepLinkRoute: "/settings/privacy/visibility", description: "Control who can view your profile, connections, and work activity.", icon: "eye", priority: 95 },
  { key: "edit-profile", keywordTokens: ["edit", "profile", "bio", "avatar", "photo", "city", "location", "skills"], displayName: "Edit Profile", category: "Account", deepLinkRoute: "/settings/account/profile", description: "Update name, bio, avatar, city, state, skills, and public profile details.", icon: "user-pen", priority: 90 },
  { key: "notification-preferences", keywordTokens: ["notification", "bell", "sound", "email", "messages", "alerts", "push"], displayName: "Notification Preferences", category: "Notifications", deepLinkRoute: "/settings/notifications", description: "Manage alerts for messages, connection requests, post activity, and platform updates.", icon: "bell", priority: 85 },
  { key: "saved-posts", keywordTokens: ["saved", "bookmark", "folder", "posts", "gigs", "collection"], displayName: "Saved Posts & Gigs", category: "Data & Activity", deepLinkRoute: "/settings/activity/saved", description: "Open your saved posts, opportunities, and service ads.", icon: "bookmark", priority: 82 },
  { key: "email-phone", keywordTokens: ["email", "phone", "whatsapp", "contact", "mobile", "number"], displayName: "Manage Email & Phone", category: "Account", deepLinkRoute: "/settings/account/contact", description: "Update your email address, WhatsApp number, and contact details.", icon: "mail", priority: 78 },
  { key: "dark-mode", keywordTokens: ["dark", "light", "theme", "appearance", "mode", "color"], displayName: "Theme", category: "Appearance", deepLinkRoute: "/settings/appearance/theme", description: "Switch between light, dark, and system theme modes.", icon: "palette", priority: 75 },
  { key: "language-preference", keywordTokens: ["language", "languages", "hindi", "telugu", "english", "translation", "locale"], displayName: "Language", category: "Language & Region", deepLinkRoute: "/settings/language", description: "Switch ConnectHub labels and helper text between supported Indian languages.", icon: "languages", priority: 74 },
  { key: "font-size", keywordTokens: ["font", "size", "text", "accessibility", "large", "small", "readable"], displayName: "Font Size", category: "Accessibility", deepLinkRoute: "/settings/accessibility/font-size", description: "Adjust the app font scale for comfortable reading on mobile and desktop.", icon: "type", priority: 73 },
  { key: "blocked-users", keywordTokens: ["block", "blocked", "mute", "muted", "report", "spam"], displayName: "Block / Muted Users", category: "Privacy", deepLinkRoute: "/settings/privacy/blocked", description: "Manage people you blocked or muted on ConnectHub.", icon: "ban", priority: 70 },
  { key: "ai-hub-settings", keywordTokens: ["ai", "hub", "matches", "recommendations", "location", "intelligence"], displayName: "AI Hub", category: "AI & Recommendations", deepLinkRoute: "/settings/ai-hub", description: "Configure role-specific AI matching, location discovery, and smart suggestions.", icon: "sparkles", priority: 68 },
  { key: "download-data", keywordTokens: ["download", "export", "data", "activity", "backup"], displayName: "Download Your Data", category: "Data & Activity", deepLinkRoute: "/settings/activity/export", description: "Prepare a copy of your profile, posts, and activity records.", icon: "download", priority: 62 },
  { key: "help-support", keywordTokens: ["help", "support", "call", "problem", "bug", "feedback"], displayName: "Help Center", category: "Support", deepLinkRoute: "/settings/support/help", description: "Call support, report a problem, or send feedback to ConnectHub.", icon: "help-circle", priority: 58 },
  { key: "logout", keywordTokens: ["logout", "log out", "sign out", "exit", "session"], displayName: "Log Out", category: "Account Actions", deepLinkRoute: "/settings/account/logout", description: "Sign out from this device safely.", icon: "log-out", priority: 52 }
];

const INDIA_CONTEXT = {
  country: "India",
  timezone: "Asia/Kolkata",
  locale: "en-IN",
  currency: "INR",
  currencySymbol: "Rs",
  supportPhone: "6301394850",
  primaryCities: [
    "Hyderabad",
    "Bengaluru",
    "Mumbai",
    "Delhi NCR",
    "Chennai",
    "Pune",
    "Kolkata",
    "Ahmedabad",
    "Jaipur",
    "Kochi",
    "Indore",
    "Coimbatore",
    "Visakhapatnam",
    "Kakinada"
  ],
  languages: [
    { code: "en", label: "English" },
    { code: "hi", label: "Hindi" },
    { code: "te", label: "Telugu" },
    { code: "ta", label: "Tamil" },
    { code: "kn", label: "Kannada" },
    { code: "mr", label: "Marathi" },
    { code: "ur", label: "Urdu" }
  ],
  sectors: [
    "Commerce & Retail",
    "Food & Hospitality",
    "Property & Infrastructure",
    "Health & Wellness",
    "Education & Training",
    "Finance & Legal",
    "Logistics & Mobility",
    "SaaS & Technology",
    "Consumer Services",
    "Media & Entertainment",
    "Manufacturing & Hardware"
  ],
  roleLabels: {
    freelancer: "Freelancer",
    startup_admin: "Startup Owner",
    startup: "Startup Owner",
    founder: "Startup Founder",
    investor: "Investor / Sponsor"
  }
};

function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) writeJson(DB_FILE, INITIAL_DB);
  if (!fs.existsSync(USERS_FILE)) writeJson(USERS_FILE, {});
  if (!fs.existsSync(OTP_FILE)) writeJson(OTP_FILE, {});
  if (!fs.existsSync(AUDIT_FILE)) writeJson(AUDIT_FILE, []);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signToken(payload) {
  const body = {
    ...payload,
    iat: Date.now(),
    exp: Date.now() + TOKEN_TTL_MS
  };
  const encoded = base64url(JSON.stringify(body));
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyToken(token) {
  try {
    if (!token || !token.includes(".")) return null;
    const [encoded, signature] = token.split(".");
    const expected = crypto.createHmac("sha256", JWT_SECRET).update(encoded).digest("base64url");
    if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(encoded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function authFromRequest(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return verifyToken(token);
}

function tokenFromRequest(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function getRealIP(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const raw = forwarded || req.headers["x-real-ip"] || req.socket?.remoteAddress || "";
  return String(raw || "Unknown").replace(/^::ffff:/, "");
}

function isPrivateIP(ip) {
  const value = String(ip || "");
  return !value ||
    value === "Unknown" ||
    value === "::1" ||
    value === "127.0.0.1" ||
    value.startsWith("10.") ||
    value.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(value);
}

function parseDeviceInfo(userAgent = "") {
  const ua = String(userAgent || "");
  const browser = /Edg\//.test(ua) ? "Microsoft Edge"
    : /OPR\//.test(ua) ? "Opera"
      : /Chrome\//.test(ua) ? "Chrome"
        : /Firefox\//.test(ua) ? "Firefox"
          : /Safari\//.test(ua) ? "Safari"
            : "Browser";
  const os = /Android/i.test(ua) ? "Android"
    : /iPhone|iPad|iPod/i.test(ua) ? "iOS"
      : /Windows/i.test(ua) ? "Windows"
        : /Mac OS/i.test(ua) ? "macOS"
          : /Linux/i.test(ua) ? "Linux"
            : "Unknown OS";
  const deviceType = /iPad|Tablet/i.test(ua) ? "Tablet"
    : /Mobi|Android|iPhone|iPod/i.test(ua) ? "Mobile"
      : "Desktop";
  return {
    browser,
    os,
    deviceType,
    label: `${deviceType} - ${browser} on ${os}`
  };
}

function deviceFingerprint(req) {
  const raw = [
    req.headers["user-agent"] || "",
    req.headers["accept-language"] || "",
    req.headers["sec-ch-ua-platform"] || "",
    req.headers["sec-ch-ua-mobile"] || ""
  ].join("|");
  return crypto.createHash("sha256").update(raw || "connecthub-device").digest("hex");
}

function fetchIpLocation(ip) {
  if (isPrivateIP(ip)) {
    return Promise.resolve("Local Network");
  }
  return new Promise(resolve => {
    const request = https.get(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, response => {
      let body = "";
      response.on("data", chunk => {
        body += chunk;
        if (body.length > 64 * 1024) request.destroy();
      });
      response.on("end", () => {
        try {
          const data = JSON.parse(body || "{}");
          if (data.error) return resolve("Unknown Location");
          const parts = [data.city, data.region, data.country_name].filter(Boolean);
          resolve(parts.join(", ") || "Unknown Location");
        } catch {
          resolve("Unknown Location");
        }
      });
    });
    request.setTimeout(2500, () => {
      request.destroy();
      resolve("Unknown Location");
    });
    request.on("error", () => resolve("Unknown Location"));
  });
}

function fetchIpGeoDetails(ip) {
  const cleanIp = String(ip || "").replace(/^::ffff:/, "").trim();
  if (isPrivateIP(cleanIp)) {
    return Promise.resolve({
      ip: cleanIp || "Unknown",
      city: "Local Network",
      region: "",
      country: "",
      countryCode: "",
      latitude: null,
      longitude: null,
      isp: "",
      source: "private-ip"
    });
  }
  return new Promise(resolve => {
    const req = http.get(`http://ip-api.com/json/${encodeURIComponent(cleanIp)}?fields=status,message,country,countryCode,regionName,city,lat,lon,isp,query`, response => {
      let body = "";
      response.on("data", chunk => {
        body += chunk;
        if (body.length > 64 * 1024) req.destroy();
      });
      response.on("end", () => {
        try {
          const data = JSON.parse(body || "{}");
          if (data.status !== "success") {
            return resolve({
              ip: cleanIp,
              city: "Unknown Location",
              region: "",
              country: "",
              countryCode: "",
              latitude: null,
              longitude: null,
              isp: "",
              source: "ip-api",
              error: data.message || "Lookup failed"
            });
          }
          resolve({
            ip: data.query || cleanIp,
            city: data.city || "",
            region: data.regionName || "",
            country: data.country || "",
            countryCode: data.countryCode || "",
            latitude: Number.isFinite(Number(data.lat)) ? Number(data.lat) : null,
            longitude: Number.isFinite(Number(data.lon)) ? Number(data.lon) : null,
            isp: data.isp || "",
            source: "ip-api"
          });
        } catch {
          resolve({
            ip: cleanIp,
            city: "Unknown Location",
            region: "",
            country: "",
            countryCode: "",
            latitude: null,
            longitude: null,
            isp: "",
            source: "ip-api",
            error: "Invalid lookup response"
          });
        }
      });
    });
    req.setTimeout(2500, () => {
      req.destroy();
      resolve({
        ip: cleanIp,
        city: "Unknown Location",
        region: "",
        country: "",
        countryCode: "",
        latitude: null,
        longitude: null,
        isp: "",
        source: "ip-api",
        error: "Lookup timeout"
      });
    });
    req.on("error", () => resolve({
      ip: cleanIp,
      city: "Unknown Location",
      region: "",
      country: "",
      countryCode: "",
      latitude: null,
      longitude: null,
      isp: "",
      source: "ip-api",
      error: "Lookup request failed"
    }));
  });
}

function normalizeSession(session = {}, currentFingerprint = "") {
  const current = Boolean(session.isCurrent || session.fingerprint === currentFingerprint || session.sessionId === "current");
  return {
    _id: session.sessionId || session._id || "current",
    sessionId: session.sessionId || session._id || "current",
    device: session.device || session.deviceLabel || session.deviceType || "Browser session",
    deviceType: session.deviceType || "Browser",
    browser: session.browser || "",
    os: session.os || "",
    ip: session.ip || session.ipAddress || "",
    ipAddress: session.ipAddress || session.ip || "",
    city: session.city || session.location || "Unknown location",
    location: session.location || session.city || "Unknown location",
    userAgent: session.userAgent || "",
    createdAt: session.createdAt || new Date().toISOString(),
    lastActive: session.lastActive || session.createdAt || new Date().toISOString(),
    isCurrent: current
  };
}

async function recordLoginSession(auth, token, req) {
  try {
    const key = authUserKey(auth);
    if (!key) return null;
    const db = readJson(DB_FILE, INITIAL_DB);
    const users = readJson(USERS_FILE, {});
    const currentSettings = db.userSettingsByUser?.[key] || {};
    const ip = getRealIP(req);
    const userAgent = req.headers["user-agent"] || "";
    const device = parseDeviceInfo(userAgent);
    const fingerprint = deviceFingerprint(req);
    const sessionId = `sess-${fingerprint.slice(0, 18)}`;
    const tokenHash = crypto.createHash("sha256").update(token || "").digest("hex");
    const city = await fetchIpLocation(ip);
    const now = new Date().toISOString();
    const previousSessions = Array.isArray(currentSettings.activeSessions) ? currentSettings.activeSessions : [];
    const previousLocations = previousSessions.map(item => item.city || item.location).filter(Boolean);
    const existing = previousSessions.find(item => item.fingerprint === fingerprint || item.sessionId === sessionId);
    const nextSession = {
      ...(existing || {}),
      sessionId,
      tokenHash,
      fingerprint,
      device: device.label,
      deviceType: device.deviceType,
      browser: device.browser,
      os: device.os,
      ip,
      ipAddress: ip,
      city,
      location: city,
      userAgent,
      createdAt: existing?.createdAt || now,
      lastActive: now
    };
    let nextSessions = [nextSession, ...previousSessions.filter(item => item.sessionId !== sessionId && item.fingerprint !== fingerprint)]
      .sort((a, b) => new Date(b.lastActive || 0) - new Date(a.lastActive || 0))
      .slice(0, 5);

    db.userSettingsByUser = db.userSettingsByUser || {};
    db.userSettingsByUser[key] = { ...currentSettings, activeSessions: nextSessions };
    const email = normalizeEmail(auth?.email);
    if (email && users[email]?.profile) users[email].profile.activeSessions = nextSessions;

    if (!existing && previousLocations.length && !["Local Network", "Unknown Location"].includes(city) && !previousLocations.includes(city)) {
      createNotification(db, auth.name || auth.email, "security", `New login detected from ${city}.`, {
        id: `not-login-${sessionId}-${Date.now()}`,
        from: "ConnectHub Security",
        sessionId
      });
      sendEmailNotification(auth.email, "New ConnectHub login detected", `A new login was detected from ${city} on ${device.label}.`).catch(() => {});
    }

    writeJson(DB_FILE, db);
    writeJson(USERS_FILE, users);
    return nextSession;
  } catch (error) {
    console.error("[SessionTracker] Login session tracking failed:", error.message);
    return null;
  }
}

function touchActiveSession(auth, req) {
  try {
    const key = authUserKey(auth);
    if (!key) return;
    const db = readJson(DB_FILE, INITIAL_DB);
    const currentSettings = db.userSettingsByUser?.[key];
    const sessions = currentSettings?.activeSessions;
    if (!Array.isArray(sessions) || !sessions.length) return;
    const fingerprint = deviceFingerprint(req);
    const session = sessions.find(item => item.fingerprint === fingerprint);
    if (!session) return;
    const last = new Date(session.lastActive || 0).getTime();
    if (Date.now() - last < 60 * 1000) return;
    session.lastActive = new Date().toISOString();
    session.ip = session.ipAddress = getRealIP(req);
    writeJson(DB_FILE, db);
  } catch {
    // Session freshness must never block normal API requests.
  }
}

function registeredProfilesFromUsers() {
  const users = readJson(USERS_FILE, {});
  return Object.entries(users)
    .map(([email, entry]) => entry.profile ? { email, ...entry.profile } : null)
    .filter(Boolean);
}

function publicDB() {
  const db = readJson(DB_FILE, INITIAL_DB);
  db.registeredProfiles = mergeById(db.registeredProfiles || [], registeredProfilesFromUsers());
  if (!Array.isArray(db.investorInterests)) db.investorInterests = [];
  if (!Array.isArray(db.reviews)) db.reviews = [];
  if (!Array.isArray(db.savedProfiles)) db.savedProfiles = [];
  if (!db.savedPostsByUser || typeof db.savedPostsByUser !== "object") db.savedPostsByUser = {};
  return db;
}

function setProfilePresence(names = [], isOnline = false) {
  const identifiers = new Set(
    names
      .map(name => String(name || "").trim().toLowerCase())
      .filter(Boolean)
  );
  if (!identifiers.size) return;
  const lastSeen = new Date().toISOString();
  let changed = false;

  const matches = profile => {
    if (!profile) return false;
    return [
      profile.name,
      profile.companyName,
      profile.username,
      profile.handle,
      profile.email
    ].some(value => identifiers.has(String(value || "").trim().toLowerCase()));
  };

  const db = readJson(DB_FILE, INITIAL_DB);
  db.registeredProfiles = (db.registeredProfiles || []).map(profile => {
    if (!matches(profile)) return profile;
    changed = true;
    return { ...profile, isOnline, lastSeen };
  });

  const users = readJson(USERS_FILE, {});
  Object.keys(users || {}).forEach(email => {
    const profile = users[email]?.profile;
    if (!matches({ ...profile, email })) return;
    users[email].profile = { ...profile, isOnline, lastSeen };
    changed = true;
  });

  if (changed) {
    writeJson(DB_FILE, db);
    writeJson(USERS_FILE, users);
  }
}

function mergeById(existingItems = [], incomingItems = []) {
  const map = new Map();
  [...existingItems, ...incomingItems].forEach(item => {
    if (!item) return;
    const key = item.id || item.email || `${item.from || ""}-${item.to || ""}-${item.createdAt || ""}-${item.text || item.name || ""}`;
    map.set(key, { ...(map.get(key) || {}), ...item });
  });
  return Array.from(map.values());
}

function mergeDBState(existingDB, incomingDB) {
  const existing = existingDB || INITIAL_DB;
  const incoming = incomingDB || {};
  const merged = {
    ...existing,
    ...incoming,
    startups: mergeById(existing.startups, incoming.startups),
    jobs: mergeById(existing.jobs, incoming.jobs),
    freelancerAds: mergeById(existing.freelancerAds, incoming.freelancerAds),
    startupPromotions: mergeById(existing.startupPromotions, incoming.startupPromotions),
    applications: mergeById(existing.applications, incoming.applications),
    events: mergeById(existing.events, incoming.events),
    investments: mergeById(existing.investments, incoming.investments),
    connections: mergeById(existing.connections, incoming.connections),
    savedProfiles: mergeById(existing.savedProfiles, incoming.savedProfiles),
    messages: mergeById(existing.messages, incoming.messages),
    notifications: mergeById(existing.notifications, incoming.notifications),
    registeredProfiles: mergeById(existing.registeredProfiles, incoming.registeredProfiles),
    investorInterests: mergeById(existing.investorInterests, incoming.investorInterests),
    reviews: mergeById(existing.reviews, incoming.reviews),
    savedPostsByUser: { ...(existing.savedPostsByUser || {}), ...(incoming.savedPostsByUser || {}) }
  };
  return merged;
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    ...securityHeaders({ "Content-Type": "application/json" }),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 6 * 1024 * 1024) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON."));
      }
    });
  });
}

function initialsFor(name) {
  return name.split(" ").map(word => word[0]).join("").toUpperCase().substring(0, 2);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, userRecord) {
  if (userRecord.passwordHash && userRecord.passwordSalt) {
    return hashPassword(password, userRecord.passwordSalt).hash === userRecord.passwordHash;
  }
  return userRecord.password === password;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isSmtpConfigured() {
  return Boolean(nodemailer && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendOtpEmail(email, otp) {
  if (!isSmtpConfigured()) {
    throw new Error("Email OTP is not configured. Add SMTP_USER and SMTP_PASS in Render. Use a Gmail app password.");
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: "Connect Hub password reset OTP",
    text: `Your Connect Hub password reset OTP is ${otp}. It expires in 10 minutes.`,
    html: `<p>Your Connect Hub password reset OTP is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`
  });
}

async function sendEmailNotification(toEmail, subject, text) {
  if (!toEmail || !isSmtpConfigured()) return;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject,
    text
  });
}

function profileByName(name) {
  const needle = String(name || "").trim().toLowerCase();
  return registeredProfilesFromUsers().find(profile => String(profile.name || "").toLowerCase() === needle) ||
    Object.entries(DEMO_USERS).map(([email, profile]) => ({ ...profile, email }))
      .find(profile => String(profile.name || "").toLowerCase() === needle);
}

function profileHandle(profile) {
  return String(profile.email || profile.name || "user")
    .toLowerCase()
    .replace(/@.*/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function allPeople(db = publicDB()) {
  const startups = db.startups || [];
  const startupById = new Map(startups.map(startup => [startup.id, startup]));
  const seen = new Set();
  return [
    ...Object.entries(DEMO_USERS).map(([email, profile]) => ({ ...profile, email })),
    ...(db.registeredProfiles || [])
  ]
    .map(profile => {
      const startup = profile.startupId ? startupById.get(profile.startupId) : null;
      const relatedAds = (db.freelancerAds || []).filter(ad => ad.freelancerName === profile.name);
      const relatedPosts = (db.profilePosts || []).filter(post => post.authorName === profile.name || post.authorEmail === profile.email);
      const relatedPromos = (db.startupPromotions || []).filter(post => post.startupName === profile.companyName || post.startupName === profile.name);
      const relatedJobs = (db.jobs || []).filter(job => job.startupId === profile.startupId);
      const searchTerms = [
        ...relatedAds.flatMap(ad => [ad.title, ad.category, ad.description, ...(ad.tags || [])]),
        ...relatedPosts.flatMap(post => [post.title, post.description, post.caption, ...(post.tags || [])]),
        ...relatedPromos.flatMap(post => [post.title, post.description, ...(post.tags || [])]),
        ...relatedJobs.flatMap(job => [job.title, job.description, ...(job.tags || [])])
      ].filter(Boolean);
      const inferredSkills = searchTerms.filter(term => {
        const text = String(term || "").trim();
        return text.length <= 42 && /design|editor|editing|video|reel|photo|camera|developer|marketing|sales|branding|ai|web|app/i.test(text);
      });
      const skillList = compactStringArray([profile.skills || [], inferredSkills]).slice(0, 12);
      const tagList = compactStringArray([
        profile.tags || [],
        profile.focusSectors || [],
        startup?.sector,
        profile.sector,
        profile.industry,
        profile.companyName || startup?.name,
        profile.city || startup?.city,
        profile.title || profile.role
      ]).slice(0, 12);
      return {
        ...profile,
        handle: profileHandle(profile),
        username: profile.username || profile.handle || profileHandle(profile),
        companyName: profile.companyName || startup?.name || "",
        company: profile.company || profile.companyName || startup?.name || "",
        sector: startup?.sector || profile.sector || "",
        industry: profile.industry || startup?.sector || profile.sector || "",
        city: profile.city || startup?.city || "",
        state: profile.state || startup?.state || "",
        skills: skillList,
        tags: tagList,
        isOnline: Boolean(profile.isOnline),
        createdAt: profile.createdAt || profile.joinedAt || profile.lastActive || new Date(0).toISOString(),
        joinedAt: profile.joinedAt || profile.createdAt || "",
        searchText: searchTerms.join(" ")
      };
    })
    .filter(profile => {
      const key = profile.email || profile.handle || profile.name;
      if (!key || seen.has(String(key).toLowerCase())) return false;
      seen.add(String(key).toLowerCase());
      return true;
    });
}

function roleBucket(role = "") {
  const value = String(role).toLowerCase();
  if (value.includes("startup") || value.includes("recruiter")) return "startup";
  if (value.includes("investor")) return "investor";
  return "freelancer";
}

function profileUrlFor(profile, req) {
  const host = req?.headers?.host || "connecthub-f2sp.onrender.com";
  const protocol = host.includes("localhost") || host.startsWith("127.") ? "http" : "https";
  return `${protocol}://${host}/profile/${profileHandle(profile)}`;
}

function connectionNamesFor(db, name) {
  return new Set((db.connections || [])
    .filter(item => (item.status || "Accepted") === "Accepted" || item.status === "Pending")
    .filter(item => item.from === name || item.to === name)
    .map(item => item.from === name ? item.to : item.from)
    .filter(Boolean));
}

function mutualConnectionCount(db, currentName, otherName) {
  if (!currentName || !otherName) return 0;
  const mine = connectionNamesFor(db, currentName);
  const theirs = connectionNamesFor(db, otherName);
  return [...mine].filter(name => theirs.has(name)).length;
}

function searchPeople(db, { query = "", role = "", location = "", skills = "", company = "", currentName = "" } = {}, req) {
  const q = String(query || "").trim().toLowerCase().replace(/^@/, "");
  const queryTerms = expandPeopleSearchTerms(q);
  const filters = {
    role: String(role || "").trim().toLowerCase(),
    location: String(location || "").trim().toLowerCase(),
    skills: String(skills || "").trim().toLowerCase(),
    company: String(company || "").trim().toLowerCase()
  };
  const scoreFor = profile => {
    const handle = profile.handle || profileHandle(profile);
    const roleText = [profile.role, profile.title].filter(Boolean).join(" ").toLowerCase();
    const locationText = [profile.city, profile.state].filter(Boolean).join(" ").toLowerCase();
    const skillsText = [...(profile.skills || []), profile.sector].filter(Boolean).join(" ").toLowerCase();
    const companyText = String(profile.companyName || "").toLowerCase();
    const haystack = [profile.name, handle, roleText, locationText, skillsText, companyText, profile.bio, profile.searchText].join(" ").toLowerCase();
    if (filters.role && !roleBucket(profile.role).includes(filters.role) && !roleText.includes(filters.role)) return -1;
    if (filters.location && !locationText.includes(filters.location)) return -1;
    if (filters.skills && !skillsText.includes(filters.skills)) return -1;
    if (filters.company && !companyText.includes(filters.company)) return -1;
    if (!q) return 1;
    if (String(profile.name || "").toLowerCase() === q) return 100;
    if (handle === q) return 95;
    if (String(profile.name || "").toLowerCase().startsWith(q)) return 90;
    if (String(profile.name || "").toLowerCase().split(/\s+/).some(part => part.startsWith(q) || q.startsWith(part))) return 86;
    if (queryTerms.some(term => roleText.includes(term))) return 70;
    if (queryTerms.some(term => locationText.includes(term))) return 55;
    if (queryTerms.some(term => skillsText.includes(term))) return 45;
    if (queryTerms.some(term => companyText.includes(term))) return 40;
    return queryTerms.some(term => haystack.includes(term)) ? 20 : -1;
  };
  return allPeople(db)
    .map(profile => ({ profile, score: scoreFor(profile) }))
    .filter(item => item.score >= 0)
    .sort((a, b) => b.score - a.score || String(a.profile.name).localeCompare(String(b.profile.name)))
    .map(({ profile }) => ({
      id: profile.handle || profileHandle(profile),
      name: profile.name,
      handle: profile.handle || profileHandle(profile),
      role: profile.title || roleBucket(profile.role),
      roleType: roleBucket(profile.role),
      location: [profile.city, profile.state].filter(Boolean).join(", "),
      skills: profile.skills || [],
      tags: profile.tags || [],
      industry: profile.industry || profile.sector || "",
      company: profile.company || profile.companyName || "",
      companyName: profile.companyName || "",
      mutualConnections: mutualConnectionCount(db, currentName, profile.name),
      avatarInitials: profile.avatarInitials || initialsFor(profile.name || "CH"),
      avatarPhoto: profile.avatarPhoto || null,
      bio: profile.bio || "",
      isVerified: Boolean(profile.isVerified || profile.verified),
      followersCount: Number(profile.followersCount || profile.profileViews || 0),
      profileUrl: profileUrlFor(profile, req)
    }));
}

function compactStringArray(values = []) {
  const seen = new Set();
  const result = [];
  values.flat().forEach(value => {
    const clean = String(value || "").replace(/^#/, "").replace(/\s+/g, " ").trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) return;
    seen.add(key);
    result.push(clean);
  });
  return result;
}

function networkProfilePayload(profile, db, currentName, req) {
  const skills = compactStringArray(profile.skills || []);
  const tags = compactStringArray([
    profile.tags || [],
    profile.industry,
    profile.sector,
    profile.company || profile.companyName,
    profile.city,
    profile.title || profile.role
  ]).slice(0, 12);
  return {
    _id: profile.handle || profileHandle(profile),
    id: profile.handle || profileHandle(profile),
    userId: profile.handle || profileHandle(profile),
    name: profile.name || "ConnectHub member",
    username: profile.handle || profileHandle(profile),
    handle: profile.handle || profileHandle(profile),
    avatar: profile.avatar || profile.avatarPhoto?.dataUrl || "",
    avatarInitials: profile.avatarInitials || initialsFor(profile.name || "CH"),
    avatarPhoto: profile.avatarPhoto || null,
    role: profile.title || roleBucket(profile.role),
    roleType: roleBucket(profile.role),
    company: profile.company || profile.companyName || "",
    companyName: profile.companyName || profile.company || "",
    industry: profile.industry || profile.sector || "",
    location: [profile.city, profile.state].filter(Boolean).join(", ") || "India",
    city: profile.city || "",
    state: profile.state || "",
    skills,
    tags,
    bio: profile.bio || "",
    isVerified: Boolean(profile.isVerified || profile.verified),
    followersCount: Number(profile.followersCount || profile.profileViews || 0),
    connections: [...connectionNamesFor(db, profile.name || "")],
    mutualConnections: mutualConnectionCount(db, currentName, profile.name),
    profileUrl: profileUrlFor(profile, req)
  };
}

function findNetworkProfile(db, value) {
  const needle = String(value || "").replace(/^@/, "").trim().toLowerCase();
  return allPeople(db).find(profile => {
    const identifiers = [
      profile.handle,
      profile.email,
      profile.name,
      profileHandle(profile)
    ].filter(Boolean).map(item => String(item).toLowerCase());
    return identifiers.includes(needle);
  });
}

function expandPeopleSearchTerms(query) {
  const base = String(query || "").trim().toLowerCase();
  if (!base) return [];
  const synonyms = {
    editor: ["editor", "editing", "video", "reel", "photo", "photographer", "designer", "creative", "social media"],
    editing: ["editing", "editor", "video", "reel", "photo", "creative"],
    designer: ["designer", "design", "creative", "branding", "canva", "figma"],
    developer: ["developer", "dev", "frontend", "backend", "fullstack", "web", "app", "software"],
    marketing: ["marketing", "growth", "sales", "social media", "branding"],
    photographer: ["photographer", "photo", "camera", "reel", "video", "editing"]
  };
  const words = base.split(/\s+/).filter(Boolean);
  return [...new Set([
    base,
    ...words,
    ...words.flatMap(word => synonyms[word] || []),
    ...(synonyms[base] || [])
  ])].filter(term => term.length > 1);
}

function sanitizePostQuery(value) {
  return String(value || "")
    .replace(/[^\p{L}\p{N}\s@#&.+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function inferSettingsIntent(query) {
  const text = normalizeSearchText(query);
  if (/password|passcode|otp|login|security|credential/.test(text)) return "security";
  if (/privacy|visibility|block|hide|public|private/.test(text)) return "privacy";
  if (/notification|bell|sound|alert|email/.test(text)) return "notifications";
  if (/saved|bookmark|folder/.test(text)) return "saved_content";
  if (/dark|light|theme|appearance/.test(text)) return "appearance";
  if (/ai|match|recommend|location/.test(text)) return "ai_preferences";
  return text ? "settings_navigation" : "popular_settings";
}

function searchSettingsFeatures(query) {
  const q = sanitizePostQuery(query);
  const terms = normalizeSearchText(q).split(/\s+/).filter(Boolean);
  const scored = SETTINGS_FEATURE_MAP.map(feature => {
    const display = normalizeSearchText(feature.displayName);
    const category = normalizeSearchText(feature.category);
    const description = normalizeSearchText(feature.description);
    const tokens = (feature.keywordTokens || []).map(normalizeSearchText);
    const matchedTokens = tokens.filter(token => terms.some(term => token.includes(term) || term.includes(token)));
    let score = feature.priority || 0;
    if (!q) score += feature.priority || 0;
    if (display === normalizeSearchText(q)) score += 100;
    if (display.includes(normalizeSearchText(q))) score += 60;
    if (category.includes(normalizeSearchText(q))) score += 30;
    score += matchedTokens.length * 24;
    terms.forEach(term => {
      if (display.includes(term)) score += 18;
      if (description.includes(term)) score += 8;
    });
    return {
      ...feature,
      score,
      matchedTokens,
      suggestion: `Open ${feature.displayName} in ${feature.category}`
    };
  })
    .filter(result => !q || result.score > (result.priority || 0))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  return {
    success: true,
    q,
    intent: inferSettingsIntent(q),
    suggestions: scored.slice(0, 4).map(item => item.suggestion),
    results: scored
  };
}

function normalizeSearchText(value) {
  return String(value || "").toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, " ").trim();
}

function editDistance(a, b) {
  const left = normalizeSearchText(a);
  const right = normalizeSearchText(b);
  if (!left || !right) return Math.max(left.length, right.length);
  const dp = Array.from({ length: left.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= right.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      dp[i][j] = left[i - 1] === right[j - 1]
        ? dp[i - 1][j - 1]
        : Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
    }
  }
  return dp[left.length][right.length];
}

function postAuthorFor(db, post) {
  if (post.author || post.authorName || post.freelancerName || post.startupName) {
    return post.author || post.authorName || post.freelancerName || post.startupName;
  }
  const startup = (db.startups || []).find(item => item.id === post.startupId);
  return startup?.name || "ConnectHub member";
}

function canonicalPost(db, post, type) {
  const startup = (db.startups || []).find(item => item.id === post.startupId);
  const title = post.title || post.caption || post.category || "ConnectHub post";
  const content = post.content || post.description || post.caption || "";
  const tags = [
    ...(post.tags || []),
    ...(post.hashtags || []),
    post.category,
    startup?.sector,
    type
  ].filter(Boolean).map(String);
  const id = String(post.id || `${type}-${crypto.createHash("sha1").update(`${title}-${content}`).digest("hex").slice(0, 12)}`);
  return {
    id,
    postId: id,
    type,
    title,
    content,
    mediaUrls: [...(post.mediaUrls || []), ...(post.images || []), post.media].filter(Boolean),
    author: postAuthorFor(db, post),
    authorName: postAuthorFor(db, post),
    authorInitials: initialsFor(postAuthorFor(db, post) || "CH"),
    companyName: post.companyName || startup?.name || post.startupName || "",
    location: [post.city || startup?.city, post.state || startup?.state].filter(Boolean).join(", "),
    tags: [...new Set(tags)],
    createdAt: post.createdAt || post.appliedDate || post.date || new Date(0).toISOString(),
    raw: post
  };
}

function allSearchablePosts(db) {
  return [
    ...(db.profilePosts || []).map(post => canonicalPost(db, post, "profile_post")),
    ...(db.reels || []).map(post => canonicalPost(db, post, "reel")),
    ...(db.jobs || []).map(post => canonicalPost(db, post, "gig")),
    ...(db.freelancerAds || []).map(post => canonicalPost(db, post, "service_ad")),
    ...(db.startupPromotions || []).map(post => canonicalPost(db, post, "startup_post"))
  ];
}

function scorePostSearch(post, query) {
  const q = normalizeSearchText(query);
  if (!q) return 1;
  const terms = q.split(/\s+/).filter(Boolean);
  const title = normalizeSearchText(post.title);
  const content = normalizeSearchText(post.content);
  const tags = normalizeSearchText((post.tags || []).join(" "));
  const author = normalizeSearchText([post.authorName, post.companyName, post.location].join(" "));
  const haystack = [title, content, tags, author].join(" ");
  let score = 0;

  if (title === q) score += 120;
  if (title.startsWith(q)) score += 95;
  if (title.includes(q)) score += 75;
  if (tags.includes(q)) score += 65;
  if (author.includes(q)) score += 45;
  if (content.includes(q)) score += 35;

  terms.forEach(term => {
    if (title.split(/\s+/).some(word => word === term)) score += 24;
    if (title.split(/\s+/).some(word => word.startsWith(term) || term.startsWith(word))) score += 18;
    if (tags.includes(term)) score += 16;
    if (author.includes(term)) score += 10;
    if (content.includes(term)) score += 8;
    if (!haystack.includes(term)) {
      const maxDistance = term.length >= 7 ? 2 : 1;
      const close = haystack.split(/\s+/).some(word => word.length > 3 && editDistance(word, term) <= maxDistance);
      if (close) score += 6;
    }
  });

  return score;
}

function searchPostsInDB(db, { query = "", page = 1, limit = 20 } = {}) {
  const q = sanitizePostQuery(query);
  const safeLimit = Math.max(1, Math.min(50, Number(limit || 20)));
  const safePage = Math.max(1, Number(page || 1));
  const posts = allSearchablePosts(db)
    .map(post => ({ ...post, score: scorePostSearch(post, q) }))
    .filter(post => !q || post.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const start = (safePage - 1) * safeLimit;
  return {
    q,
    page: safePage,
    limit: safeLimit,
    total: posts.length,
    results: posts.slice(start, start + safeLimit)
  };
}

function getExploreCache(key) {
  const cached = exploreCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    exploreCache.delete(key);
    return null;
  }
  return cached.data;
}

function setExploreCache(key, ttlMs, data) {
  exploreCache.set(key, { data, expiresAt: Date.now() + ttlMs });
  if (exploreCache.size > 120) {
    const oldest = exploreCache.keys().next().value;
    if (oldest) exploreCache.delete(oldest);
  }
  return data;
}

async function sendCachedExploreJson(res, key, ttlMs, producer) {
  const cached = getExploreCache(key);
  if (cached) return sendJson(res, 200, { ...cached, cached: true });
  const data = await producer();
  setExploreCache(key, ttlMs, data);
  return sendJson(res, 200, { ...data, cached: false });
}

function roleMatchesExploreCategory(item, category = "all") {
  const type = String(category || "all").toLowerCase();
  if (!type || type === "all") return true;
  const text = normalizeSearchText([item.role, item.roleType, item.title, item.sector, item.companyName, item.type, item.searchText].join(" "));
  const map = {
    startups: ["startup", "founder", "owner", "company"],
    founders: ["founder", "co founder", "startup owner"],
    investors: ["investor", "angel", "vc", "sponsor", "partner"],
    jobs: ["job", "gig", "hiring", "opportunity"],
    events: ["event", "meetup", "webinar"],
    ideas: ["idea", "innovation", "builder"]
  };
  return (map[type] || [type]).some(term => text.includes(term));
}

function compactNumber(value) {
  const n = Number(value || 0);
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function seededIndianPeople() {
  return [
    { name: "Aarav Malhotra", role: "Startup Founder", title: "Founder, FinLedger AI", city: "Bengaluru", state: "Karnataka", sector: "FinTech", companyName: "FinLedger AI", skills: ["AI", "FinTech", "B2B SaaS"], stage: "Seed" },
    { name: "Priya Sharma", role: "Founder", title: "Founder, GreenEats", city: "Hyderabad", state: "Telangana", sector: "Food & Hospitality", companyName: "GreenEats", skills: ["D2C", "Operations", "Marketing"], stage: "Pre-seed" },
    { name: "Rahul Mehta", role: "Startup Owner", title: "Founder, TechNova", city: "Bengaluru", state: "Karnataka", sector: "SaaS & Technology", companyName: "TechNova", skills: ["CRM", "SaaS", "Hiring"], stage: "Seed" },
    { name: "Sunita Rao", role: "Investor", title: "Angel Investor", city: "Bengaluru", state: "Karnataka", sector: "EdTech", companyName: "Rao Angel Network", skills: ["Seed", "EdTech", "Consumer"], stage: "Seed" },
    { name: "Arjun Kapoor", role: "Freelancer", title: "Full-stack Developer", city: "Delhi", state: "Delhi", sector: "SaaS", companyName: "", skills: ["React", "Node.js", "AI"], stage: "" },
    { name: "Meera Nair", role: "Freelancer", title: "Frontend Developer", city: "Bengaluru", state: "Karnataka", sector: "SaaS", companyName: "", skills: ["React", "Tailwind", "UI"], stage: "" },
    { name: "Sneha Patel", role: "Investor", title: "Partner, Bharat Ventures", city: "Mumbai", state: "Maharashtra", sector: "D2C", companyName: "Bharat Ventures", skills: ["D2C", "Series A", "Retail"], stage: "Series A" }
  ];
}

function explorePeoplePool(db, req) {
  const existing = allPeople(db).map(profile => ({
    ...profile,
    roleType: roleBucket(profile.role),
    type: roleBucket(profile.role),
    profileUrl: profileUrlFor(profile, req),
    avatarInitials: profile.avatarInitials || initialsFor(profile.name || "CH"),
    location: [profile.city, profile.state].filter(Boolean).join(", ")
  }));
  const seeded = seededIndianPeople().map(profile => ({
    ...profile,
    email: `${profile.name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@connecthub.in`,
    handle: profileHandle(profile),
    roleType: roleBucket(profile.role),
    type: roleBucket(profile.role),
    avatarInitials: initialsFor(profile.name),
    location: [profile.city, profile.state].filter(Boolean).join(", "),
    profileUrl: profileUrlFor(profile, req)
  }));
  const seen = new Set();
  return [...existing, ...seeded].filter(profile => {
    const key = String(profile.email || profile.handle || profile.name).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scoreExploreEntity(entity, query = "") {
  const q = normalizeSearchText(query);
  if (!q) return Number(entity.trendingScore || entity.score || 1);
  const terms = q.split(/\s+/).filter(Boolean);
  const name = normalizeSearchText(entity.name || entity.title || "");
  const role = normalizeSearchText([entity.role, entity.title, entity.type].join(" "));
  const location = normalizeSearchText([entity.city, entity.state, entity.location].join(" "));
  const skills = normalizeSearchText([...(entity.skills || []), ...(entity.tags || []), entity.sector].join(" "));
  const company = normalizeSearchText(entity.companyName || entity.startupName || "");
  const text = normalizeSearchText([name, role, location, skills, company, entity.description, entity.bio, entity.searchText].join(" "));
  let score = 0;
  if (name === q) score += 120;
  if (name.startsWith(q)) score += 100;
  if (name.includes(q)) score += 80;
  if (company.includes(q)) score += 66;
  if (role.includes(q)) score += 54;
  if (skills.includes(q)) score += 46;
  if (location.includes(q)) score += 38;
  if (text.includes(q)) score += 24;
  terms.forEach(term => {
    if (name.split(/\s+/).some(word => word.startsWith(term) || term.startsWith(word))) score += 18;
    if (skills.includes(term)) score += 12;
    if (role.includes(term)) score += 10;
    if (location.includes(term)) score += 8;
    if (!text.includes(term)) {
      const maxDistance = term.length >= 7 ? 2 : 1;
      if (text.split(/\s+/).some(word => word.length > 3 && editDistance(word, term) <= maxDistance)) score += 6;
    }
  });
  return score;
}

function trendingScoreForStartup(startup, db, index = 0) {
  const views = Array.isArray(startup.views)
    ? startup.views.reduce((sum, item) => sum + Number(item || 0), 0)
    : Number(startup.views || startup.profileViews || 60 + index * 15);
  const connections = (db.connections || []).filter(item => [item.from, item.to].includes(startup.name)).length + Number(startup.connections || 0);
  const posts = (db.jobs || []).filter(job => job.startupId === startup.id).length +
    (db.startupPromotions || []).filter(post => post.startupName === startup.name).length +
    (db.profilePosts || []).filter(post => post.companyName === startup.name || post.authorName === startup.name).length;
  return Math.round((views * 0.3) + (connections * 0.5) + (Math.max(posts, 1) * 18 * 0.2));
}

function exploreTrendingStartups(db, req) {
  const startups = [
    ...(db.startups || []),
    ...seededIndianPeople().filter(item => /founder|startup/i.test(item.role)).map((item, index) => ({
      id: `seed-startup-${index}`,
      name: item.companyName || item.name,
      sector: item.sector,
      stage: item.stage || "Seed",
      city: item.city,
      state: item.state,
      description: `${item.companyName || item.name} is building in ${item.sector} for Indian businesses.`,
      logoInitials: initialsFor(item.companyName || item.name),
      logoColor: "#0f766e",
      views: [42, 58, 63, 82, 99],
      engagement: [4, 6, 7, 9, 12]
    }))
  ];
  return startups.map((startup, index) => ({
    ...startup,
    type: "startup",
    profileUrl: `/profile/${profileHandle({ name: startup.name })}`,
    trendingScore: trendingScoreForStartup(startup, db, index),
    scoreLabel: `${Math.min(98, Math.max(62, trendingScoreForStartup(startup, db, index)))}%`,
    change: Math.max(8, Math.min(74, Number(startup.engagement?.slice(-1)[0] || index + 4) * 5)),
    sparkline: startup.views || [15, 21, 18, 31, 44]
  })).sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 10);
}

function exploreFacets(results) {
  const count = key => results.reduce((map, item) => {
    const values = Array.isArray(item[key]) ? item[key] : [item[key]];
    values.filter(Boolean).forEach(value => {
      const label = String(value);
      map[label] = (map[label] || 0) + 1;
    });
    return map;
  }, {});
  return {
    roles: count("roleType"),
    locations: count("city"),
    skills: results.reduce((map, item) => {
      [...(item.skills || []), ...(item.tags || [])].filter(Boolean).forEach(value => {
        const label = String(value);
        map[label] = (map[label] || 0) + 1;
      });
      return map;
    }, {}),
    companies: count("companyName"),
    sectors: count("sector")
  };
}

function exploreSearchPayload(db, url, req, auth) {
  const q = sanitizePostQuery(url.searchParams.get("q") || "");
  const category = String(url.searchParams.get("type") || url.searchParams.get("category") || "all").toLowerCase();
  const stage = normalizeSearchText(url.searchParams.get("stage") || "");
  const sector = normalizeSearchText(url.searchParams.get("sector") || "");
  const location = normalizeSearchText(url.searchParams.get("location") || "");
  const sort = normalizeSearchText(url.searchParams.get("sort") || "relevance");
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") || 12)));
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const people = explorePeoplePool(db, req);
  const posts = allSearchablePosts(db).map(post => ({
    ...post,
    name: post.title,
    type: post.type,
    role: post.type === "gig" ? "Opportunity" : "Post",
    roleType: post.type,
    city: post.location,
    companyName: post.companyName,
    skills: post.tags || [],
    description: post.content,
    profileUrl: post.type === "gig" ? "/" : `/profile/${profileHandle({ name: post.authorName })}`
  }));
  const events = exploreEventsPayload(db, url, auth).events.map(event => ({
    ...event,
    name: event.title,
    type: "event",
    role: "Event",
    roleType: "event",
    skills: [event.type, event.city].filter(Boolean),
    profileUrl: event.url || "/"
  }));
  let results = [...people, ...posts, ...events]
    .filter(item => roleMatchesExploreCategory(item, category))
    .filter(item => !stage || normalizeSearchText([item.stage, item.description, item.searchText].join(" ")).includes(stage))
    .filter(item => !sector || normalizeSearchText([item.sector, item.skills?.join(" "), item.tags?.join(" "), item.description].join(" ")).includes(sector))
    .filter(item => !location || normalizeSearchText([item.city, item.state, item.location].join(" ")).includes(location))
    .map(item => ({ ...item, score: scoreExploreEntity(item, q) }))
    .filter(item => !q || item.score > 0);
  if (sort.includes("recent")) results.sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0) || b.score - a.score);
  else if (sort.includes("active") || sort.includes("trend")) results.sort((a, b) => Number(b.trendingScore || b.score || 0) - Number(a.trendingScore || a.score || 0));
  else results.sort((a, b) => b.score - a.score || String(a.name || a.title).localeCompare(String(b.name || b.title)));
  const start = (page - 1) * limit;
  const sliced = results.slice(start, start + limit);
  return {
    success: true,
    q,
    page,
    limit,
    total: results.length,
    results: sliced.map(item => ({
      id: item.id || item.handle || profileHandle(item),
      name: item.name || item.title,
      handle: item.handle || profileHandle(item),
      role: item.title || item.role || item.type,
      roleType: item.roleType || item.type,
      location: item.location || [item.city, item.state].filter(Boolean).join(", "),
      city: item.city,
      state: item.state,
      sector: item.sector,
      stage: item.stage,
      companyName: item.companyName || item.startupName || "",
      skills: item.skills || item.tags || [],
      description: item.description || item.bio || item.content || "",
      avatarInitials: item.avatarInitials || initialsFor(item.name || item.title || "CH"),
      avatarPhoto: item.avatarPhoto || null,
      mutualConnections: mutualConnectionCount(db, auth?.name || "", item.name || item.authorName || ""),
      score: item.score,
      matchPercent: Math.min(98, Math.max(52, Math.round((item.score || 1) / Math.max(q ? 1.2 : 1, q ? 1 : 1)))),
      profileUrl: item.profileUrl || profileUrlFor(item, req)
    })),
    facets: exploreFacets(results),
    suggestions: results.length ? [] : [
      `Try ${q || "AI"} founder`,
      `Search ${location || "Bengaluru"} startups`,
      "video editor",
      "seed investors"
    ]
  };
}

function publicSearchTypeGroup(type = "all") {
  const raw = String(type || "all").toLowerCase();
  const aliases = {
    startup: "startups",
    founder: "founders",
    investor: "investors",
    people: "people",
    user: "users",
    job: "jobs",
    opportunity: "opportunities"
  };
  const value = aliases[raw] || raw;
  return {
    value,
    wantsUsers: ["all", "users", "people", "startups", "founders", "investors", "jobs"].includes(value),
    wantsStartups: ["all", "startups", "founders", "jobs"].includes(value),
    wantsGigs: ["all", "jobs", "gigs", "opportunities"].includes(value)
  };
}

function publicSearchStartupPool(db, req) {
  const existing = (db.startups || []).map((startup, index) => ({
    ...startup,
    type: "startup",
    name: startup.name,
    tagline: startup.tagline || startup.description || `${startup.sector || "Startup"} company on ConnectHub`,
    industry: startup.industry || startup.sector || "",
    location: startup.location || [startup.city, startup.state].filter(Boolean).join(", "),
    tags: [...new Set([...(startup.tags || []), startup.sector, startup.stage].filter(Boolean).map(String))],
    logo: startup.logo || startup.logoUrl || startup.logoPhoto?.dataUrl || "",
    logoInitials: startup.logoInitials || initialsFor(startup.name || "CH"),
    foundedYear: startup.foundedYear || "",
    profileUrl: `/profile/${profileHandle({ name: startup.name })}`,
    trendingScore: trendingScoreForStartup(startup, db, index)
  }));
  const seeded = seededIndianPeople()
    .filter(item => /founder|startup/i.test([item.role, item.title].join(" ")))
    .map((item, index) => ({
      id: `seed-startup-${index}`,
      type: "startup",
      name: item.companyName || item.name,
      tagline: `${item.title || "Founder"} building in ${item.sector || "Indian startups"}`,
      description: `${item.companyName || item.name} is an Indian startup signal in ${item.city}.`,
      industry: item.sector || "",
      sector: item.sector || "",
      stage: item.stage || "Seed",
      city: item.city,
      state: item.state,
      location: [item.city, item.state].filter(Boolean).join(", "),
      tags: [item.sector, item.stage, ...(item.skills || [])].filter(Boolean),
      logo: "",
      logoInitials: initialsFor(item.companyName || item.name || "CH"),
      foundedYear: "",
      profileUrl: profileUrlFor({ name: item.companyName || item.name }, req),
      trendingScore: 80 - index
    }));
  const seen = new Set();
  return [...existing, ...seeded].filter(startup => {
    const key = String(startup.id || startup.name || "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapPublicUser(user, db, req, auth) {
  const roleType = user.roleType || roleBucket(user.role);
  return {
    id: user.id || user.handle || profileHandle(user),
    _id: user.id || user.handle || profileHandle(user),
    name: user.name,
    email: user.email || "",
    username: user.username || user.handle || profileHandle(user),
    handle: user.handle || profileHandle(user),
    avatar: user.avatarPhoto?.dataUrl || "",
    avatarPhoto: user.avatarPhoto || null,
    avatarInitials: user.avatarInitials || initialsFor(user.name || "CH"),
    role: user.title || user.role || roleType,
    roleType,
    bio: user.bio || "",
    location: user.location || [user.city, user.state].filter(Boolean).join(", "),
    city: user.city || "",
    state: user.state || "",
    company: user.companyName || "",
    companyName: user.companyName || "",
    skills: user.skills || [],
    isOnline: Boolean(user.isOnline),
    createdAt: user.createdAt || user.joinedAt || user.lastActive || "",
    joinedAt: user.joinedAt || user.createdAt || "",
    mutualConnections: mutualConnectionCount(db, auth?.name || "", user.name || ""),
    profileUrl: user.profileUrl || profileUrlFor(user, req)
  };
}

function mapPublicStartup(startup) {
  return {
    id: startup.id || profileHandle({ name: startup.name }),
    _id: startup.id || profileHandle({ name: startup.name }),
    name: startup.name,
    username: profileHandle({ name: startup.name }),
    handle: profileHandle({ name: startup.name }),
    role: "Startup",
    roleType: "startup",
    tagline: startup.tagline || startup.description || "",
    description: startup.description || startup.tagline || "",
    logo: startup.logo || "",
    logoInitials: startup.logoInitials || initialsFor(startup.name || "CH"),
    industry: startup.industry || startup.sector || "",
    sector: startup.sector || startup.industry || "",
    location: startup.location || [startup.city, startup.state].filter(Boolean).join(", "),
    city: startup.city || "",
    state: startup.state || "",
    stage: startup.stage || "",
    tags: startup.tags || [],
    skills: startup.tags || [],
    foundedYear: startup.foundedYear || "",
    views: startup.views || 0,
    profileUrl: startup.profileUrl || `/profile/${profileHandle({ name: startup.name })}`,
    score: startup.score || startup.trendingScore || 1
  };
}

function publicSearchPayload(db, url, req, auth) {
  const q = sanitizePostQuery(url.searchParams.get("q") || "");
  const { value: type, wantsUsers, wantsStartups, wantsGigs } = publicSearchTypeGroup(url.searchParams.get("type") || "all");
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = Math.max(1, Math.min(30, Number(url.searchParams.get("limit") || 20)));
  const start = (page - 1) * limit;
  const currentName = String(auth?.name || url.searchParams.get("current") || "").trim().toLowerCase();
  const people = wantsUsers
    ? explorePeoplePool(db, req)
      .filter(item => !currentName || String(item.name || "").trim().toLowerCase() !== currentName)
      .filter(item => roleMatchesExploreCategory(item, type === "users" || type === "people" ? "all" : type))
      .map(item => ({ ...item, score: scoreExploreEntity(item, q) }))
      .filter(item => !q || item.score > 0)
      .sort((a, b) => {
        if (!q) return new Date(b.createdAt || b.joinedAt || b.lastActive || 0) - new Date(a.createdAt || a.joinedAt || a.lastActive || 0);
        return b.score - a.score || new Date(b.createdAt || b.joinedAt || 0) - new Date(a.createdAt || a.joinedAt || 0) || String(a.name).localeCompare(String(b.name));
      })
      .slice(start, start + limit)
      .map(item => mapPublicUser(item, db, req, auth))
    : [];
  const startups = wantsStartups
    ? publicSearchStartupPool(db, req)
      .map(item => ({ ...item, score: scoreExploreEntity(item, q) }))
      .filter(item => !q || item.score > 0)
      .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name)))
      .slice(start, start + limit)
      .map(mapPublicStartup)
    : [];
  const postSearch = wantsGigs
    ? searchPostsInDB(db, { query: q, page, limit })
    : { results: [], total: 0 };
  const gigs = wantsGigs
    ? (postSearch.results || []).filter(item => item.type === "gig").map(item => ({
      id: item.id,
      _id: item.id,
      name: item.title,
      title: item.title,
      role: "Opportunity",
      roleType: "job",
      description: item.content,
      companyName: item.companyName || item.authorName || "",
      location: item.location || "",
      skills: item.tags || [],
      tags: item.tags || [],
      profileUrl: "/",
      score: item.score || 1
    }))
    : [];
  return {
    success: true,
    q,
    query: q,
    type,
    mode: q ? "search" : "recent",
    page,
    limit,
    results: q ? [...people, ...startups, ...gigs] : people.slice(0, Math.min(limit, 10)),
    users: people,
    people,
    startups,
    gigs,
    total: people.length + startups.length + gigs.length,
    sources: ["ConnectHub users", "startups", "opportunities"]
  };
}

function publicSearchTrendingPayload(db, req) {
  return {
    success: true,
    startups: publicSearchStartupPool(db, req)
      .sort((a, b) => Number(b.trendingScore || 0) - Number(a.trendingScore || 0))
      .slice(0, 10)
      .map(mapPublicStartup),
    topics: [
      "fintech startups",
      "series A",
      "AI founders",
      "edtech",
      "SaaS India",
      "D2C brands",
      "healthtech",
      "video editors",
      "startup jobs",
      "seed investors"
    ]
  };
}

function exploreSuggestionsPayload(db, url, auth) {
  const user = profileForAuth(auth || {}, db, readJson(USERS_FILE, {})) || {};
  const city = url.searchParams.get("city") || user.city || "Hyderabad";
  const skills = (user.skills || ["AI", "Design", "Marketing"]).slice(0, 4);
  const startups = exploreTrendingStartups(db).slice(0, 3);
  const suggestions = [
    ...skills.map(skill => ({ type: "skill", title: `${skill} opportunities near ${city}`, query: `${skill} ${city}`, reason: "Based on your profile skills" })),
    ...startups.map(startup => ({ type: "startup", title: `${startup.name} is trending`, query: startup.name, reason: `${startup.sector} activity is rising this week` })),
    { type: "network", title: `Founders hiring near ${city}`, query: `founders hiring ${city}`, reason: "Local startup demand signal" }
  ].slice(0, 8);
  return { success: true, city, suggestions };
}

function exploreRecentActivityPayload(db) {
  const people = explorePeoplePool(db).slice(0, 8);
  const startups = exploreTrendingStartups(db).slice(0, 5);
  const jobs = (db.jobs || []).slice(-5).reverse();
  const activity = [
    ...people.map(person => ({ type: "profile", text: `${person.name} updated a profile in ${person.city || "India"}`, timeAgo: "just now", profile: person.handle })),
    ...startups.map(startup => ({ type: "trending", text: `${startup.name} reached ${compactNumber(startup.trendingScore * 120)} trend points`, timeAgo: "2 min ago", query: startup.name })),
    ...jobs.map(job => ({ type: "job", text: `${job.title} is open for applications`, timeAgo: "5 min ago", query: job.title }))
  ].slice(0, 20);
  return { success: true, activity };
}

function exploreEventsPayload(db, url, auth) {
  const city = url?.searchParams?.get("city") || profileForAuth(auth || {}, db, readJson(USERS_FILE, {}))?.city || "Hyderabad";
  const generated = [
    ["Founder Hiring Mixer", "Hybrid", city, 96],
    ["AI SaaS Demo Night", "Virtual", "Bengaluru", 180],
    ["Investor Office Hours", "In-person", "Mumbai", 72],
    ["D2C Growth Circle", "Hybrid", "Delhi", 88],
    ["Women Founders Breakfast", "In-person", "Chennai", 64],
    ["Bharat SaaS Build Week", "Virtual", "India", 220]
  ].map((item, index) => ({
    id: `event-${index + 1}`,
    title: item[0],
    type: item[1],
    city: item[2],
    organizer: "ConnectHub India",
    attendees: item[3],
    date: new Date(Date.now() + (index + 1) * 43200000).toISOString(),
    url: "/"
  }));
  const events = mergeById(db.events || [], generated).sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  return { success: true, city, events };
}

function exploreTrendingTopicsPayload(db) {
  const people = explorePeoplePool(db);
  const terms = [
    ...(db.jobs || []).flatMap(job => job.tags || []),
    ...(db.freelancerAds || []).flatMap(ad => ad.tags || []),
    ...(db.profilePosts || []).flatMap(post => post.hashtags || post.tags || []),
    ...people.flatMap(person => person.skills || []),
    "AIinIndia", "SeedFunding", "FounderHiring", "BharatSaaS", "D2C", "FinTech"
  ].filter(Boolean);
  const counts = terms.reduce((map, raw) => {
    const tag = String(raw).replace(/^#/, "").replace(/\s+/g, "");
    map[tag] = (map[tag] || 0) + 1;
    return map;
  }, {});
  const topics = Object.entries(counts)
    .map(([tag, count], index) => ({
      tag,
      count: count * 120 + 300 + index * 17,
      change: Math.round(10 + count * 8 + index),
      contributors: people.slice(index, index + 3).map(person => ({ name: person.name, avatarInitials: person.avatarInitials || initialsFor(person.name) }))
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
  return { success: true, topics };
}

function exploreTrendingPayload(db, req) {
  const people = explorePeoplePool(db, req);
  const investors = people.filter(person => /investor|angel|vc|sponsor|partner/i.test([person.role, person.title].join(" "))).slice(0, 8);
  const founders = people.filter(person => /founder|startup|owner|developer|designer/i.test([person.role, person.title].join(" "))).slice(0, 10);
  return {
    success: true,
    startups: exploreTrendingStartups(db, req),
    investors,
    founders,
    topics: exploreTrendingTopicsPayload(db).topics
  };
}

function authUserKey(auth) {
  return normalizeEmail(auth?.email) || String(auth?.name || auth?.id || "").trim().toLowerCase();
}

function isAdminAuth(auth) {
  if (!auth) return false;
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  const authEmail = normalizeEmail(auth.email);
  return auth.role === "admin" || Boolean(adminEmail && authEmail === adminEmail);
}

function findRegisteredUserByIdentifier(users, identifier) {
  const raw = String(identifier || "").trim();
  const needle = raw.replace(/^@/, "").toLowerCase();
  if (!needle) return null;

  for (const [email, entry] of Object.entries(users || {})) {
    const profile = entry?.profile || {};
    const identifiers = [
      email,
      profile.email,
      profile.username,
      profile.handle,
      profile.name,
      profileHandle(profile)
    ]
      .filter(Boolean)
      .map(value => String(value).trim().replace(/^@/, "").toLowerCase());

    if (identifiers.includes(needle)) {
      return { email, entry, profile };
    }
  }
  return null;
}

function earliestKnownSessionForUser(db, entry, profile, email) {
  const keys = new Set([
    authUserKey({ email, name: profile?.name, id: profile?.id }),
    authUserKey({ name: profile?.name }),
    authUserKey({ id: profile?.username || profile?.handle || profileHandle(profile || {}) })
  ].filter(Boolean));

  const sessions = [];
  keys.forEach(key => {
    const active = db.userSettingsByUser?.[key]?.activeSessions;
    if (Array.isArray(active)) sessions.push(...active);
  });
  if (Array.isArray(profile?.activeSessions)) sessions.push(...profile.activeSessions);
  if (Array.isArray(entry?.activeSessions)) sessions.push(...entry.activeSessions);

  return sessions
    .filter(item => item?.ip || item?.ipAddress)
    .sort((a, b) => {
      const aTime = new Date(a.createdAt || a.lastActive || 0).getTime() || 0;
      const bTime = new Date(b.createdAt || b.lastActive || 0).getTime() || 0;
      return aTime - bTime;
    })[0] || null;
}

function appendAuditLog(entry) {
  const logs = readJson(AUDIT_FILE, []);
  const record = {
    id: `audit-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    createdAt: new Date().toISOString(),
    ...entry
  };
  logs.push(record);
  writeJson(AUDIT_FILE, logs.slice(-5000));
  return record;
}

function publicRegistrationLookupUser(profile, email) {
  return {
    name: profile?.name || "",
    username: profile?.username || profile?.handle || profileHandle(profile || {}),
    role: profile?.role || "",
    email
  };
}

function savedPostsFor(db, users, auth) {
  const key = authUserKey(auth);
  const profileSaved = normalizeEmail(auth?.email) && users[normalizeEmail(auth.email)]?.profile?.savedPosts;
  return [
    ...(db.savedPostsByUser?.[key] || []),
    ...(Array.isArray(profileSaved) ? profileSaved : [])
  ]
    .filter(item => item && item.postId)
    .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0))
    .filter((item, index, arr) => arr.findIndex(other => other.postId === item.postId) === index);
}

function persistSavedPosts(db, users, auth, savedPosts) {
  const key = authUserKey(auth);
  db.savedPostsByUser = db.savedPostsByUser || {};
  db.savedPostsByUser[key] = savedPosts;
  const email = normalizeEmail(auth?.email);
  if (email && users[email]?.profile) users[email].profile.savedPosts = savedPosts;
}

function profileForAuth(auth, db = readJson(DB_FILE, INITIAL_DB), users = readJson(USERS_FILE, {})) {
  const email = normalizeEmail(auth?.email);
  const key = authUserKey(auth);
  const base = email && users[email]?.profile
    ? users[email].profile
    : email && DEMO_USERS[email]
      ? { ...DEMO_USERS[email], email }
      : null;
  if (!base) return null;
  const profilePatch = db.userProfilePatchesByUser?.[key] || {};
  const settingsPatch = db.userSettingsByUser?.[key] || {};
  return { ...base, ...profilePatch, ...settingsPatch, email: email || base.email };
}

function persistUserProfile(auth, patch = {}) {
  const db = readJson(DB_FILE, INITIAL_DB);
  const users = readJson(USERS_FILE, {});
  const email = normalizeEmail(auth?.email || patch.email);
  const key = authUserKey(auth || patch);
  const cleanPatch = { ...patch };
  delete cleanPatch.password;
  delete cleanPatch.passwordHash;
  delete cleanPatch.passwordSalt;
  if (cleanPatch.skills && typeof cleanPatch.skills === "string") {
    cleanPatch.skills = cleanPatch.skills.split(",").map(item => item.trim()).filter(Boolean);
  }
  if (email && users[email]?.profile) {
    users[email].profile = { ...users[email].profile, ...cleanPatch, email };
  } else if (key) {
    db.userProfilePatchesByUser = db.userProfilePatchesByUser || {};
    db.userProfilePatchesByUser[key] = { ...(db.userProfilePatchesByUser[key] || {}), ...cleanPatch, email };
  }
  writeJson(DB_FILE, db);
  writeJson(USERS_FILE, users);
  return profileForAuth({ ...auth, email }, db, users);
}

function persistUserSettings(auth, patch = {}) {
  const db = readJson(DB_FILE, INITIAL_DB);
  const users = readJson(USERS_FILE, {});
  const key = authUserKey(auth);
  const email = normalizeEmail(auth?.email);
  db.userSettingsByUser = db.userSettingsByUser || {};
  db.userSettingsByUser[key] = { ...(db.userSettingsByUser[key] || {}), ...patch };
  if (email && users[email]?.profile) users[email].profile = { ...users[email].profile, ...patch };
  writeJson(DB_FILE, db);
  writeJson(USERS_FILE, users);
  return db.userSettingsByUser[key];
}

function devOtpAllowed() {
  return process.env.ALLOW_DEV_OTP === "true" || process.env.NODE_ENV !== "production";
}

function notificationMatchesTab(note, tab) {
  const type = String(note.type || "").toLowerCase();
  if (tab === "messages") return ["message", "new_message", "direct_message"].includes(type);
  if (tab === "network") return ["follow", "connection_request", "connection_accepted", "profile_view", "connection"].includes(type);
  return true;
}

function createNotification(db, to, type, text, extra = {}) {
  const note = {
    id: extra.id || `not-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    to,
    type,
    text,
    read: false,
    createdAt: new Date().toISOString(),
    ...extra
  };
  db.notifications = db.notifications || [];
  if (!db.notifications.some(item => item.id === note.id)) db.notifications.push(note);
  if (socketIO && to) {
    const room = `user:${String(to).slice(0, 80)}`;
    socketIO.to(room).emit("notification:new", note);
    socketIO.to(room).emit("notifications:update", { notification: note });
  }
  return note;
}

function indiaTimePayload() {
  const now = new Date();
  return {
    iso: now.toISOString(),
    timezone: INDIA_CONTEXT.timezone,
    label: new Intl.DateTimeFormat("en-IN", {
      timeZone: INDIA_CONTEXT.timezone,
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(now)
  };
}

function buildIndiaContext(auth, req) {
  const db = publicDB();
  const profile = auth ? profileForAuth(auth, db) : null;
  const city = profile?.city || profile?.location?.city || "India";
  const role = profile?.role || auth?.role || "guest";
  return {
    ...INDIA_CONTEXT,
    currentCity: city,
    currentState: profile?.state || profile?.location?.state || "",
    currentRole: role,
    currentRoleLabel: INDIA_CONTEXT.roleLabels[role] || INDIA_CONTEXT.roleLabels[String(role).toLowerCase()] || "Member",
    serverTime: indiaTimePayload(),
    clientIp: getRealIP(req)
  };
}

function realtimeSummary() {
  const db = publicDB();
  return {
    success: true,
    realtime: {
      socketAvailable: Boolean(Server && socketIO),
      onlineCount: onlineUsers.size,
      onlineUsers: Array.from(onlineUsers.keys()).slice(0, 30),
      startedAt: serverStartedAt.toISOString(),
      serverTime: indiaTimePayload()
    },
    counts: {
      profiles: allPeople(db).length,
      startups: (db.startups || []).length,
      gigs: (db.jobs || []).length,
      messages: (db.messages || []).length,
      notifications: (db.notifications || []).length,
      connections: (db.connections || []).length
    }
  };
}

function emitRealtime(event, payload = {}, rooms = []) {
  if (!socketIO) return;
  const enriched = {
    ...payload,
    event,
    emittedAt: new Date().toISOString(),
    indiaTime: indiaTimePayload()
  };
  const targets = (Array.isArray(rooms) ? rooms : [rooms])
    .map(room => String(room || "").trim())
    .filter(room => room && !/(undefined|null)$/i.test(room));
  if (!targets.length) socketIO.emit(event, enriched);
  else targets.forEach(room => socketIO.to(room).emit(event, enriched));
  socketIO.emit("realtime:status", realtimeSummary().realtime);
}

function emitStateUpdate(reason, extra = {}) {
  emitRealtime("state:updated", {
    reason,
    summary: realtimeSummary().counts,
    ...extra
  });
}

function extractMessageContent(message = {}) {
  const candidates = [
    message.content,
    message.text,
    message.body,
    message.message,
    message.caption,
    message.payload
  ];
  for (const candidate of candidates) {
    if (candidate == null) continue;
    if (typeof candidate === "object") {
      const nested = extractMessageContent(candidate);
      if (nested) return nested;
      continue;
    }
    const text = String(candidate).trim();
    if (text) return text;
  }
  return "";
}

function normalizeStoredMessage(message = {}, db = publicDB(), req, auth) {
  const people = allPeople(db);
  const text = extractMessageContent(message).slice(0, 2000);
  const fromName = String(message.from || message.senderName || message.sender?.name || message.sender?.username || message.sender || "").trim();
  const toName = String(message.to || message.receiverName || message.receiver?.name || message.receiver?.username || message.receiver || "").trim();
  const profileFor = name => people.find(profile => profile.name === name || profileHandle(profile) === name) || {
    name,
    handle: profileHandle({ name }),
    avatarInitials: initialsFor(name || "CH")
  };
  const senderProfile = profileFor(fromName);
  const receiverProfile = profileFor(toName);
  return {
    ...message,
    id: String(message.id || message._id || `msg-${Date.now()}`).slice(0, 100),
    from: fromName,
    to: toName,
    senderName: fromName,
    receiverName: toName,
    text,
    content: text,
    kind: String(message.kind || message.type || "text").slice(0, 30),
    type: String(message.type || message.kind || "text").slice(0, 30),
    mediaUrl: message.mediaUrl || message.attachment?.dataUrl || null,
    attachment: message.attachment || null,
    read: Boolean(message.read || message.status === "seen"),
    status: message.status || (message.read ? "seen" : "sent"),
    deliveredAt: message.deliveredAt || null,
    seenAt: message.seenAt || message.readAt || null,
    reactions: Array.isArray(message.reactions) ? message.reactions : [],
    sender: mapPublicUser(senderProfile, db, req, auth),
    receiver: mapPublicUser(receiverProfile, db, req, auth),
    createdAt: message.createdAt || new Date().toISOString()
  };
}

function normalizePostList(value) {
  return Array.isArray(value) ? value : [];
}

function postCount(value) {
  if (Array.isArray(value)) return value.length;
  const count = Number(value || 0);
  return Number.isFinite(count) ? count : 0;
}

function extractPostContent(body = {}) {
  return String(body.content || body.text || body.description || body.caption || "").trim().slice(0, 3000);
}

function extractHashtags(content = "", provided = []) {
  const tags = [
    ...normalizePostList(provided),
    ...(String(content).match(/#[\p{L}\p{N}_]+/gu) || []).map(tag => tag.slice(1))
  ];
  return [...new Set(tags.map(tag => String(tag || "").replace(/^#/, "").trim().toLowerCase()).filter(Boolean))].slice(0, 24);
}

function postOwnerName(post = {}) {
  return String(post.authorName || post.author || post.name || post.companyName || "ConnectHub member").trim();
}

function normalizePostRecord(db, post = {}, auth = {}, req) {
  const authorName = postOwnerName(post);
  const people = allPeople(db);
  const authorProfile = people.find(profile =>
    profile.name === authorName ||
    profile.email === post.authorEmail ||
    profileHandle(profile) === post.authorHandle
  ) || { name: authorName, role: post.role || "member", title: post.title || "", avatarInitials: initialsFor(authorName || "CH") };
  const reactions = normalizePostList(post.reactions);
  const legacyLikes = normalizePostList(post.likes).map(user => ({ user, emoji: "like" }));
  const allReactions = reactions.length ? reactions : legacyLikes;
  const actor = auth?.name || "";
  const comments = normalizePostList(post.comments).map(comment => ({
    id: comment.id || `comment-${Date.now()}`,
    user: comment.user || comment.author || "Member",
    author: comment.author || comment.user || "Member",
    text: String(comment.text || comment.content || "").slice(0, 1000),
    content: String(comment.content || comment.text || "").slice(0, 1000),
    createdAt: comment.createdAt || new Date().toISOString(),
    replies: normalizePostList(comment.replies)
  }));
  const shares = normalizePostList(post.shares);
  const content = String(post.content || post.text || post.description || post.caption || "").slice(0, 3000);
  const title = post.title || (content ? content.slice(0, 64) : "ConnectHub post");
  const mediaUrls = [
    ...normalizePostList(post.mediaUrls),
    ...normalizePostList(post.images),
    post.mediaUrl,
    post.media
  ].filter(Boolean);

  return {
    ...post,
    id: String(post.id || post._id || `post-${Date.now()}`).slice(0, 100),
    postId: String(post.id || post._id || "").slice(0, 100),
    author: authorName,
    authorName,
    authorEmail: post.authorEmail || authorProfile.email || "",
    authorHandle: post.authorHandle || profileHandle(authorProfile),
    name: authorName,
    role: post.role || authorProfile.title || roleBucket(authorProfile.role),
    title,
    text: content,
    content,
    city: post.city || authorProfile.city || "",
    state: post.state || authorProfile.state || "",
    initials: post.initials || post.authorInitials || authorProfile.avatarInitials || initialsFor(authorName || "CH"),
    avatarPhoto: post.avatarPhoto || authorProfile.avatarPhoto || null,
    tags: extractHashtags(content, post.hashtags || post.tags),
    hashtags: extractHashtags(content, post.hashtags || post.tags),
    mediaUrls,
    images: mediaUrls,
    reactions: allReactions,
    likes: postCount(post.likes) || allReactions.length,
    reactionCount: allReactions.length,
    myReaction: allReactions.find(reaction => String(reaction.user || reaction.name || "") === String(actor))?.emoji || null,
    comments,
    commentCount: postCount(post.commentCount) || comments.length,
    shares,
    shareCount: postCount(post.shareCount) || shares.length,
    saves: normalizePostList(post.saves),
    viewCount: postCount(post.viewCount),
    visibility: post.visibility || "public",
    isPublished: post.isPublished !== false,
    sharedBy: normalizePostList(post.sharedBy),
    createdAt: post.createdAt || new Date().toISOString(),
    updatedAt: post.updatedAt || post.createdAt || new Date().toISOString()
  };
}

function publicFeedPosts(db, auth, req, { page = 1, limit = 10 } = {}) {
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.max(1, Math.min(30, Number(limit || 10)));
  const allPosts = (db.profilePosts || [])
    .filter(post => !post.isDeleted)
    .map(post => normalizePostRecord(db, post, auth, req))
    .sort((a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const start = (safePage - 1) * safeLimit;
  return {
    posts: allPosts.slice(start, start + safeLimit),
    total: allPosts.length,
    page: safePage,
    limit: safeLimit,
    hasMore: start + safeLimit < allPosts.length
  };
}

function findProfilePost(db, id) {
  return (db.profilePosts || []).find(post => String(post.id || post._id) === String(id));
}

function createOtp(email) {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashPassword(otp, salt).hash;
  const otps = readJson(OTP_FILE, {});
  otps[email] = {
    hash,
    salt,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0
  };
  writeJson(OTP_FILE, otps);
  return otp;
}

function verifyOtp(email, otp) {
  const otps = readJson(OTP_FILE, {});
  const entry = otps[email];
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    delete otps[email];
    writeJson(OTP_FILE, otps);
    return false;
  }
  entry.attempts = (entry.attempts || 0) + 1;
  if (entry.attempts > 5) {
    delete otps[email];
    writeJson(OTP_FILE, otps);
    return false;
  }
  const ok = hashPassword(otp, entry.salt).hash === entry.hash;
  if (ok) delete otps[email];
  else otps[email] = entry;
  writeJson(OTP_FILE, otps);
  return ok;
}

function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function razorpayRequest(endpoint, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const req = https.request({
      hostname: "api.razorpay.com",
      path: endpoint,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Authorization: `Basic ${auth}`
      }
    }, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        const parsed = data ? JSON.parse(data) : {};
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
        else reject(new Error(parsed.error?.description || "Razorpay request failed."));
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function verifyRazorpaySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");
  return expected === razorpay_signature;
}

function createUserProfile({ name, role, title, additionalInfo = {} }) {
  const initials = initialsFor(name);
  const profile = {
    name,
    role,
    title,
    username: profileHandle({ name }),
    avatarInitials: initials,
    avatarPhoto: additionalInfo.avatarPhoto || null,
    city: additionalInfo.city || "",
    state: additionalInfo.state || "",
    location: additionalInfo.location || null,
    bio: additionalInfo.bio || "",
    skills: additionalInfo.skills || [],
    isOnline: true,
    createdAt: new Date().toISOString(),
    joinedAt: new Date().toISOString()
  };

  if (role === "freelancer") {
    profile.earnings = "Rs 0";
    profile.activeContracts = 0;
  } else if (role === "startup_admin") {
    const db = readJson(DB_FILE, INITIAL_DB);
    const startupId = `st-${Date.now()}`;
    const startup = {
      id: startupId,
      name: additionalInfo.companyName || `${name}'s Business`,
      sector: additionalInfo.sector || "Commerce & Retail",
      stage: "Pre-seed",
      valuation: "Rs 10 Lakh",
      raised: "Rs 0",
      target: additionalInfo.targetFunding || "Rs 5 Lakh",
      description: "Startup looking for freelancers, partners, and sponsors.",
      city: additionalInfo.city || "",
      state: additionalInfo.state || "",
      logoColor: "#0f766e",
      logoInitials: initials,
      views: [10, 15, 20, 22, 28, 35, 40],
      engagement: [0, 1, 1, 2, 2, 3, 4]
    };
    db.startups.push(startup);
    writeJson(DB_FILE, db);
    profile.startupId = startupId;
    profile.companyName = startup.name;
    profile.title = `Founder, ${startup.name}`;
  } else if (role === "investor") {
    profile.fundsCommitted = "Rs 0";
    profile.portfolioSize = 0;
    profile.title = additionalInfo.firmName ? `Partner, ${additionalInfo.firmName}` : "Angel Sponsor";
  }

  return profile;
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const requestedPath = urlPath === "/"
    ? "/index.html"
    : /^\/chat\/?$/.test(urlPath)
      ? "/chat.html"
    : /^\/auth-portal\/?$/.test(urlPath)
      ? "/auth-portal.html"
    : /^\/full-app\/?$/.test(urlPath)
      ? "/connecthub-full.html"
    : /^\/feed\/?$/.test(urlPath)
      ? "/dashboard-freelancer.html"
    : /^\/settings\/?$/.test(urlPath)
      ? "/dashboard-freelancer.html"
    : /^\/network\/requests\/?$/.test(urlPath)
      ? "/network-requests.html"
    : /^\/profile\/edit\/?$/.test(urlPath)
      ? "/edit-profile.html"
    : /^\/profile\/[^/]+\/?$/.test(urlPath)
      ? "/profile.html"
      : /^\/dashboard\/aihub\/?$/.test(urlPath)
        ? "/frontend/aihub/aihub.html"
        : urlPath;
  const filePath = path.normalize(path.join(ROOT_DIR, requestedPath));

  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, securityHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      fs.readFile(path.join(ROOT_DIR, "index.html"), (fallbackError, fallbackContent) => {
        if (fallbackError) {
          res.writeHead(404, securityHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
          res.end("Not found");
          return;
        }
        res.writeHead(200, securityHeaders({ "Content-Type": "text/html; charset=utf-8" }));
        res.end(fallbackContent);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml"
    };
    res.writeHead(200, securityHeaders({ "Content-Type": contentTypes[ext] || "application/octet-stream" }));
    res.end(content);
  });
}

async function handleApi(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = url.pathname;
  if (isRateLimited(req, route)) {
    return sendJson(res, 429, { success: false, message: "Too many requests. Please try again shortly." });
  }
  const auth = authFromRequest(req);
  if (auth) touchActiveSession(auth, req);

  if (route === "/api/health" || route === "/health") return sendJson(res, 200, { ok: true, status: "healthy" });
  if (route === "/api/realtime/status" && req.method === "GET") {
    return sendJson(res, 200, {
      ...realtimeSummary(),
      context: buildIndiaContext(auth, req)
    });
  }
  if (route === "/api/india/context" && req.method === "GET") {
    return sendJson(res, 200, {
      success: true,
      context: buildIndiaContext(auth, req)
    });
  }
  if (handleAiHubApi && await handleAiHubApi(req, res, { route, readBody, sendJson, auth, publicDB })) return;
  if (handleAiApi && await handleAiApi(req, res, { route, readBody, sendJson, auth, publicDB })) return;

  if (route === "/api/nearby" && req.method === "GET") {
    const lat = Number(url.searchParams.get("lat") || 17.385);
    const lng = Number(url.searchParams.get("lng") || 78.4867);
    const radius = Number(url.searchParams.get("radius") || 10);
    const city = url.searchParams.get("city") || "Hyderabad";
    const data = aiService
      ? await aiService.nearbyOpportunities({ lat, lng, city, radius_km: radius, profiles: allPeople(publicDB()) })
      : { results: [] };
    const businesses = (data.results || []).filter(item => Number(item.distanceKm || 0) <= radius);
    return sendJson(res, 200, { success: true, businesses, userCity: data.userCity || city, count: businesses.length });
  }

  if (route === "/api/auth/logout" && req.method === "POST") return sendJson(res, 200, { success: true });
  if (route === "/api/users/me" && req.method === "GET") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Not signed in." });
    const profile = profileForAuth(auth);
    return sendJson(res, profile ? 200 : 401, profile ? { success: true, user: profile } : { success: false, message: "Not signed in." });
  }
  if (route === "/api/users/me" && req.method === "PUT") {
    const body = await readBody(req);
    if (!auth && !body.email) return sendJson(res, 401, { success: false, message: "Not signed in." });
    const profile = persistUserProfile(auth || { email: body.email }, body);
    if (!profile) return sendJson(res, 404, { success: false, message: "Profile account not found." });
    return sendJson(res, 200, { success: true, user: profile });
  }
  if (route === "/api/users/profile" && (req.method === "PUT" || req.method === "POST")) {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const body = await readBody(req);
    const allowed = ["name", "title", "bio", "city", "state", "phone", "whatsapp", "contactEmail", "website", "portfolio", "skills", "avatarPhoto", "companyName", "firmName", "linkedinUrl", "githubUrl", "instagramUrl"];
    const patch = {};
    allowed.forEach(key => {
      if (body[key] !== undefined) patch[key] = body[key];
    });
    if (patch.name && String(patch.name).trim().length < 2) return sendJson(res, 400, { success: false, message: "Name must be at least 2 characters." });
    if (patch.bio && String(patch.bio).length > 220) patch.bio = String(patch.bio).slice(0, 220);
    const profile = persistUserProfile(auth, patch);
    emitRealtime("profile:updated", { profile }, [`user:${profile?.name}`, `user_${profile?.name}`]);
    emitStateUpdate("profile-updated", { profile: { name: profile?.name, role: profile?.role, city: profile?.city } });
    return sendJson(res, 200, { success: true, user: profile });
  }
  if (route === "/api/profile/photo" && req.method === "POST") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const body = await readBody(req);
    const dataUrl = body.dataUrl || body.photo?.dataUrl || "";
    const photoType = body.type || "profile";
    if (!dataUrl || !String(dataUrl).startsWith("data:image/")) return sendJson(res, 400, { success: false, message: "Send a base64 image dataUrl." });
    if (String(dataUrl).length > 2_500_000) return sendJson(res, 400, { success: false, message: "Image is too large. Use an image under 2 MB." });
    const field = photoType === "cover" ? "coverPhoto" : "avatarPhoto";
    const patch = {};
    if (field === "coverPhoto") patch.coverPhoto = { dataUrl };
    else patch.avatarPhoto = { dataUrl };
    const profile = persistUserProfile(auth, patch);
    emitRealtime("profile:updated", { profile }, [`user:${profile?.name}`, `user_${profile?.name}`]);
    return sendJson(res, 200, { success: true, url: dataUrl, user: profile });
  }

  if (route === "/api/users/avatar" && req.method === "POST") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const body = await readBody(req);
    const avatarPhoto = body.avatarPhoto || (body.dataUrl ? { dataUrl: body.dataUrl } : null);
    if (!avatarPhoto?.dataUrl || !String(avatarPhoto.dataUrl).startsWith("data:image/")) return sendJson(res, 400, { success: false, message: "Send a base64 image dataUrl." });
    if (String(avatarPhoto.dataUrl).length > 2_500_000) return sendJson(res, 400, { success: false, message: "Image is too large. Use an image under 2 MB." });
    const profile = persistUserProfile(auth, { avatarPhoto });
    emitRealtime("profile:updated", { profile }, [`user:${profile?.name}`, `user_${profile?.name}`]);
    emitStateUpdate("avatar-updated", { profile: { name: profile?.name, role: profile?.role, city: profile?.city } });
    return sendJson(res, 200, { success: true, url: avatarPhoto.dataUrl, user: profile });
  }
  if (route === "/api/users/settings" && (req.method === "PUT" || req.method === "PATCH")) {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const body = await readBody(req);
    const allowed = [
      "profileVisibility", "whoCanMessage", "whoCanSeeConnections", "twoFactorAuth",
      "connectionRequests", "messages", "postLikes", "gigApplications", "platformAnnouncements", "emailNotifications",
      "theme", "language", "fontSize", "preferredLanguage", "fontSizePreference", "accountPrivacy", "messagingPrivacy",
      "blockedUsers", "mutedUsers", "deactivated"
    ];
    const patch = {};
    allowed.forEach(key => {
      if (body[key] !== undefined) patch[key] = body[key];
    });
    const settings = persistUserSettings(auth, patch);
    return sendJson(res, 200, { success: true, settings });
  }
  if ((route === "/api/users/search" || route === "/api/people/search") && req.method === "GET") {
    const db = publicDB();
    const results = searchPeople(db, {
      query: url.searchParams.get("q") || "",
      role: url.searchParams.get("role") || "",
      location: url.searchParams.get("location") || "",
      skills: url.searchParams.get("skills") || "",
      company: url.searchParams.get("company") || "",
      currentName: auth?.name || ""
    }, req);
    return sendJson(res, 200, { success: true, results: results.slice(0, 30) });
  }
  if (route === "/api/explore/search" && req.method === "GET") {
    const db = publicDB();
    if (String(url.searchParams.get("q") || "").trim()) {
      return sendJson(res, 200, { ...exploreSearchPayload(db, url, req, auth), cached: false });
    }
    const cacheKey = `explore-search:${url.searchParams.toString()}:${auth?.email || auth?.name || "guest"}`;
    return sendCachedExploreJson(res, cacheKey, 90 * 1000, async () => exploreSearchPayload(db, url, req, auth));
  }
  if (route === "/api/explore/trending" && req.method === "GET") {
    const db = publicDB();
    return sendCachedExploreJson(res, "explore-trending", 5 * 60 * 1000, async () => exploreTrendingPayload(db, req));
  }
  if (route === "/api/explore/filters/meta" && req.method === "GET") {
    return sendJson(res, 200, {
      success: true,
      categories: ["All", "Startups", "Founders", "Investors", "Jobs", "Events"],
      stages: ["All Stages", "Idea", "Pre-seed", "Seed", "Series A", "Series B", "Growth"],
      sectors: ["All Sectors", "FinTech", "HealthTech", "EdTech", "SaaS", "D2C", "Deeptech", "AgriTech", "Cleantech"],
      sortOptions: ["Relevance", "Most Recent", "Top Funded", "Trending"],
      accent: "#00E6B4"
    });
  }
  if (route === "/api/explore/suggestions" && req.method === "GET") {
    const db = publicDB();
    const cacheKey = `explore-suggestions:${url.searchParams.toString()}:${auth?.email || auth?.name || "guest"}`;
    return sendCachedExploreJson(res, cacheKey, 3 * 60 * 1000, async () => exploreSuggestionsPayload(db, url, auth));
  }
  if (route === "/api/explore/recent-activity" && req.method === "GET") {
    const db = publicDB();
    return sendCachedExploreJson(res, "explore-activity", 45 * 1000, async () => exploreRecentActivityPayload(db));
  }
  if (route === "/api/explore/events" && req.method === "GET") {
    const db = publicDB();
    const cacheKey = `explore-events:${url.searchParams.toString()}:${auth?.email || auth?.name || "guest"}`;
    return sendCachedExploreJson(res, cacheKey, 5 * 60 * 1000, async () => exploreEventsPayload(db, url, auth));
  }
  if (route === "/api/explore/topics/trending" && req.method === "GET") {
    const db = publicDB();
    return sendCachedExploreJson(res, "explore-topics", 5 * 60 * 1000, async () => exploreTrendingTopicsPayload(db));
  }
  if (route === "/api/explore/search/voice" && req.method === "POST") {
    const body = await readBody(req);
    const query = sanitizePostQuery(body.transcript || body.q || "");
    return sendJson(res, 200, {
      success: true,
      query,
      language: body.language || "auto",
      suggestions: query ? [`${query} near me`, `${query} founders`, `${query} investors`] : ["startups near me", "video editor", "seed investors"]
    });
  }
  if ((route === "/api/v1/posts/search" || route === "/api/posts/search") && req.method === "GET") {
    const db = publicDB();
    const data = searchPostsInDB(db, {
      query: url.searchParams.get("q") || "",
      page: url.searchParams.get("page") || 1,
      limit: url.searchParams.get("limit") || 20
    });
    return sendJson(res, 200, { success: true, ...data });
  }
  if ((route === "/api/v1/settings/search" || route === "/api/settings/search") && req.method === "GET") {
    return sendJson(res, 200, searchSettingsFeatures(url.searchParams.get("q") || ""));
  }
  if ((route.startsWith("/api/v1/posts/save/") || route.startsWith("/api/posts/save/")) && req.method === "POST") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const postId = decodeURIComponent(route.replace(/^\/api(?:\/v1)?\/posts\/save\//, ""));
    const db = readJson(DB_FILE, INITIAL_DB);
    const users = readJson(USERS_FILE, {});
    const postsById = new Map(allSearchablePosts(db).map(post => [post.id, post]));
    if (!postsById.has(postId)) return sendJson(res, 404, { success: false, message: "Post not found." });
    const existing = savedPostsFor(db, users, auth);
    const wasSaved = existing.some(item => item.postId === postId);
    const nextSaved = wasSaved
      ? existing.filter(item => item.postId !== postId)
      : [{ postId, savedAt: new Date().toISOString() }, ...existing];
    persistSavedPosts(db, users, auth, nextSaved);
    writeJson(DB_FILE, db);
    writeJson(USERS_FILE, users);
    return sendJson(res, 200, {
      success: true,
      saved: !wasSaved,
      postId,
      savedCount: nextSaved.length,
      savedPosts: nextSaved.map(item => ({ ...item, post: postsById.get(item.postId) })).filter(item => item.post)
    });
  }
  if ((route === "/api/v1/users/saved" || route === "/api/users/saved") && req.method === "GET") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const db = readJson(DB_FILE, INITIAL_DB);
    const users = readJson(USERS_FILE, {});
    const postsById = new Map(allSearchablePosts(db).map(post => [post.id, post]));
    const saved = savedPostsFor(db, users, auth);
    const populated = saved
      .map(item => ({ ...item, post: postsById.get(item.postId) }))
      .filter(item => item.post);
    if (populated.length !== saved.length) {
      persistSavedPosts(db, users, auth, populated.map(({ post, ...item }) => item));
      writeJson(DB_FILE, db);
      writeJson(USERS_FILE, users);
    }
    return sendJson(res, 200, { success: true, savedPosts: populated });
  }
  if ((route.startsWith("/api/v1/users/saved/") || route.startsWith("/api/users/saved/")) && req.method === "POST") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const postId = decodeURIComponent(route.replace(/^\/api(?:\/v1)?\/users\/saved\//, ""));
    const db = readJson(DB_FILE, INITIAL_DB);
    const users = readJson(USERS_FILE, {});
    const postsById = new Map(allSearchablePosts(db).map(post => [post.id, post]));
    if (!postsById.has(postId)) return sendJson(res, 404, { success: false, message: "Post not found." });

    const existing = savedPostsFor(db, users, auth);
    const wasSaved = existing.some(item => item.postId === postId);
    const nextSaved = wasSaved
      ? existing.filter(item => item.postId !== postId)
      : [{ postId, savedAt: new Date().toISOString() }, ...existing];

    persistSavedPosts(db, users, auth, nextSaved);
    writeJson(DB_FILE, db);
    writeJson(USERS_FILE, users);
    return sendJson(res, 200, {
      success: true,
      saved: !wasSaved,
      postId,
      savedCount: nextSaved.length,
      savedPosts: nextSaved.map(item => ({ ...item, post: postsById.get(item.postId) })).filter(item => item.post)
    });
  }
  if (route.startsWith("/api/users/") && req.method === "GET") {
    const id = decodeURIComponent(route.replace("/api/users/", ""));
    const profile = allPeople(publicDB()).find(item => item.handle === id || item.id === id || String(item.name || "").toLowerCase() === id.toLowerCase());
    return sendJson(res, profile ? 200 : 404, profile ? { success: true, user: profile } : { success: false, message: "User not found." });
  }

  if (route === "/api/explore" && req.method === "GET") {
    const db = publicDB();
    const type = String(url.searchParams.get("type") || "").toLowerCase();
    const city = String(url.searchParams.get("city") || "").toLowerCase();
    const sector = String(url.searchParams.get("sector") || "").toLowerCase();
    let results = allPeople(db);
    if (type) results = results.filter(item => String(item.role || "").toLowerCase().includes(type));
    if (city) results = results.filter(item => String(item.city || item.location || "").toLowerCase().includes(city));
    if (sector) results = results.filter(item => String(item.sector || item.title || "").toLowerCase().includes(sector));
    return sendJson(res, 200, { success: true, results });
  }

  if (route === "/api/feed" && req.method === "GET") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized." });
    const db = readJson(DB_FILE, INITIAL_DB);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.max(1, Math.min(30, parseInt(url.searchParams.get("limit") || "10")));
    const currentName = auth.name;
    const connectedNames = new Set((db.connections || [])
      .filter(c => c.status === "Accepted" && (c.from === currentName || c.to === currentName))
      .map(c => c.from === currentName ? c.to : c.from));
    connectedNames.add(currentName);
    const allPosts = (db.profilePosts || [])
      .filter(post => !post.isDeleted && post.isPublished !== false)
      .filter(post => {
        if (post.visibility === "private") return String(post.author) === currentName || String(post.authorName) === currentName;
        if (post.visibility === "friends_only") return connectedNames.has(post.author) || connectedNames.has(post.authorName) || String(post.author) === currentName || String(post.authorName) === currentName;
        return true;
      })
      .map(post => normalizePostRecord(db, post, auth, req))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const total = allPosts.length;
    const start = (page - 1) * limit;
    const posts = allPosts.slice(start, start + limit);
    return sendJson(res, 200, { success: true, data: posts, total, page, limit, hasMore: start + limit < total });
  }

  if (route === "/api/posts/feed" && req.method === "GET") {
    const db = readJson(DB_FILE, INITIAL_DB);
    const page = url.searchParams.get("page") || 1;
    const limit = url.searchParams.get("limit") || 10;
    const feed = publicFeedPosts(db, auth, req, { page, limit });
    const viewedIds = new Set(feed.posts.map(post => post.id));
    let changed = false;
    db.profilePosts = (db.profilePosts || []).map(post => {
      const id = String(post.id || post._id || "");
      if (!viewedIds.has(id)) return post;
      changed = true;
      return { ...post, viewCount: postCount(post.viewCount) + 1 };
    });
    if (changed) writeJson(DB_FILE, db);
    return sendJson(res, 200, { success: true, ...publicFeedPosts(readJson(DB_FILE, INITIAL_DB), auth, req, { page, limit }) });
  }
  if (route === "/api/posts" && req.method === "POST") {
    const body = await readBody(req);
    const db = readJson(DB_FILE, INITIAL_DB);
    const content = extractPostContent(body);
    const mediaUrls = normalizePostList(body.mediaUrls || body.images);
    if (!content && !mediaUrls.length && !body.mediaUrl) {
      return sendJson(res, 400, { success: false, message: "Post content or media is required." });
    }
    const authorName = auth?.name || body.authorName || body.author || "ConnectHub member";
    const authorProfile = allPeople(publicDB()).find(profile => profile.name === authorName || profile.email === auth?.email);
    const post = {
      id: `post-${Date.now()}`,
      author: authorName,
      authorName,
      authorEmail: auth?.email || body.authorEmail || "",
      authorHandle: authorProfile ? profileHandle(authorProfile) : profileHandle({ name: authorName }),
      role: authorProfile?.title || roleBucket(authorProfile?.role || ""),
      title: body.title || content.slice(0, 64) || "ConnectHub post",
      content,
      text: content,
      images: mediaUrls,
      mediaUrls: [...mediaUrls, body.mediaUrl].filter(Boolean),
      hashtags: extractHashtags(content, body.hashtags || body.tags),
      tags: extractHashtags(content, body.hashtags || body.tags),
      mediaType: body.mediaType || (body.mediaUrl ? "image" : ""),
      likes: [],
      reactions: [],
      comments: [],
      saves: [],
      shares: [],
      shareCount: 0,
      commentCount: 0,
      viewCount: 0,
      visibility: body.visibility || "public",
      isPublished: body.isPublished !== false,
      createdAt: new Date().toISOString()
    };
    db.profilePosts = [...(db.profilePosts || []), post];
    writeJson(DB_FILE, db);
    const normalized = normalizePostRecord(publicDB(), post, auth, req);
    if (socketIO) {
      const connectedNames = new Set((db.connections || [])
        .filter(c => c.status === "Accepted" && (c.from === authorName || c.to === authorName))
        .map(c => c.from === authorName ? c.to : c.from));
      connectedNames.forEach(name => {
        socketIO.to("user_" + name).emit("feed:newPost", normalized);
        socketIO.to("user_" + name).emit("new_post", { post: normalized });
      });
      socketIO.emit("feed:newPost", normalized);
      socketIO.emit("new_post", { post: normalized });
    }
    return sendJson(res, 200, { success: true, post: normalized, db: publicDB() });
  }
  if (route.match(/^\/api\/posts\/[^/]+\/react$/) && req.method === "POST") {
    const id = decodeURIComponent(route.split("/")[3]);
    const body = await readBody(req);
    const db = readJson(DB_FILE, INITIAL_DB);
    const post = findProfilePost(db, id);
    if (!post) return sendJson(res, 404, { success: false, message: "Post not found." });
    const actor = auth?.name || body.user || "Guest";
    const emoji = String(body.emoji || body.reaction || "like").slice(0, 32);
    post.reactions = normalizePostList(post.reactions);
    post.likes = normalizePostList(post.likes);
    const existingIndex = post.reactions.findIndex(reaction => String(reaction.user) === String(actor));
    let action = "added";
    if (existingIndex >= 0) {
      if (post.reactions[existingIndex].emoji === emoji) {
        post.reactions.splice(existingIndex, 1);
        action = "removed";
      } else {
        post.reactions[existingIndex].emoji = emoji;
        action = "changed";
      }
    } else {
      post.reactions.push({ user: actor, emoji, createdAt: new Date().toISOString() });
    }
    post.likes = post.reactions.map(reaction => reaction.user);
    post.updatedAt = new Date().toISOString();
    const grouped = post.reactions.reduce((map, reaction) => {
      const key = reaction.emoji || "like";
      map[key] = (map[key] || 0) + 1;
      return map;
    }, {});
    const owner = postOwnerName(post);
    if (action === "added" && owner && owner !== actor) {
      createNotification(db, owner, "reaction", `${actor} reacted to your post.`, { from: actor, postId: post.id, emoji });
    }
    writeJson(DB_FILE, db);
    const normalized = normalizePostRecord(publicDB(), post, auth, req);
    if (socketIO) {
      socketIO.emit("post:updated", { postId: post.id, post: normalized, reactions: grouped, action });
      socketIO.emit("post_reaction", { postId: post.id, reactions: grouped, total: post.reactions.length, action, emoji, reactorName: actor });
    }
    return sendJson(res, 200, { success: true, post: normalized, reactions: grouped, total: post.reactions.length, action });
  }
  if (route.match(/^\/api\/posts\/[^/]+\/like$/) && req.method === "PUT") {
    const id = decodeURIComponent(route.split("/")[3]);
    const db = readJson(DB_FILE, INITIAL_DB);
    const post = findProfilePost(db, id);
    if (!post) return sendJson(res, 404, { success: false, message: "Post not found." });
    post.likes = post.likes || [];
    const actor = auth?.name || "guest";
    post.reactions = normalizePostList(post.reactions);
    const alreadyLiked = post.likes.includes(actor) || post.reactions.some(reaction => reaction.user === actor);
    if (alreadyLiked) {
      post.likes = post.likes.filter(user => user !== actor);
      post.reactions = post.reactions.filter(reaction => reaction.user !== actor);
    } else {
      post.likes.push(actor);
      post.reactions.push({ user: actor, emoji: "like", createdAt: new Date().toISOString() });
      const owner = post.authorName || post.author;
      if (owner && owner !== actor) createNotification(db, owner, "like_post", `${actor} liked your post.`, { from: actor, postId: post.id });
    }
    post.updatedAt = new Date().toISOString();
    writeJson(DB_FILE, db);
    const normalized = normalizePostRecord(publicDB(), post, auth, req);
    if (socketIO) socketIO.emit("post:updated", { postId: post.id, post: normalized });
    return sendJson(res, 200, { success: true, post: normalized, liked: !alreadyLiked, db: publicDB() });
  }
  if (route.match(/^\/api\/posts\/[^/]+\/comment$/) && req.method === "POST") {
    const id = decodeURIComponent(route.split("/")[3]);
    const body = await readBody(req);
    const db = readJson(DB_FILE, INITIAL_DB);
    const post = findProfilePost(db, id);
    if (!post) return sendJson(res, 404, { success: false, message: "Post not found." });
    post.comments = post.comments || [];
    const actor = auth?.name || body.user || "Guest";
    const text = String(body.text || body.content || "").trim().slice(0, 1000);
    if (!text) return sendJson(res, 400, { success: false, message: "Comment text is required." });
    const comment = { id: `comment-${Date.now()}`, user: actor, author: actor, text, content: text, createdAt: new Date().toISOString(), replies: [] };
    post.comments.push(comment);
    post.commentCount = post.comments.length;
    post.updatedAt = new Date().toISOString();
    const owner = post.authorName || post.author;
    if (owner && owner !== actor) createNotification(db, owner, "comment_post", `${actor} commented on your post.`, { from: actor, postId: post.id, commentId: comment.id });
    writeJson(DB_FILE, db);
    const normalized = normalizePostRecord(publicDB(), post, auth, req);
    if (socketIO) {
      socketIO.emit("post:updated", { postId: post.id, post: normalized });
      socketIO.emit(`post_comment_${post.id}`, { postId: post.id, comment });
      socketIO.emit("new_comment", { postId: post.id, comment });
    }
    return sendJson(res, 200, { success: true, comment, post: normalized, db: publicDB() });
  }
  if (route.match(/^\/api\/posts\/[^/]+\/share$/) && req.method === "POST") {
    const id = decodeURIComponent(route.split("/")[3]);
    const db = readJson(DB_FILE, INITIAL_DB);
    const post = findProfilePost(db, id);
    if (!post) return sendJson(res, 404, { success: false, message: "Post not found." });
    const actor = auth?.name || "Guest";
    post.shares = post.shares || [];
    if (!post.shares.includes(actor)) post.shares.push(actor);
    post.shareCount = post.shares.length;
    post.updatedAt = new Date().toISOString();
    const owner = post.authorName || post.author;
    if (owner && owner !== actor) createNotification(db, owner, "post_share", `${actor} shared your post.`, { from: actor, postId: post.id });
    writeJson(DB_FILE, db);
    const normalized = normalizePostRecord(publicDB(), post, auth, req);
    if (socketIO) socketIO.emit("post:updated", { postId: post.id, post: normalized });
    return sendJson(res, 200, { success: true, post: normalized, db: publicDB() });
  }
  if (route === "/api/reels/feed" && req.method === "GET") return sendJson(res, 200, { success: true, reels: publicDB().reels || [] });
  if (route === "/api/reels" && req.method === "POST") {
    const body = await readBody(req);
    const db = readJson(DB_FILE, INITIAL_DB);
    const reel = { id: `reel-${Date.now()}`, author: auth?.name || body.author || "ConnectHub member", videoUrl: body.videoUrl || "", thumbnail: body.thumbnail || "", caption: body.caption || "", views: 0, likes: [], comments: [], duration: body.duration || 30, createdAt: new Date().toISOString() };
    db.reels = [...(db.reels || []), reel];
    writeJson(DB_FILE, db);
    return sendJson(res, 200, { success: true, reel, db: publicDB() });
  }

  if (route === "/api/messages/conversations" && req.method === "GET") {
    const userName = auth?.name || url.searchParams.get("user") || "";
    const db = publicDB();
    const rows = (db.messages || [])
      .filter(message => message.from === userName || message.to === userName)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return sendJson(res, 200, { success: true, conversations: rows.map(message => normalizeStoredMessage(message, db, req, auth)) });
  }
  if (route.match(/^\/api\/messages\/[^/]+$/) && req.method === "GET") {
    const other = decodeURIComponent(route.replace("/api/messages/", ""));
    const userName = auth?.name || url.searchParams.get("user") || "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get("limit") || "50")));
    const db = readJson(DB_FILE, INITIAL_DB);
    const allMessages = (db.messages || []).filter(message =>
      (message.from === userName && (message.to === other || message.to === decodeURIComponent(other))) ||
      (message.to === userName && (message.from === other || message.from === decodeURIComponent(other)))
    ).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const total = allMessages.length;
    const start = Math.max(0, total - page * limit);
    const end = Math.max(0, total - (page - 1) * limit);
    const messages = allMessages.slice(start, end).reverse();
    const seenIds = [];
    (db.messages || []).forEach(message => {
      if (message.from === other && message.to === userName && !message.read) {
        message.read = true;
        message.status = "seen";
        message.readAt = message.readAt || new Date().toISOString();
        message.seenAt = message.seenAt || message.readAt;
        seenIds.push(message.id);
      }
    });
    if (seenIds.length) {
      (db.notifications || []).forEach(note => {
        if (note.to === userName && note.type === "message" && !note.read && (!note.from || note.from === other)) {
          note.read = true;
          note.readAt = new Date().toISOString();
        }
      });
      writeJson(DB_FILE, db);
      if (socketIO) {
        socketIO.to(`user:${other}`).emit("messages_seen", { by: userName, messageIds: seenIds, conversationWith: userName });
      }
    }
    return sendJson(res, 200, {
      success: true,
      messages: messages.map(message => normalizeStoredMessage(message, publicDB(), req, auth)),
      page,
      limit,
      total,
      hasMore: page * limit < total
    });
  }
  if (route === "/api/messages" && req.method === "POST") {
    const body = await readBody(req);
    body.from = body.from || auth?.name;
    body.to = body.to || body.receiver || body.receiverId;
    body.text = extractMessageContent(body);
    const attachment = body.attachment || null;
    const mediaUrl = body.mediaUrl || attachment?.dataUrl || "";
    const type = String(body.type || body.kind || (mediaUrl ? "image" : "text")).slice(0, 30);
    const db = readJson(DB_FILE, INITIAL_DB);
    const message = {
      id: `msg-${Date.now()}`,
      from: String(body.from || "").slice(0, 80),
      to: String(body.to || "").slice(0, 80),
      text: body.text.slice(0, 600),
      content: body.text.slice(0, 600),
      kind: type,
      type,
      mediaUrl: mediaUrl || null,
      attachment,
      status: "sent",
      reactions: [],
      read: false,
      createdAt: new Date().toISOString()
    };
    if (!message.from || !message.to || (!message.text && !message.attachment && !message.mediaUrl)) return sendJson(res, 400, { success: false, message: "Message sender, recipient, and content are required." });
    db.messages = [...(db.messages || []), message];
    createNotification(db, message.to, "message", `New message from ${message.from}`, { id: `not-${message.id}`, from: message.from, messageId: message.id });
    writeJson(DB_FILE, db);
    const normalized = normalizeStoredMessage(message, publicDB(), req, auth);
    if (socketIO) {
      socketIO.to(`user:${message.to}`).emit("message:new", normalized);
      socketIO.to(`user:${message.from}`).emit("message:new", normalized);
      socketIO.to(`user:${message.to}`).emit("new_message", { message: normalized, conversationWith: message.from });
      socketIO.to(`user_${message.to}`).emit("new_message", { message: normalized, conversationWith: message.from });
    }
    return sendJson(res, 200, { success: true, message: normalized, db: publicDB() });
  }

  if (route === "/api/messages/start" && req.method === "POST") {
    const body = await readBody(req);
    const senderName = String(auth?.name || body.from || "").slice(0, 80);
    const recipientName = String(body.to || body.recipient || "").slice(0, 80);
    if (!senderName || !recipientName || senderName === recipientName) return sendJson(res, 400, { success: false, message: "Valid sender and recipient are required." });
    const db = readJson(DB_FILE, INITIAL_DB);
    const messageLimitKey = `msg_req_${senderName}_${new Date().toISOString().slice(0, 10)}`;
    const msgReqCount = (db.messages || []).filter(m => m.from === senderName && m.createdAt && m.createdAt.startsWith(new Date().toISOString().slice(0, 10))).length;
    if (msgReqCount > 20) return sendJson(res, 429, { success: false, message: "Daily message request limit reached (20/day)." });
    const existing = (db.conversations || []).find(c =>
      c.participants && c.participants.includes(senderName) && c.participants.includes(recipientName)
    );
    if (existing) return sendJson(res, 200, { success: true, conversation: existing, isNew: false });
    const connected = connectionNamesFor(db, senderName).has(recipientName);
    const conversation = {
      id: `conv-${Date.now()}`,
      participants: [senderName, recipientName],
      lastMessage: "",
      lastMessageAt: null,
      status: connected ? "accepted" : "request",
      requester: senderName,
      messageRequestAck: connected,
      createdAt: new Date().toISOString()
    };
    db.conversations = db.conversations || [];
    db.conversations.push(conversation);
    if (!connected) {
      createNotification(db, recipientName, "message_request", `${senderName} sent you a message request.`, { conversationId: conversation.id, from: senderName });
    }
    writeJson(DB_FILE, db);
    return sendJson(res, 200, { success: true, conversation, isNew: true });
  }

  if (route === "/api/notifications/read" && req.method === "PUT") {
    const db = readJson(DB_FILE, INITIAL_DB);
    (db.notifications || []).forEach(note => { note.read = true; });
    writeJson(DB_FILE, db);
    return sendJson(res, 200, { success: true, db: publicDB() });
  }
  if (route === "/api/v1/settings/preferences" && (req.method === "PATCH" || req.method === "PUT")) {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const body = await readBody(req);
    const allowed = {
      preferredLanguage: ["en", "hi", "te", "ur", "ta", "kn", "mr"],
      fontSizePreference: ["small", "medium", "large", "extra-large"],
      accountPrivacy: ["public", "private"],
      messagingPrivacy: ["everyone", "network", "none"],
      profileVisibility: ["public", "connections", "private"],
      whoCanMessage: ["everyone", "connections", "nobody"],
      theme: ["light", "dark", "system"],
      language: ["en", "hi", "te", "ur", "ta", "kn", "mr"],
      fontSize: ["small", "medium", "large", "extra-large"]
    };
    const patch = {};
    Object.entries(allowed).forEach(([key, values]) => {
      if (body[key] && values.includes(body[key])) patch[key] = body[key];
    });
    ["whoCanSeeConnections", "twoFactorAuth", "connectionRequests", "messages", "postLikes", "gigApplications", "platformAnnouncements", "emailNotifications", "deactivated"].forEach(key => {
      if (body[key] !== undefined) patch[key] = Boolean(body[key]);
    });
    ["blockedUsers", "mutedUsers"].forEach(key => {
      if (Array.isArray(body[key])) patch[key] = body[key].map(String).slice(0, 50);
    });
    const db = readJson(DB_FILE, INITIAL_DB);
    const users = readJson(USERS_FILE, {});
    const key = authUserKey(auth);
    db.userSettingsByUser = db.userSettingsByUser || {};
    db.userSettingsByUser[key] = { ...(db.userSettingsByUser[key] || {}), ...patch };
    const email = normalizeEmail(auth.email);
    if (email && users[email]?.profile) users[email].profile = { ...users[email].profile, ...patch };
    writeJson(DB_FILE, db);
    writeJson(USERS_FILE, users);
    return sendJson(res, 200, { success: true, preferences: db.userSettingsByUser[key] });
  }
  if (route === "/api/v1/settings/security" && req.method === "GET") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const db = readJson(DB_FILE, INITIAL_DB);
    const users = readJson(USERS_FILE, {});
    const key = authUserKey(auth);
    const profile = normalizeEmail(auth.email) ? users[normalizeEmail(auth.email)]?.profile : {};
    const prefs = { ...(db.userSettingsByUser?.[key] || {}), ...(profile || {}) };
    const fingerprint = deviceFingerprint(req);
    const storedSessions = Array.isArray(prefs.activeSessions) ? prefs.activeSessions : [];
    const sessions = storedSessions.length
      ? storedSessions.map(session => normalizeSession(session, fingerprint)).sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || new Date(b.lastActive || 0) - new Date(a.lastActive || 0))
      : [normalizeSession({
        sessionId: "current",
        ...parseDeviceInfo(req.headers["user-agent"] || ""),
        device: parseDeviceInfo(req.headers["user-agent"] || "").label,
        ip: getRealIP(req),
        city: "Current device",
        lastActive: new Date().toISOString()
      }, fingerprint)];
    return sendJson(res, 200, {
      success: true,
      security: {
        accountPrivacy: prefs.accountPrivacy || "public",
        messagingPrivacy: prefs.messagingPrivacy || "everyone",
        blockedUsers: prefs.blockedUsers || [],
        mutedUsers: prefs.mutedUsers || [],
        activeSessions: sessions
      }
    });
  }
  if (route.startsWith("/api/v1/auth/sessions/") && req.method === "DELETE") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const sessionId = decodeURIComponent(route.replace("/api/v1/auth/sessions/", ""));
    const db = readJson(DB_FILE, INITIAL_DB);
    const users = readJson(USERS_FILE, {});
    const key = authUserKey(auth);
    const email = normalizeEmail(auth.email);
    const currentSettings = db.userSettingsByUser?.[key] || {};
    const fingerprint = deviceFingerprint(req);
    const currentSessions = currentSettings.activeSessions || [];
    const nextSessions = sessionId === "all"
      ? []
      : sessionId === "all/others"
        ? currentSessions.filter(item => item.fingerprint === fingerprint || item.sessionId === "current")
        : currentSessions.filter(item => item.sessionId !== sessionId);
    db.userSettingsByUser = db.userSettingsByUser || {};
    db.userSettingsByUser[key] = { ...currentSettings, activeSessions: nextSessions };
    if (email && users[email]?.profile) users[email].profile.activeSessions = nextSessions;
    writeJson(DB_FILE, db);
    writeJson(USERS_FILE, users);
    return sendJson(res, 200, { success: true, removedSessionId: sessionId, activeSessions: nextSessions });
  }
  if (route === "/api/settings" && req.method === "GET") {
    const db = readJson(DB_FILE, INITIAL_DB);
    const users = readJson(USERS_FILE, {});
    const email = normalizeEmail(auth?.email);
    const profile = email ? users[email]?.profile : null;
    const saved = auth ? savedPostsFor(db, users, auth) : [];
    const postsById = new Map(allSearchablePosts(db).map(post => [post.id, post]));
    return sendJson(res, 200, {
      success: true,
      settings: profile?.settings || {},
      savedPosts: saved.map(item => ({ ...item, post: postsById.get(item.postId) })).filter(item => item.post)
    });
  }
  if (route === "/api/settings" && req.method === "PUT") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const body = await readBody(req);
    const users = readJson(USERS_FILE, {});
    const email = normalizeEmail(auth?.email);
    if (!email || !users[email]?.profile) return sendJson(res, 404, { success: false, message: "Profile account not found." });
    users[email].profile.settings = { ...(users[email].profile.settings || {}), ...body };
    writeJson(USERS_FILE, users);
    return sendJson(res, 200, { success: true, settings: users[email].profile.settings });
  }

  if (route === "/api/state" && req.method === "GET") {
    return sendJson(res, 200, { db: publicDB() });
  }

  if (route === "/api/search/users" && req.method === "GET") {
    const db = publicDB();
    const q = (url.searchParams.get("q") || "").trim();
    const scope = url.searchParams.get("scope") || "all";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.max(1, Math.min(50, parseInt(url.searchParams.get("limit") || "20")));

    if (!q) {
      return sendJson(res, 200, { success: true, users: [], hasMore: false });
    }

    const searchRegex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const allUsers = allPeople(db);

    let filtered = allUsers.filter(u => {
      if (auth && String(u.name || "").toLowerCase() === String(auth.name || "").toLowerCase()) return false;
      if (scope === "network" && auth) {
        const connections = (db.connections || [])
          .filter(c => (c.status || "Accepted") === "Accepted")
          .filter(c => c.from === auth.name || c.to === auth.name)
          .map(c => c.from === auth.name ? c.to : c.from);
        if (!connections.includes(u.name)) return false;
      }
      const haystack = [u.name, u.company, u.companyName, u.role, u.title, u.headline, u.bio, u.city, u.state, u.location, ...(u.skills || []), ...(u.tags || [])].filter(Boolean).join(" ");
      return searchRegex.test(haystack);
    });

    const total = filtered.length;
    const start = (page - 1) * limit;
    const users = filtered.slice(start, start + limit).map(u => ({
      _id: u.email || u.handle || u.name,
      name: u.name,
      role: u.title || u.role || "",
      company: u.company || u.companyName || "",
      headline: u.title || "",
      profilePhoto: u.avatarPhoto || null,
      location: [u.city, u.state].filter(Boolean).join(", "),
      isOnline: Boolean(u.isOnline),
      lastSeen: u.lastSeen || null,
      skills: u.skills || []
    }));

    return sendJson(res, 200, {
      success: true,
      users,
      hasMore: start + limit < total,
      total,
      query: q
    });
  }

  if (route === "/api/search/suggestions" && req.method === "GET") {
    const q = (url.searchParams.get("q") || "").trim();
    if (!q || q.length < 2) return sendJson(res, 200, { success: true, suggestions: [] });
    const db = publicDB();
    const searchRegex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const prefixRegex = new RegExp('^' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const allUsers = allPeople(db);
    const currentName = auth?.name || "";

    let scored = allUsers
      .filter(u => u.name && u.name !== currentName)
      .map(u => {
        const haystack = [u.name, u.company, u.companyName, u.role, u.title, u.headline, u.bio, u.city, u.state, ...(u.skills || []), ...(u.tags || [])].filter(Boolean).join(" ");
        if (!searchRegex.test(haystack)) return null;
        let score = 0;
        if (prefixRegex.test(u.name)) score = 100;
        else if (searchRegex.test(u.name)) score = 80;
        else if (prefixRegex.test(u.company || u.companyName || "")) score = 70;
        else if (prefixRegex.test(u.role || u.title || "")) score = 60;
        else if (prefixRegex.test(u.city || "")) score = 50;
        else score = 40;
        return { u, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const acceptedNames = new Set((db.connections || []).filter(c => c.status === "Accepted" && (c.from === currentName || c.to === currentName)).map(c => c.from === currentName ? c.to : c.from));
    const pendingSent = new Set((db.connections || []).filter(c => c.from === currentName && c.status === "Pending").map(c => c.to));
    const pendingRecv = new Set((db.connections || []).filter(c => c.to === currentName && c.status === "Pending").map(c => c.from));

    return sendJson(res, 200, {
      success: true,
      suggestions: scored.map(({ u }) => ({
        _id: u.email || u.handle || u.name,
        name: u.name,
        role: u.title || u.role || "",
        company: u.company || u.companyName || "",
        location: [u.city, u.state].filter(Boolean).join(", "),
        profilePhoto: u.avatarPhoto || null,
        connectionStatus: acceptedNames.has(u.name) ? "connected" : pendingSent.has(u.name) ? "pending_sent" : pendingRecv.has(u.name) ? "pending_received" : "none"
      })),
      query: q
    });
  }

  if (route === "/api/search/trending" && req.method === "GET") {
    const db = publicDB();
    return sendJson(res, 200, publicSearchTrendingPayload(db, req));
  }

  if ((route === "/api/search" || route === "/api/v1/search") && req.method === "GET") {
    const db = publicDB();
    return sendJson(res, 200, publicSearchPayload(db, url, req, auth));
  }

  if (route === "/api/feed/events" && req.method === "GET") {
    const db = publicDB();
    const curated = [
      { title: "Startup India Demo Day", date: new Date(Date.now() + 3 * 86400000).toISOString(), location: "Bangalore", type: "Demo Day" },
      { title: "FinTech Summit 2026", date: new Date(Date.now() + 7 * 86400000).toISOString(), location: "Mumbai", type: "Conference" },
      { title: "AI Founders Meetup Hyd", date: new Date(Date.now() + 10 * 86400000).toISOString(), location: "Hyderabad", type: "Meetup" }
    ];
    const events = (db.events || []).length ? (db.events || []) : curated;
    return sendJson(res, 200, { success: true, data: events.slice(0, 6) });
  }

  if (route === "/api/feed/trending-startups" && req.method === "GET") {
    const db = publicDB();
    const startups = publicSearchStartupPool(db, req)
      .sort((a, b) => new Date(b.createdAt || b.joinedAt || 0) - new Date(a.createdAt || a.joinedAt || 0) || Number(b.trendingScore || 0) - Number(a.trendingScore || 0))
      .slice(0, 5)
      .map(startup => ({
        id: startup.id,
        _id: startup.id,
        name: startup.name,
        username: startup.username || startup.handle || profileHandle({ name: startup.name }),
        avatar: startup.logo || "",
        company: startup.name,
        bio: startup.description || startup.tagline || "",
        location: startup.location || [startup.city, startup.state].filter(Boolean).join(", "),
        createdAt: startup.createdAt || startup.joinedAt || "",
        profileUrl: startup.profileUrl || profileUrlFor({ name: startup.name }, req)
      }));
    return sendJson(res, 200, { success: true, data: startups });
  }

  if (route === "/api/people/search" && req.method === "GET") {
    const db = publicDB();
    const results = searchPeople(db, {
      query: url.searchParams.get("q") || "",
      role: url.searchParams.get("role") || "",
      location: url.searchParams.get("location") || "",
      skills: url.searchParams.get("skills") || "",
      company: url.searchParams.get("company") || "",
      currentName: auth?.name || url.searchParams.get("current") || ""
    }, req);
    return sendJson(res, 200, { success: true, results });
  }

  if (route === "/api/network/suggestions" && req.method === "GET") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const db = publicDB();
    const current = profileForAuth(auth, db) || { name: auth.name, role: auth.role };
    const connected = connectionNamesFor(db, current.name);
    const pending = new Set((db.connections || [])
      .filter(item => item.status === "Pending" && (item.from === current.name || item.to === current.name))
      .map(item => item.from === current.name ? item.to : item.from));
    const currentSkills = compactStringArray(current.skills || []).map(item => item.toLowerCase());
    const users = allPeople(db)
      .filter(profile => profile.name && profile.name !== current.name)
      .filter(profile => !connected.has(profile.name) && !pending.has(profile.name))
      .map(profile => {
        const payload = networkProfilePayload(profile, db, current.name, req);
        const cityScore = payload.city && current.city && payload.city.toLowerCase() === String(current.city).toLowerCase() ? 35 : 0;
        const skillScore = payload.skills.filter(skill => currentSkills.includes(skill.toLowerCase())).length * 12;
        const roleScore = roleBucket(current.role) === "freelancer" && payload.roleType === "startup" ? 28 :
          roleBucket(current.role) === "startup" && payload.roleType === "freelancer" ? 28 :
          roleBucket(current.role) === "investor" && payload.roleType === "startup" ? 28 : 10;
        return { ...payload, score: cityScore + skillScore + roleScore + payload.mutualConnections * 8 };
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, Number(url.searchParams.get("limit") || 20));
    return sendJson(res, 200, { success: true, users });
  }

  if (route === "/api/network/connections" && req.method === "GET") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const db = publicDB();
    const currentName = auth.name;
    const people = allPeople(db);
    const connections = (db.connections || [])
      .filter(item => item.status === "Accepted" && (item.from === currentName || item.to === currentName))
      .map(item => {
        const otherName = item.from === currentName ? item.to : item.from;
        const profile = people.find(person => person.name === otherName);
        return profile ? { ...networkProfilePayload(profile, db, currentName, req), connectedAt: item.updatedAt || item.createdAt || "" } : null;
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.connectedAt || 0) - new Date(a.connectedAt || 0) || a.name.localeCompare(b.name));
    return sendJson(res, 200, { success: true, connections });
  }

  if (route.match(/^\/api\/network\/connect\/[^/]+$/) && req.method === "POST") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const targetId = decodeURIComponent(route.split("/")[4] || "");
    const db = readJson(DB_FILE, INITIAL_DB);
    const target = findNetworkProfile(db, targetId);
    const from = String(auth.name || "").slice(0, 80);
    const to = String(target?.name || "").slice(0, 80);
    if (!from || !to || from === to) return sendJson(res, 400, { success: false, message: "Valid connection users are required." });
    db.connections = db.connections || [];
    let connection = db.connections.find(item => [item.from, item.to].includes(from) && [item.from, item.to].includes(to));
    if (!connection) {
      connection = { id: `conn-${Date.now()}`, from, to, status: "Pending", createdAt: new Date().toISOString() };
      db.connections.push(connection);
      createNotification(db, to, "connection_request", `${from} sent you a connection request.`, { connectionId: connection.id, from });
      writeJson(DB_FILE, db);
      emitRealtime("network:updated", { connection }, [`user:${from}`, `user:${to}`, `user_${from}`, `user_${to}`]);
      emitStateUpdate("connection-request", { connection });
    }
    return sendJson(res, 200, { success: true, connection, user: networkProfilePayload(target, db, from, req), db: publicDB() });
  }

  if (route.match(/^\/api\/network\/save\/[^/]+$/) && req.method === "POST") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const body = await readBody(req);
    const desiredSaved = typeof body.saved === "boolean" ? body.saved : null;
    const targetId = decodeURIComponent(route.split("/")[4] || "");
    const db = readJson(DB_FILE, INITIAL_DB);
    const target = findNetworkProfile(db, targetId);
    if (!target) return sendJson(res, 404, { success: false, message: "Profile not found." });
    db.savedProfiles = db.savedProfiles || [];
    const index = db.savedProfiles.findIndex(item => item.owner === auth.name && (item.userId === target.handle || item.name === target.name));
    let saved = desiredSaved === null ? true : desiredSaved;
    if (desiredSaved === false || (desiredSaved === null && index >= 0)) {
      if (index >= 0) db.savedProfiles.splice(index, 1);
      saved = false;
    } else if (desiredSaved === true || desiredSaved === null) {
      if (index < 0) {
        db.savedProfiles.push({ id: `saved-profile-${Date.now()}`, owner: auth.name, userId: target.handle, name: target.name, savedAt: new Date().toISOString(), createdAt: new Date().toISOString() });
      }
      saved = true;
    }
    writeJson(DB_FILE, db);
    return sendJson(res, 200, { success: true, saved, user: networkProfilePayload(target, db, auth.name, req), db: publicDB() });
  }

  if (route === "/api/people/resolve" && req.method === "GET") {
    const raw = String(url.searchParams.get("value") || "").trim();
    const value = raw.replace(/^@/, "").toLowerCase();
    const db = publicDB();
    let extracted = value;
    try {
      const parsed = new URL(raw, `https://${req.headers.host}`);
      const profilePath = parsed.pathname.match(/^\/profile\/([^/]+)\/?$/);
      extracted = (profilePath?.[1] || parsed.searchParams.get("id") || parsed.searchParams.get("name") || value).toLowerCase();
    } catch {}
    const profile = allPeople(db).find(item =>
      item.handle === extracted ||
      String(item.email || "").toLowerCase() === extracted ||
      String(item.name || "").toLowerCase() === extracted
    );
    if (!profile) return sendJson(res, 404, { success: false, message: "Invalid QR code. Please scan a ConnectHub profile QR code." });
    return sendJson(res, 200, { success: true, profile: { id: profile.handle, name: profile.name, profileUrl: profileUrlFor(profile, req) } });
  }

  if (route === "/api/state" && req.method === "PUT") {
    const body = await readBody(req);
    if (!body.db) return sendJson(res, 400, { success: false, message: "Missing db payload." });
    const merged = mergeDBState(readJson(DB_FILE, INITIAL_DB), body.db);
    writeJson(DB_FILE, merged);
    exploreCache.clear();
    emitStateUpdate("state-sync", { source: auth?.name || "client" });
    return sendJson(res, 200, { success: true, db: publicDB() });
  }

  if ((route === "/api/login" || route === "/api/auth/login") && req.method === "POST") {
    const { email: rawEmail, password } = await readBody(req);
    const email = normalizeEmail(rawEmail);
    if (DEMO_USERS[email]) {
      const user = { ...DEMO_USERS[email], email };
      const token = signToken({ email, name: user.name, role: user.role });
      await recordLoginSession({ email, name: user.name, role: user.role }, token, req);
      return sendJson(res, 200, { success: true, user, token });
    }
    const users = readJson(USERS_FILE, {});
    if (users[email] && verifyPassword(password, users[email])) {
      const user = users[email].profile;
      const token = signToken({ email, name: user.name, role: user.role });
      await recordLoginSession({ email, name: user.name, role: user.role }, token, req);
      return sendJson(res, 200, { success: true, user, token });
    }
    return sendJson(res, 401, { success: false, message: "Invalid email or passcode." });
  }

  if ((route === "/api/register" || route === "/api/auth/register") && req.method === "POST") {
    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    const users = readJson(USERS_FILE, {});
    if (!email || !body.password || !body.name) {
      return sendJson(res, 400, { success: false, message: "Name, email, and passcode are required." });
    }
    if (DEMO_USERS[email] || users[email]) {
      return sendJson(res, 409, { success: false, message: "Email account already registered." });
    }
    const profile = createUserProfile(body);
    profile.email = email;
    const passwordData = hashPassword(body.password);
    const registrationIp = getRealIP(req);
    users[email] = {
      passwordHash: passwordData.hash,
      passwordSalt: passwordData.salt,
      profile,
      registration: {
        ipAddress: registrationIp,
        registeredAt: profile.createdAt || new Date().toISOString(),
        userAgent: req.headers["user-agent"] || ""
      }
    };
    writeJson(USERS_FILE, users);
    exploreCache.clear();
    const token = signToken({ email, name: profile.name, role: profile.role });
    await recordLoginSession({ email, name: profile.name, role: profile.role }, token, req);
    emitRealtime("user:registered", {
      profile: mapPublicUser({ ...profile, email }, publicDB(), req, { name: profile.name })
    });
    emitStateUpdate("user-registered", { profile: { name: profile.name, role: profile.role, city: profile.city } });
    return sendJson(res, 200, { success: true, user: profile, token, db: publicDB() });
  }

  if (route === "/api/profile/update" && req.method === "POST") {
    const { email: rawEmail, profile } = await readBody(req);
    const email = normalizeEmail(rawEmail || profile?.email);
    const users = readJson(USERS_FILE, {});
    if (!email || !users[email]) {
      return sendJson(res, 404, { success: false, message: "Profile account not found." });
    }
    const safeProfile = {
      ...users[email].profile,
      ...profile,
      email,
      avatarPhoto: profile?.avatarPhoto || users[email].profile.avatarPhoto || null
    };
    users[email].profile = safeProfile;
    writeJson(USERS_FILE, users);
    exploreCache.clear();
    emitRealtime("profile:updated", { profile: safeProfile }, [`user:${safeProfile?.name}`, `user_${safeProfile?.name}`]);
    emitStateUpdate("profile-updated", { profile: { name: safeProfile?.name, role: safeProfile?.role, city: safeProfile?.city } });
    return sendJson(res, 200, { success: true, user: safeProfile });
  }

  if (route === "/api/auth/send-otp" && req.method === "POST") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const email = normalizeEmail(auth.email);
    if (!email) return sendJson(res, 400, { success: false, message: "No email found for this account." });
    const otp = createOtp(email);
    try {
      await sendOtpEmail(email, otp);
      return sendJson(res, 200, { success: true, message: "OTP sent to your email." });
    } catch (error) {
      return sendJson(res, 200, {
        success: true,
        message: "Email OTP is not configured, so a demo OTP was generated.",
        demoOtp: otp,
        smtpConfigured: false
      });
    }
  }

  if (route === "/api/auth/change-password" && req.method === "POST") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const { otp, newPassword } = await readBody(req);
    const email = normalizeEmail(auth.email);
    if (!newPassword || String(newPassword).length < 8) return sendJson(res, 400, { success: false, message: "Password must be at least 8 characters." });
    if (!verifyOtp(email, otp)) return sendJson(res, 400, { success: false, message: "Invalid or expired OTP." });
    const users = readJson(USERS_FILE, {});
    if (!users[email]) {
      return sendJson(res, 200, { success: true, message: "Password preference saved for this demo account." });
    }
    const passwordData = hashPassword(newPassword);
    users[email].passwordHash = passwordData.hash;
    users[email].passwordSalt = passwordData.salt;
    delete users[email].password;
    writeJson(USERS_FILE, users);
    return sendJson(res, 200, { success: true, message: "Password changed successfully." });
  }

  if (route === "/api/sessions" && req.method === "GET") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const db = readJson(DB_FILE, INITIAL_DB);
    const key = authUserKey(auth);
    const fingerprint = deviceFingerprint(req);
    const stored = db.userSettingsByUser?.[key]?.activeSessions || [];
    const fallbackDevice = parseDeviceInfo(req.headers["user-agent"] || "");
    const sessions = (stored.length ? stored : [{
      sessionId: "current",
      fingerprint,
      device: fallbackDevice.label,
      deviceType: fallbackDevice.deviceType,
      browser: fallbackDevice.browser,
      os: fallbackDevice.os,
      ip: getRealIP(req),
      ipAddress: getRealIP(req),
      city: "Current device",
      location: "Current device",
      userAgent: req.headers["user-agent"] || "",
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    }])
      .map(session => normalizeSession(session, fingerprint))
      .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || new Date(b.lastActive || 0) - new Date(a.lastActive || 0));
    const oldOtherSessions = sessions.filter(session => !session.isCurrent && Date.now() - new Date(session.lastActive || 0).getTime() > 7 * 24 * 60 * 60 * 1000).length;
    const securityScore = Math.max(45, 100 - Math.max(0, sessions.length - 1) * 8 - oldOtherSessions * 15);
    return sendJson(res, 200, {
      success: true,
      sessions,
      securityScore,
      loginHistory: [...sessions].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 10)
    });
  }

  if ((route.startsWith("/api/sessions/") || route.startsWith("/api/v1/auth/sessions/")) && req.method === "DELETE") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const sessionId = decodeURIComponent(route.replace(/^\/api(?:\/v1\/auth)?\/sessions\//, ""));
    const db = readJson(DB_FILE, INITIAL_DB);
    const key = authUserKey(auth);
    const currentSettings = db.userSettingsByUser?.[key] || {};
    const fingerprint = deviceFingerprint(req);
    const currentSessions = currentSettings.activeSessions || [];
    const nextSessions = sessionId === "all"
      ? []
      : sessionId === "all/others"
        ? currentSessions.filter(item => item.fingerprint === fingerprint || item.sessionId === "current")
        : currentSessions.filter(item => item.sessionId !== sessionId);
    db.userSettingsByUser = db.userSettingsByUser || {};
    db.userSettingsByUser[key] = { ...currentSettings, activeSessions: nextSessions };
    writeJson(DB_FILE, db);
    return sendJson(res, 200, { success: true, removedSessionId: sessionId, activeSessions: nextSessions });
  }

  if (route === "/api/notifications" && req.method === "PUT") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const body = await readBody(req);
    const allowed = ["connectionRequests", "messages", "postLikes", "gigApplications", "platformAnnouncements", "emailNotifications"];
    const patch = {};
    allowed.forEach(key => {
      if (body[key] !== undefined) patch[key] = Boolean(body[key]);
    });
    const settings = persistUserSettings(auth, patch);
    return sendJson(res, 200, { success: true, notificationPrefs: settings });
  }

  if (route === "/api/support/report" && req.method === "POST") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const body = await readBody(req);
    const description = String(body.description || "").trim().slice(0, 1200);
    if (!description) return sendJson(res, 400, { success: false, message: "Description is required." });
    const db = readJson(DB_FILE, INITIAL_DB);
    const report = {
      id: `report-${Date.now()}`,
      from: auth.name || auth.email,
      email: auth.email,
      type: String(body.type || "Problem").slice(0, 80),
      description,
      createdAt: new Date().toISOString()
    };
    db.supportReports = [...(db.supportReports || []), report];
    writeJson(DB_FILE, db);
    sendEmailNotification(process.env.SUPPORT_EMAIL || process.env.SMTP_USER, `[ConnectHub Report] ${report.type}`, `${report.from}: ${description}`).catch(() => {});
    return sendJson(res, 200, { success: true, report, message: "Report submitted successfully." });
  }

  if (route === "/api/users/account" && req.method === "DELETE") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const email = normalizeEmail(auth.email);
    const users = readJson(USERS_FILE, {});
    const db = readJson(DB_FILE, INITIAL_DB);
    if (users[email]) delete users[email];
    const key = authUserKey(auth);
    if (db.userSettingsByUser?.[key]) db.userSettingsByUser[key].deletedAt = new Date().toISOString();
    writeJson(USERS_FILE, users);
    writeJson(DB_FILE, db);
    return sendJson(res, 200, { success: true, message: "Account deleted successfully." });
  }

  if ((route === "/api/password/request" || route === "/api/auth/forgot-password" || route === "/api/auth/verify-otp") && req.method === "POST") {
    const { email: rawEmail } = await readBody(req);
    const email = normalizeEmail(rawEmail);
    const users = readJson(USERS_FILE, {});
    if (!users[email]) {
      return sendJson(res, 404, { success: false, message: "No registered account found with that email." });
    }
    const otp = createOtp(email);
    await sendOtpEmail(email, otp);
    return sendJson(res, 200, { success: true, message: "OTP sent to your email." });
  }

  if ((route === "/api/password/reset" || route === "/api/auth/reset-password") && req.method === "POST") {
    const { email: rawEmail, otp, password } = await readBody(req);
    const email = normalizeEmail(rawEmail);
    if (!password || String(password).length < 4) {
      return sendJson(res, 400, { success: false, message: "Passcode must be at least 4 characters." });
    }
    if (!verifyOtp(email, otp)) {
      return sendJson(res, 400, { success: false, message: "Invalid or expired OTP." });
    }
    const users = readJson(USERS_FILE, {});
    if (!users[email]) {
      return sendJson(res, 404, { success: false, message: "Account not found." });
    }
    const passwordData = hashPassword(password);
    users[email].passwordHash = passwordData.hash;
    users[email].passwordSalt = passwordData.salt;
    delete users[email].password;
    writeJson(USERS_FILE, users);
    return sendJson(res, 200, { success: true, message: "Password reset successful." });
  }

  if (route === "/api/messages/send" && req.method === "POST") {
    const body = await readBody(req);
    const db = readJson(DB_FILE, INITIAL_DB);
    const targetRaw = body.receiverId || body.to || "";
    const targetProfile = findNetworkProfile(db, targetRaw) || profileByName(targetRaw);
    const from = String(auth?.name || body.from || "").slice(0, 80);
    const to = String(body.to || targetProfile?.name || targetRaw || "").slice(0, 80);
    const text = extractMessageContent(body).slice(0, 600);
    const attachment = body.attachment || null;
    const mediaUrl = body.mediaUrl || attachment?.dataUrl || null;
    if (!from || !to || (!text && !attachment && !mediaUrl)) return sendJson(res, 400, { success: false, message: "Message sender, recipient, and content are required." });
    const type = String(body.type || body.kind || (mediaUrl ? "image" : "text")).slice(0, 30);
    const message = {
      id: String(body.id || `msg-${Date.now()}`).slice(0, 80),
      from,
      to,
      text,
      content: text,
      sender: from,
      receiver: to,
      kind: type,
      type,
      mediaUrl,
      attachment,
      replyTo: body.replyToId || body.replyTo || null,
      reactions: [],
      status: "sent",
      deliveredAt: null,
      seenAt: null,
      read: false,
      createdAt: body.createdAt || new Date().toISOString()
    };
    db.messages = db.messages || [];
    if (!db.messages.some(item => item.id === message.id)) db.messages.push(message);
    createNotification(db, to, "message", `New message from ${from}`, { id: `not-${message.id}`, from, messageId: message.id });
    writeJson(DB_FILE, db);
    const normalized = normalizeStoredMessage(message, publicDB(), req, auth);
    if (socketIO) {
      const receiverRoom = socketIO.sockets.adapter.rooms.get(`user:${to}`) || socketIO.sockets.adapter.rooms.get(`user_${to}`);
      const isReceiverOnline = receiverRoom && receiverRoom.size > 0;
      if (isReceiverOnline) {
        message.status = "delivered";
        message.deliveredAt = new Date().toISOString();
        message.read = false;
        normalized.status = "delivered";
        normalized.deliveredAt = message.deliveredAt;
        const freshDb = readJson(DB_FILE, INITIAL_DB);
        const stored = (freshDb.messages || []).find(item => item.id === message.id);
        if (stored) {
          stored.status = message.status;
          stored.deliveredAt = message.deliveredAt;
          writeJson(DB_FILE, freshDb);
        }
      }
      socketIO.to(`user:${to}`).emit("message:new", normalized);
      socketIO.to(`user:${from}`).emit("message:new", normalized);
      socketIO.to(`user:${to}`).emit("new_message", { message: normalized, conversationWith: from });
      socketIO.to(`user_${to}`).emit("new_message", { message: normalized, conversationWith: from });
      socketIO.to(`conversation:${[from, to].sort().join("__")}`).emit("message:new", normalized);
      if (isReceiverOnline) {
        socketIO.to(`user:${from}`).emit("message_delivered", { messageId: message.id, conversationWith: to });
      }
    }
    const recipient = profileByName(to);
    sendEmailNotification(recipient?.email, "New Connect Hub message", `${from}: ${text}`).catch(() => {});
    return sendJson(res, 200, { success: true, message: normalizeStoredMessage(message, publicDB(), req, auth), db: publicDB() });
  }

  if ((route === "/api/messages/inbox" || route === "/api/messages/conversations") && req.method === "GET") {
    const db = publicDB();
    const userName = String(auth?.name || url.searchParams.get("user") || "").trim();
    const tab = String(url.searchParams.get("tab") || "focused").toLowerCase();
    const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
    const queryTerms = expandPeopleSearchTerms(q);
    if (!userName) return sendJson(res, 400, { success: false, message: "User is required." });
    const connected = connectionNamesFor(db, userName);
    const jobWords = /\b(hiring|role|opportunity|apply|job|gig)\b/i;
    const profiles = allPeople(db).filter(profile => profile.name && profile.name !== userName);
    const rows = profiles.map(profile => {
      const thread = (db.messages || [])
        .filter(message => (message.from === userName && message.to === profile.name) || (message.from === profile.name && message.to === userName))
        .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      const last = thread[thread.length - 1] || null;
      const unread = thread.filter(message => message.from === profile.name && message.to === userName && !message.read).length;
      return {
        id: profile.handle,
        name: profile.name,
        handle: profile.handle,
        role: profile.title || roleBucket(profile.role),
        roleType: roleBucket(profile.role),
        location: [profile.city, profile.state].filter(Boolean).join(", "),
        skills: profile.skills || [],
        companyName: profile.companyName || "",
        searchText: profile.searchText || profile.bio || "",
        avatarInitials: profile.avatarInitials || initialsFor(profile.name || "CH"),
        avatarPhoto: profile.avatarPhoto || null,
        lastMessage: last,
        lastText: last?.text || "",
        unread,
        connected: connected.has(profile.name),
        recentAt: last?.createdAt || ""
      };
    }).filter(row => {
      const searchText = [row.name, row.handle, row.role, row.location, row.companyName, (row.skills || []).join(" "), row.searchText, row.lastText].join(" ").toLowerCase();
      if (q && !queryTerms.some(term => searchText.includes(term))) return false;
      if (tab === "jobs") return row.roleType === "startup" || row.roleType === "recruiter" || jobWords.test(row.lastText);
      if (tab === "unread") return row.unread > 0;
      if (tab === "network") return row.connected && row.roleType !== "startup";
      return true;
    }).sort((a, b) => new Date(b.recentAt || 0) - new Date(a.recentAt || 0) || a.name.localeCompare(b.name));
    return sendJson(res, 200, { success: true, tab, conversations: rows });
  }

  if ((route.match(/^\/api\/messages\/read\/[^/]+$/) || route.match(/^\/api\/messages\/seen\/[^/]+$/)) && req.method === "POST") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const db = readJson(DB_FILE, INITIAL_DB);
    const targetId = decodeURIComponent(route.split("/")[4] || "");
    const target = findNetworkProfile(db, targetId) || profileByName(targetId);
    const otherName = target?.name || targetId;
    const seenIds = [];
    db.messages = db.messages || [];
    db.messages.forEach(message => {
      if (message.from === otherName && message.to === auth.name && !message.read) {
        message.read = true;
        message.readAt = new Date().toISOString();
        message.status = "seen";
        message.seenAt = message.readAt;
        seenIds.push(message.id);
      }
    });
    (db.notifications || []).forEach(note => {
      if (note.to === auth.name && note.type === "message" && (!note.from || note.from === otherName)) {
        note.read = true;
        note.readAt = note.readAt || new Date().toISOString();
      }
    });
    writeJson(DB_FILE, db);
    if (socketIO && seenIds.length) {
      socketIO.to(`user:${otherName}`).emit("messages_seen", { by: auth.name, messageIds: seenIds, conversationWith: auth.name });
    }
    return sendJson(res, 200, { success: true, messageIds: seenIds });
  }

  if (route.match(/^\/api\/messages\/[^/]+$/) && req.method === "GET") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized. Sign in again." });
    const db = readJson(DB_FILE, INITIAL_DB);
    const targetId = decodeURIComponent(route.split("/")[3] || "");
    const target = findNetworkProfile(db, targetId) || profileByName(targetId);
    const me = auth.name;
    const otherName = target?.name || targetId;
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const limit = Math.max(1, Math.min(60, Number(url.searchParams.get("limit") || 30)));
    const thread = (db.messages || [])
      .filter(message => (message.from === me && message.to === otherName) || (message.from === otherName && message.to === me))
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    const pageItems = thread.slice(Math.max(0, thread.length - page * limit), thread.length - (page - 1) * limit);
    db.messages = db.messages || [];
    db.messages.forEach(message => {
      if (message.from === otherName && message.to === me && !message.read) {
        message.read = true;
        message.readAt = new Date().toISOString();
        message.status = "seen";
        message.seenAt = message.readAt;
      }
    });
    writeJson(DB_FILE, db);
    return sendJson(res, 200, {
      success: true,
      messages: pageItems.map(message => normalizeStoredMessage(message, publicDB(), req, auth)),
      hasMore: thread.length > page * limit,
      page
    });
  }

  if (route === "/api/notifications/count" && req.method === "GET") {
    const db = publicDB();
    const userName = String(auth?.name || url.searchParams.get("user") || "").trim();
    const companyName = String(auth?.companyName || url.searchParams.get("company") || "").trim();
    const names = [userName, companyName].filter(Boolean);
    const notifications = (db.notifications || []).filter(note => names.includes(note.to) && !note.read).length;
    const messages = (db.messages || []).filter(message => message.to === userName && !message.read).length;
    return sendJson(res, 200, { success: true, notifications, messages, total: notifications + messages });
  }

  if (route === "/api/notifications" && req.method === "GET") {
    const db = publicDB();
    const userName = String(auth?.name || url.searchParams.get("user") || "").trim();
    const companyName = String(url.searchParams.get("company") || "").trim();
    const tab = String(url.searchParams.get("tab") || "all").toLowerCase();
    const names = [userName, companyName].filter(Boolean);
    if (!names.length) return sendJson(res, 400, { success: false, message: "User is required." });
    const people = allPeople(db);
    const notifications = (db.notifications || [])
      .filter(note => names.includes(note.to) && notificationMatchesTab(note, tab))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .map(note => {
        const actor = String(note.from || String(note.text || "").split(" sent ")[0].split("New message from ")[1] || String(note.text || "").split(" ")[0] || "").trim();
        const profile = people.find(item => item.name === actor) || null;
        return {
          ...note,
          actor,
          actorProfileUrl: profile ? profileUrlFor(profile, req) : note.targetUrl || "",
          avatarInitials: profile?.avatarInitials || initialsFor(actor || "CH"),
          avatarPhoto: profile?.avatarPhoto || null
        };
      });
    return sendJson(res, 200, { success: true, tab, notifications });
  }

  if (route === "/api/notifications/unread-count" && req.method === "GET") {
    const db = publicDB();
    const userName = String(auth?.name || url.searchParams.get("user") || "").trim();
    const companyName = String(url.searchParams.get("company") || "").trim();
    const names = [userName, companyName].filter(Boolean);
    const unreadCount = (db.notifications || []).filter(note => names.includes(note.to) && !note.read).length;
    return sendJson(res, 200, { success: true, unreadCount });
  }

  if (route === "/api/notifications/mark-read" && req.method === "POST") {
    const body = await readBody(req);
    const ids = new Set((body.ids || []).map(String));
    const db = readJson(DB_FILE, INITIAL_DB);
    db.notifications = db.notifications || [];
    db.notifications.forEach(note => {
      if (ids.has(String(note.id))) note.read = true;
    });
    writeJson(DB_FILE, db);
    return sendJson(res, 200, { success: true, db: publicDB() });
  }

  if ((route === "/api/notifications/read-all" || route === "/api/notifications/mark-read") && req.method === "PUT") {
    const db = readJson(DB_FILE, INITIAL_DB);
    const userName = String(auth?.name || url.searchParams.get("user") || "").trim();
    const companyName = String(url.searchParams.get("company") || "").trim();
    const names = [userName, companyName].filter(Boolean);
    db.notifications = db.notifications || [];
    db.notifications.forEach(note => {
      if (!names.length || names.includes(note.to)) {
        note.read = true;
        note.readAt = new Date().toISOString();
      }
    });
    writeJson(DB_FILE, db);
    return sendJson(res, 200, { success: true, db: publicDB() });
  }

  if (route.match(/^\/api\/notifications\/[^/]+\/read$/) && req.method === "PUT") {
    const id = decodeURIComponent(route.split("/")[3]);
    const db = readJson(DB_FILE, INITIAL_DB);
    const note = (db.notifications || []).find(item => String(item.id) === id);
    if (!note) return sendJson(res, 404, { success: false, message: "Notification not found." });
    note.read = true;
    note.readAt = new Date().toISOString();
    writeJson(DB_FILE, db);
    return sendJson(res, 200, { success: true, notification: note });
  }

  if (route === "/api/connections" && req.method === "POST") {
    const body = await readBody(req);
    const from = String(auth?.name || body.from || "").slice(0, 80);
    const to = String(body.to || "").slice(0, 80);
    if (!from || !to || from === to) return sendJson(res, 400, { success: false, message: "Valid connection users are required." });
    const db = readJson(DB_FILE, INITIAL_DB);
    db.connections = db.connections || [];
    const existing = db.connections.find(c => [c.from, c.to].includes(from) && [c.from, c.to].includes(to));
    if (existing) return sendJson(res, 200, { success: true, connection: existing, db: publicDB() });
    const connection = { id: `conn-${Date.now()}`, from, to, status: "Pending", createdAt: new Date().toISOString() };
    db.connections.push(connection);
    createNotification(db, to, "connection_request", `${from} sent you a connection request.`, { connectionId: connection.id });
    writeJson(DB_FILE, db);
    emitRealtime("network:updated", { connection }, [`user:${from}`, `user:${to}`, `user_${from}`, `user_${to}`]);
    emitStateUpdate("connection-request", { connection });
    const recipient = profileByName(to);
    sendEmailNotification(recipient?.email, "New Connect Hub connection request", `${from} sent you a connection request.`).catch(() => {});
    return sendJson(res, 200, { success: true, connection, db: publicDB() });
  }

  if (route === "/api/connections/respond" && req.method === "POST") {
    const { id, status } = await readBody(req);
    const db = readJson(DB_FILE, INITIAL_DB);
    const connection = (db.connections || []).find(item => item.id === id);
    if (!connection) return sendJson(res, 404, { success: false, message: "Connection request not found." });
    connection.status = status === "Accepted" ? "Accepted" : "Declined";
    if (connection.status === "Accepted") {
      createNotification(db, connection.from, "connection_accepted", `${connection.to} accepted your connection request.`, { from: connection.to, connectionId: connection.id });
    }
    writeJson(DB_FILE, db);
    emitRealtime("network:updated", { connection }, [`user:${connection.from}`, `user:${connection.to}`, `user_${connection.from}`, `user_${connection.to}`]);
    emitStateUpdate("connection-response", { connection });
    return sendJson(res, 200, { success: true, connection, db: publicDB() });
  }

  if (route === "/api/connections/request" && req.method === "POST") {
    const body = await readBody(req);
    const from = String(auth?.name || body.from || "").slice(0, 80);
    const to = String(body.to || "").slice(0, 80);
    if (!from || !to || from === to) return sendJson(res, 400, { success: false, message: "Cannot connect with yourself." });
    const db = readJson(DB_FILE, INITIAL_DB);
    db.connections = db.connections || [];
    const existing = db.connections.find(c => [c.from, c.to].includes(from) && [c.from, c.to].includes(to));
    if (existing) return sendJson(res, 200, { success: true, connection: existing, status: existing.status, db: publicDB() });
    const connection = { id: `conn-${Date.now()}`, from, to, status: "Pending", createdAt: new Date().toISOString() };
    db.connections.push(connection);
    createNotification(db, to, "connection_request", `${from} sent you a connection request.`, { connectionId: connection.id });
    writeJson(DB_FILE, db);
    emitRealtime("network:updated", { connection }, [`user:${from}`, `user:${to}`, `user_${from}`, `user_${to}`]);
    emitStateUpdate("connection-request", { connection });
    return sendJson(res, 200, { success: true, connection, db: publicDB() });
  }

  if (route === "/api/connections/requests" && req.method === "GET") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized." });
    const db = publicDB();
    const requests = (db.connections || [])
      .filter(c => c.to === auth.name && c.status === "Pending")
      .map(c => {
        const profile = allPeople(db).find(p => p.name === c.from);
        return { _id: c.id, id: c.id, from: c.from, status: c.status, createdAt: c.createdAt, requester: profile ? { _id: profile.email || profile.handle || profile.name, name: profile.name, role: profile.title || profile.role || "", company: profile.company || profile.companyName || "", profilePhoto: profile.avatarPhoto || null, headline: profile.title || "" } : { _id: c.from, name: c.from } };
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return sendJson(res, 200, { success: true, requests });
  }

  if (route.match(/^\/api\/connections\/accept\/[^/]+$/) && req.method === "POST") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized." });
    const connectionId = route.split("/")[4];
    const db = readJson(DB_FILE, INITIAL_DB);
    const connection = (db.connections || []).find(c => c.id === connectionId);
    if (!connection) return sendJson(res, 404, { success: false, message: "Request not found." });
    if (connection.to !== auth.name) return sendJson(res, 403, { success: false, message: "Not authorized." });
    connection.status = "Accepted";
    connection.updatedAt = new Date().toISOString();
    createNotification(db, connection.from, "connection_accepted", `${auth.name} accepted your connection request.`, { from: auth.name, connectionId });
    writeJson(DB_FILE, db);
    emitRealtime("network:updated", { connection }, [`user:${connection.from}`, `user:${connection.to}`]);
    return sendJson(res, 200, { success: true, connection });
  }

  if (route.match(/^\/api\/connections\/reject\/[^/]+$/) && req.method === "POST") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized." });
    const connectionId = route.split("/")[4];
    const db = readJson(DB_FILE, INITIAL_DB);
    const idx = (db.connections || []).findIndex(c => c.id === connectionId);
    if (idx === -1) return sendJson(res, 404, { success: false, message: "Request not found." });
    if (db.connections[idx].to !== auth.name) return sendJson(res, 403, { success: false, message: "Not authorized." });
    db.connections.splice(idx, 1);
    writeJson(DB_FILE, db);
    return sendJson(res, 200, { success: true });
  }

  if (route.match(/^\/api\/connections\/conn-\d+$/) && req.method === "DELETE") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized." });
    const connectionId = route.split("/")[3];
    const db = readJson(DB_FILE, INITIAL_DB);
    const idx = (db.connections || []).findIndex(c => c.id === connectionId);
    if (idx === -1) return sendJson(res, 404, { success: false, message: "Not found." });
    const conn = db.connections[idx];
    if (conn.from !== auth.name && conn.to !== auth.name) return sendJson(res, 403, { success: false, message: "Not authorized." });
    db.connections.splice(idx, 1);
    writeJson(DB_FILE, db);
    return sendJson(res, 200, { success: true });
  }

  if (route.match(/^\/api\/connections\/status\/[^/]+$/) && req.method === "GET") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized." });
    const otherName = decodeURIComponent(route.split("/")[4]);
    const db = publicDB();
    const connection = (db.connections || []).find(c =>
      [c.from, c.to].includes(auth.name) && [c.from, c.to].includes(otherName)
    );
    if (!connection) return sendJson(res, 200, { success: true, status: "none" });
    let status = connection.status === "Accepted" ? "accepted" : "pending";
    if (status === "pending") {
      status = connection.from === auth.name ? "pending_sent" : "pending_received";
    }
    return sendJson(res, 200, { success: true, status, connectionId: connection.id });
  }

  if (route === "/api/connections/my-connections" && req.method === "GET") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Unauthorized." });
    const db = publicDB();
    const people = allPeople(db);
    const connections = (db.connections || [])
      .filter(c => c.status === "Accepted" && (c.from === auth.name || c.to === auth.name))
      .map(c => {
        const otherName = c.from === auth.name ? c.to : c.from;
        const profile = people.find(p => p.name === otherName);
        return { connectionId: c.id, connectedAt: c.updatedAt || c.createdAt || "", user: profile ? { _id: profile.email || profile.handle || profile.name, name: profile.name, role: profile.title || profile.role || "", company: profile.company || profile.companyName || "", profilePhoto: profile.avatarPhoto || null, headline: profile.title || "", isOnline: Boolean(profile.isOnline) } : { _id: otherName, name: otherName } };
      })
      .sort((a, b) => new Date(b.connectedAt || 0) - new Date(a.connectedAt || 0));
    return sendJson(res, 200, { success: true, connections });
  }

  if (route === "/api/investor-interest" && req.method === "POST") {
    const body = await readBody(req);
    const investorName = String(auth?.name || body.investorName || "").slice(0, 80);
    const startupId = String(body.startupId || "").slice(0, 80);
    const db = readJson(DB_FILE, INITIAL_DB);
    const startup = (db.startups || []).find(item => item.id === startupId || item.name === body.startupName);
    if (!investorName || !startup) return sendJson(res, 400, { success: false, message: "Investor and startup are required." });
    db.investorInterests = db.investorInterests || [];
    const interest = {
      id: `interest-${Date.now()}`,
      investorName,
      startupId: startup.id,
      startupName: startup.name,
      amount: body.amount || "",
      note: String(body.note || "Interested in discussing investment.").slice(0, 300),
      status: "Interested",
      createdAt: new Date().toISOString()
    };
    db.investorInterests.push(interest);
    createNotification(db, startup.name, "investor_interest", `${investorName} expressed interest in ${startup.name}.`, { interestId: interest.id });
    writeJson(DB_FILE, db);
    return sendJson(res, 200, { success: true, interest, db: publicDB() });
  }

  if (route === "/api/reviews" && req.method === "POST") {
    const body = await readBody(req);
    const from = String(auth?.name || body.from || "").slice(0, 80);
    const to = String(body.to || "").slice(0, 80);
    const rating = Math.max(1, Math.min(5, Number(body.rating || 5)));
    const text = String(body.text || "").slice(0, 300);
    if (!from || !to) return sendJson(res, 400, { success: false, message: "Reviewer and review target are required." });
    const db = readJson(DB_FILE, INITIAL_DB);
    db.reviews = db.reviews || [];
    const review = { id: `review-${Date.now()}`, from, to, rating, text, createdAt: new Date().toISOString() };
    db.reviews.push(review);
    createNotification(db, to, "review", `${from} rated you ${rating}/5.`, { reviewId: review.id });
    writeJson(DB_FILE, db);
    return sendJson(res, 200, { success: true, review, db: publicDB() });
  }

  if (route === "/api/stories/feed" && req.method === "GET") {
    const db = publicDB();
    const userName = String(auth?.name || url.searchParams.get("user") || "").trim();
    const now = Date.now();
    const stories = (db.stories || [])
      .filter(story => new Date(story.expiresAt || 0).getTime() > now)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const grouped = new Map();
    stories.forEach(story => {
      const author = story.author || "ConnectHub member";
      const bucket = grouped.get(author) || {
        author,
        avatarInitials: initialsFor(author),
        hasUnread: false,
        stories: []
      };
      const viewed = (story.viewers || []).includes(userName);
      bucket.hasUnread = bucket.hasUnread || !viewed;
      bucket.stories.push({ ...story, isViewed: viewed });
      grouped.set(author, bucket);
    });
    return sendJson(res, 200, { success: true, stories: Array.from(grouped.values()) });
  }

  if (route === "/api/stories" && req.method === "POST") {
    const body = await readBody(req);
    const db = readJson(DB_FILE, INITIAL_DB);
    const author = String(auth?.name || body.author || "ConnectHub member").slice(0, 80);
    const mediaUrl = body.mediaUrl || body.media || body.image || body.dataUrl || "";
    const story = {
      id: `story-${Date.now()}`,
      author,
      mediaUrl,
      mediaType: String(body.mediaType || (String(mediaUrl).includes("video") ? "video" : "image")).slice(0, 20),
      caption: String(body.caption || "").slice(0, 200),
      viewers: [],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    db.stories = [story, ...(db.stories || [])];
    writeJson(DB_FILE, db);
    if (socketIO) socketIO.emit("story:new", story);
    return sendJson(res, 201, { success: true, story, db: publicDB() });
  }

  if (route.match(/^\/api\/stories\/[^/]+\/view$/) && req.method === "POST") {
    const id = decodeURIComponent(route.split("/")[3]);
    const db = readJson(DB_FILE, INITIAL_DB);
    const story = (db.stories || []).find(item => String(item.id) === id);
    if (!story) return sendJson(res, 404, { success: false, message: "Story not found." });
    const viewer = String(auth?.name || "Guest").slice(0, 80);
    story.viewers = story.viewers || [];
    if (!story.viewers.includes(viewer)) story.viewers.push(viewer);
    if (story.author && story.author !== viewer) createNotification(db, story.author, "story_view", `${viewer} viewed your story.`, { from: viewer, storyId: story.id });
    writeJson(DB_FILE, db);
    return sendJson(res, 200, { success: true, story });
  }

  if (route === "/api/gigs/ai-match" && req.method === "GET") {
    const db = publicDB();
    const profile = profileForAuth(auth, db) || {};
    const skills = [...(profile.skills || []), profile.title, profile.sector].filter(Boolean).map(item => normalizeSearchText(item));
    const gigs = (db.jobs || []).map(gig => {
      const gigText = normalizeSearchText([gig.title, gig.description, ...(gig.tags || []), gig.category].join(" "));
      const matchedSkills = skills.filter(skill => skill && gigText.includes(skill.split(/\s+/)[0]));
      const score = Math.min(100, Math.round((matchedSkills.length / Math.max(skills.length, 1)) * 85 + (matchedSkills.length ? 15 : 0)));
      return { ...gig, matchScore: score, matchedSkills };
    })
      .filter(gig => gig.matchScore > 0 || !skills.length)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);
    return sendJson(res, 200, { success: true, gigs, matchCount: gigs.length });
  }

  if (route.match(/^\/api\/gigs\/[^/]+\/apply$/) && req.method === "POST") {
    const id = decodeURIComponent(route.split("/")[3]);
    const body = await readBody(req);
    const db = readJson(DB_FILE, INITIAL_DB);
    const gig = (db.jobs || []).find(item => String(item.id) === id);
    if (!gig) return sendJson(res, 404, { success: false, message: "Gig not found." });
    const applicantName = String(auth?.name || body.name || body.candidateName || "Applicant").slice(0, 80);
    gig.applicantRecords = Array.isArray(gig.applicantRecords) ? gig.applicantRecords : [];
    if (gig.applicantRecords.some(item => item.user === applicantName)) return sendJson(res, 409, { success: false, message: "Already applied." });
    const application = {
      id: `app-${Date.now()}`,
      user: applicantName,
      proposal: String(body.proposal || body.note || "").slice(0, 800),
      rate: String(body.rate || body.proposedRate || "").slice(0, 80),
      status: "pending",
      appliedAt: new Date().toISOString()
    };
    gig.applicantRecords.push(application);
    gig.applicants = typeof gig.applicants === "number" ? gig.applicants + 1 : gig.applicantRecords.length;
    const startup = (db.startups || []).find(item => item.id === gig.startupId);
    db.applications = db.applications || [];
    db.applications.push({
      id: application.id,
      jobId: gig.id,
      startupName: startup?.name || gig.startupName || "Startup",
      jobTitle: gig.title,
      proposedRate: application.rate,
      appliedDate: new Date().toISOString(),
      status: "Pending",
      candidateName: applicantName,
      proposal: application.proposal
    });
    const recipient = startup?.name || gig.postedBy || gig.startupName;
    if (recipient) createNotification(db, recipient, "gig_application", `${applicantName} applied to ${gig.title}.`, { from: applicantName, gigId: gig.id, applicationId: application.id });
    writeJson(DB_FILE, db);
    emitRealtime("gig:updated", { gig, application }, recipient ? [`user:${recipient}`, `user_${recipient}`, `user:${applicantName}`, `user_${applicantName}`] : [`user:${applicantName}`, `user_${applicantName}`]);
    emitStateUpdate("gig-application", { gigId: gig.id, application });
    return sendJson(res, 200, { success: true, message: "Application submitted.", application, gig, db: publicDB() });
  }

  if (route.match(/^\/api\/gigs\/[^/]+\/applicants\/[^/]+\/status$/) && req.method === "PUT") {
    const parts = route.split("/");
    const gigId = decodeURIComponent(parts[3]);
    const userId = decodeURIComponent(parts[5]);
    const body = await readBody(req);
    const status = String(body.status || "").toLowerCase() === "accepted" ? "accepted" : "rejected";
    const db = readJson(DB_FILE, INITIAL_DB);
    const gig = (db.jobs || []).find(item => String(item.id) === gigId);
    if (!gig) return sendJson(res, 404, { success: false, message: "Gig not found." });
    const applicant = (gig.applicantRecords || []).find(item => item.user === userId || profileHandle({ name: item.user }) === userId);
    if (!applicant) return sendJson(res, 404, { success: false, message: "Applicant not found." });
    applicant.status = status;
    (db.applications || []).forEach(item => {
      if (item.id === applicant.id || (item.jobId === gig.id && item.candidateName === applicant.user)) item.status = status === "accepted" ? "Accepted" : "Rejected";
    });
    createNotification(db, applicant.user, status === "accepted" ? "gig_accepted" : "gig_rejected", `${auth?.name || "Startup"} ${status === "accepted" ? "accepted" : "updated"} your application for ${gig.title}.`, { from: auth?.name || "Startup", gigId: gig.id, applicationId: applicant.id });
    writeJson(DB_FILE, db);
    emitRealtime("gig:updated", { gig, applicant }, [`user:${applicant.user}`, `user_${applicant.user}`, `user:${auth?.name}`, `user_${auth?.name}`]);
    emitStateUpdate("gig-application-status", { gigId: gig.id, applicant });
    return sendJson(res, 200, { success: true, applicant, gig, db: publicDB() });
  }

  const registrationLookupMatch = route.match(/^\/api\/admin\/users\/([^/]+)\/registration-location$/);
  if ((registrationLookupMatch || route === "/api/admin/users/registration-location") && req.method === "GET") {
    if (!auth) return sendJson(res, 401, { success: false, message: "Admin login required." });
    if (!isAdminAuth(auth)) return sendJson(res, 403, { success: false, message: "Admin access required." });

    const identifier = decodeURIComponent(registrationLookupMatch?.[1] || url.searchParams.get("username") || url.searchParams.get("user") || "").trim();
    if (!identifier) return sendJson(res, 400, { success: false, message: "Provide a username, handle, name, or email." });

    const db = readJson(DB_FILE, INITIAL_DB);
    const users = readJson(USERS_FILE, {});
    const found = findRegisteredUserByIdentifier(users, identifier);
    const auditBase = {
      type: "admin_registration_location_lookup",
      actor: { email: normalizeEmail(auth.email), name: auth.name || "", role: auth.role || "" },
      targetIdentifier: identifier,
      requestIp: getRealIP(req),
      userAgent: req.headers["user-agent"] || "",
      route
    };

    if (!found) {
      appendAuditLog({ ...auditBase, outcome: "not_found" });
      return sendJson(res, 404, { success: false, message: `No registered user found for "${identifier}".` });
    }

    const { email, entry, profile } = found;
    const session = earliestKnownSessionForUser(db, entry, profile, email);
    const registration = entry.registration || {};
    const storedIp = registration.ipAddress || registration.ip || profile.registrationIpAddress || profile.registrationIp || session?.ipAddress || session?.ip || "";
    const source = registration.ipAddress || registration.ip || profile.registrationIpAddress || profile.registrationIp
      ? "registration"
      : session
        ? "first-session"
        : "missing";

    appendAuditLog({
      ...auditBase,
      outcome: storedIp ? "success" : "missing_ip",
      target: publicRegistrationLookupUser(profile, email),
      source
    });

    if (!storedIp) {
      return sendJson(res, 200, {
        success: true,
        user: publicRegistrationLookupUser(profile, email),
        registration: {
          ipAddress: null,
          source,
          registeredAt: registration.registeredAt || profile.createdAt || profile.joinedAt || null
        },
        geolocation: null,
        message: "No registration IP is stored for this user yet. Older accounts may only have server/auth logs."
      });
    }

    const geolocation = await fetchIpGeoDetails(storedIp);
    return sendJson(res, 200, {
      success: true,
      user: publicRegistrationLookupUser(profile, email),
      registration: {
        ipAddress: storedIp,
        source,
        registeredAt: registration.registeredAt || session?.createdAt || profile.createdAt || profile.joinedAt || null
      },
      geolocation: {
        city: geolocation.city || "",
        region: geolocation.region || "",
        country: geolocation.country || "",
        countryCode: geolocation.countryCode || "",
        latitude: geolocation.latitude,
        longitude: geolocation.longitude,
        isp: geolocation.isp || "",
        source: geolocation.source || "ip-api",
        error: geolocation.error || null
      },
      audit: { logged: true }
    });
  }

  if (route === "/api/admin/summary" && req.method === "GET") {
    if (!isAdminAuth(auth)) return sendJson(res, 403, { success: false, message: "Admin access required." });
    const db = publicDB();
    return sendJson(res, 200, {
      success: true,
      counts: {
        users: db.registeredProfiles.length + Object.keys(DEMO_USERS).length,
        jobs: (db.jobs || []).length,
        posts: (db.freelancerAds || []).length + (db.startupPromotions || []).length,
        messages: (db.messages || []).length,
        connections: (db.connections || []).length,
        interests: (db.investorInterests || []).length,
        reviews: (db.reviews || []).length
      },
      db
    });
  }

  if (route === "/api/payments/razorpay-key" && req.method === "GET") {
    if (!razorpayConfigured()) {
      return sendJson(res, 503, { success: false, message: "Razorpay is not configured yet." });
    }
    return sendJson(res, 200, { success: true, keyId: process.env.RAZORPAY_KEY_ID });
  }

  if (route === "/api/payments/create-order" && req.method === "POST") {
    if (!razorpayConfigured()) {
      return sendJson(res, 503, { success: false, message: "Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Render to enable payments." });
    }
    const { amount, purpose, notes = {} } = await readBody(req);
    const rupees = Number(amount);
    if (!Number.isFinite(rupees) || rupees < 1) {
      return sendJson(res, 400, { success: false, message: "Enter a valid amount." });
    }
    const order = await razorpayRequest("/v1/orders", {
      amount: Math.round(rupees * 100),
      currency: "INR",
      receipt: `ch_${Date.now()}`,
      notes: { purpose: purpose || "Connect Hub payment", ...notes }
    });
    return sendJson(res, 200, { success: true, order, keyId: process.env.RAZORPAY_KEY_ID });
  }

  if (route === "/api/payments/verify" && req.method === "POST") {
    if (!razorpayConfigured()) {
      return sendJson(res, 503, { success: false, message: "Razorpay is not configured yet." });
    }
    const body = await readBody(req);
    const ok = verifyRazorpaySignature(body);
    return sendJson(res, ok ? 200 : 400, { success: ok, message: ok ? "Payment verified." : "Payment verification failed." });
  }

  sendJson(res, 404, { success: false, message: "API route not found." });
}

ensureDataFiles();

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res).catch(error => sendJson(res, 500, { success: false, message: error.message }));
    return;
  }
  serveStatic(req, res);
});

if (Server) {
  const io = new Server(server, {
    cors: { origin: "*" },
    pingInterval: 25000,
    pingTimeout: 20000
  });
  socketIO = io;
  try {
    const { registerAiHubSocket } = require("./services/socketService");
    registerAiHubSocket(io, { publicDB });
  } catch {}

  io.on("connection", socket => {
    const joinUserRoom = name => {
      const safeName = String(name || "").slice(0, 80);
      if (!safeName) return;
      socket.data.name = safeName;
      socket.data.userNames = socket.data.userNames || new Set();
      socket.data.userNames.add(safeName);
      const sockets = onlineUsers.get(safeName) || new Set();
      sockets.add(socket.id);
      onlineUsers.set(safeName, sockets);
      socket.join(`user:${safeName}`);
      socket.join(`user_${safeName}`);
      setProfilePresence([safeName], true);
      io.emit("presence:update", Array.from(onlineUsers.keys()));
      io.emit("user_online", { userId: safeName, name: safeName });
      io.emit("user_status", { userId: safeName, name: safeName, isOnline: true });
      socket.emit("realtime:status", realtimeSummary().realtime);
    };

    socket.on("authenticate", payload => {
      const names = [
        payload?.name,
        payload?.userId,
        payload?.username,
        payload?.email
      ].filter(Boolean);
      names.forEach(joinUserRoom);
    });

    socket.on("user:online", name => {
      joinUserRoom(name);
    });

    socket.on("join", name => {
      joinUserRoom(name);
    });

    socket.on("conversation:join", conversationId => {
      const id = String(conversationId || "").slice(0, 120);
      if (id) socket.join(`conversation:${id}`);
    });

    socket.on("conversation:leave", conversationId => {
      const id = String(conversationId || "").slice(0, 120);
      if (id) socket.leave(`conversation:${id}`);
    });

    socket.on("state:request", () => {
      socket.emit("state:updated", { reason: "socket-request", summary: realtimeSummary().counts, emittedAt: new Date().toISOString() });
      socket.emit("realtime:status", realtimeSummary().realtime);
    });

    socket.on("pong_keepalive", payload => {
      socket.data.lastPongAt = Date.now();
      socket.data.lastPongClientAt = payload?.t || null;
    });

    socket.on("message:typing", payload => {
      const to = String(payload?.recipientId || payload?.to || "").slice(0, 80);
      if (to) socket.to(`user:${to}`).emit("message:typing", { ...payload, from: socket.data.name });
    });

    socket.on("typing", payload => {
      const to = String(payload?.recipientId || payload?.to || "").slice(0, 80);
      const from = socket.data.name || payload?.from || payload?.fromUserId || "";
      if (to) socket.to(`user:${to}`).emit("typing", { userId: from, from, fromUserId: from });
    });

    socket.on("stop_typing", payload => {
      const to = String(payload?.recipientId || payload?.to || payload?.toUserId || "").slice(0, 80);
      const from = socket.data.name || payload?.from || payload?.fromUserId || "";
      if (to) socket.to(`user:${to}`).emit("stop_typing", { userId: from, from, fromUserId: from });
    });

    socket.on("messages_read", payload => {
      const senderId = String(payload?.senderId || payload?.from || "").slice(0, 80);
      const receiverId = String(payload?.receiverId || socket.data.name || payload?.by || "").slice(0, 80);
      if (!senderId || !receiverId) return;
      const db = readJson(DB_FILE, INITIAL_DB);
      const seenIds = [];
      (db.messages || []).forEach(message => {
        if (message.from === senderId && message.to === receiverId && !message.read) {
          message.read = true;
          message.status = "seen";
          message.readAt = message.readAt || new Date().toISOString();
          message.seenAt = message.seenAt || message.readAt;
          seenIds.push(message.id);
        }
      });
      if (seenIds.length) {
        writeJson(DB_FILE, db);
        io.to(`user:${senderId}`).emit("messages_seen", { by: receiverId, messageIds: seenIds, conversationWith: receiverId });
        io.to(`user:${senderId}`).emit("messages_read", { receiverId, messageIds: seenIds });
      }
    });

    socket.on("message:send", message => {
      const incomingId = String(message?.id || "").slice(0, 80);
      const text = extractMessageContent(message || {}).slice(0, 600);
      const attachment = message?.attachment || null;
      const mediaUrl = message?.mediaUrl || attachment?.dataUrl || null;
      const type = String(message?.type || message?.kind || (mediaUrl ? "image" : "text")).slice(0, 30);
      const safeMessage = {
        id: incomingId || `msg-${Date.now()}`,
        from: String(message?.from || socket.data.name || "").slice(0, 80),
        to: String(message?.to || "").slice(0, 80),
        text,
        content: text,
        kind: type,
        type,
        mediaUrl,
        attachment,
        reactions: [],
        status: "sent",
        deliveredAt: null,
        seenAt: null,
        read: false,
        createdAt: message?.createdAt || new Date().toISOString()
      };
      if (!safeMessage.from || !safeMessage.to || (!safeMessage.text && !safeMessage.attachment && !safeMessage.mediaUrl)) return;

      const db = readJson(DB_FILE, INITIAL_DB);
      db.messages = db.messages || [];
      db.notifications = db.notifications || [];
      if (!db.messages.some(item => item.id === safeMessage.id)) {
        db.messages.push(safeMessage);
      }
      createNotification(db, safeMessage.to, "message", `New message from ${safeMessage.from}`, { id: `not-${safeMessage.id}`, from: safeMessage.from, messageId: safeMessage.id, createdAt: safeMessage.createdAt });
      writeJson(DB_FILE, db);
      const receiverRoom = io.sockets.adapter.rooms.get(`user:${safeMessage.to}`) || io.sockets.adapter.rooms.get(`user_${safeMessage.to}`);
      const isReceiverOnline = receiverRoom && receiverRoom.size > 0;
      if (isReceiverOnline) {
        safeMessage.status = "delivered";
        safeMessage.deliveredAt = new Date().toISOString();
        const freshDb = readJson(DB_FILE, INITIAL_DB);
        const stored = (freshDb.messages || []).find(item => item.id === safeMessage.id);
        if (stored) {
          stored.status = safeMessage.status;
          stored.deliveredAt = safeMessage.deliveredAt;
          writeJson(DB_FILE, freshDb);
        }
      }
      const normalized = normalizeStoredMessage(safeMessage, publicDB(), null, null);

      socket.emit("message:new", normalized);
      io.to(`user:${safeMessage.to}`).emit("message:new", normalized);
      io.to(`user:${safeMessage.to}`).emit("new_message", { message: normalized, conversationWith: safeMessage.from });
      io.to(`user_${safeMessage.to}`).emit("new_message", { message: normalized, conversationWith: safeMessage.from });
      io.to(`conversation:${[safeMessage.from, safeMessage.to].sort().join("__")}`).emit("message:new", normalized);
      if (isReceiverOnline) socket.emit("message_delivered", { messageId: safeMessage.id, conversationWith: safeMessage.to });
    });

    socket.on("disconnect", () => {
      const joinedNames = Array.from(socket.data.userNames || (socket.data.name ? [socket.data.name] : []));
      joinedNames.forEach(name => {
        const sockets = onlineUsers.get(name);
        if (sockets) {
          sockets.delete(socket.id);
          if (!sockets.size) onlineUsers.delete(name);
        }
      });
      io.emit("presence:update", Array.from(onlineUsers.keys()));
      joinedNames
        .filter(name => !onlineUsers.has(name))
        .forEach(name => {
          const lastSeen = new Date().toISOString();
          setProfilePresence([name], false);
          io.emit("user_offline", { userId: name, name, lastSeen });
          io.emit("user_status", { userId: name, name, isOnline: false, lastSeen });
        });
      io.emit("realtime:status", realtimeSummary().realtime);
    });
  });

  const keepaliveTimer = setInterval(() => {
    io.emit("ping_keepalive", { t: Date.now() });
    io.emit("realtime:status", realtimeSummary().realtime);
  }, 25000);
  keepaliveTimer.unref?.();
}

server.listen(PORT, () => {
  console.log(`Connect Hub backend running at http://localhost:${PORT}`);
});
