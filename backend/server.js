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

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = process.env.CONNECTHUB_DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "connecthub-db.json");
const USERS_FILE = path.join(DATA_DIR, "connecthub-users.json");
const OTP_FILE = path.join(DATA_DIR, "connecthub-otps.json");
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "connecthub-free-tier-dev-secret-change-in-render";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) writeJson(DB_FILE, INITIAL_DB);
  if (!fs.existsSync(USERS_FILE)) writeJson(USERS_FILE, {});
  if (!fs.existsSync(OTP_FILE)) writeJson(OTP_FILE, {});
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
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
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
      const inferredSkills = searchTerms.filter(term => /design|editor|editing|video|reel|photo|camera|developer|marketing|sales|branding|ai|web|app/i.test(term));
      return {
        ...profile,
        handle: profileHandle(profile),
        companyName: profile.companyName || startup?.name || "",
        sector: startup?.sector || profile.sector || "",
        city: profile.city || startup?.city || "",
        state: profile.state || startup?.state || "",
        skills: [...new Set([...(profile.skills || []), ...inferredSkills].map(String))].slice(0, 12),
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
      companyName: profile.companyName || "",
      mutualConnections: mutualConnectionCount(db, currentName, profile.name),
      avatarInitials: profile.avatarInitials || initialsFor(profile.name || "CH"),
      avatarPhoto: profile.avatarPhoto || null,
      bio: profile.bio || "",
      profileUrl: profileUrlFor(profile, req)
    }));
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
      const close = haystack.split(/\s+/).some(word => word.length > 3 && editDistance(word, term) <= 2);
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

function authUserKey(auth) {
  return normalizeEmail(auth?.email) || String(auth?.name || auth?.id || "").trim().toLowerCase();
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
  return note;
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
    avatarInitials: initials,
    avatarPhoto: additionalInfo.avatarPhoto || null,
    city: additionalInfo.city || "",
    state: additionalInfo.state || "",
    location: additionalInfo.location || null,
    bio: additionalInfo.bio || "",
    skills: additionalInfo.skills || []
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
    : /^\/feed\/?$/.test(urlPath)
      ? "/dashboard-freelancer.html"
    : /^\/settings\/?$/.test(urlPath)
      ? "/dashboard-freelancer.html"
    : /^\/profile\/[^/]+\/?$/.test(urlPath)
      ? "/profile.html"
      : /^\/dashboard\/aihub\/?$/.test(urlPath)
        ? "/frontend/aihub/aihub.html"
        : urlPath;
  const filePath = path.normalize(path.join(ROOT_DIR, requestedPath));

  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      fs.readFile(path.join(ROOT_DIR, "index.html"), (fallbackError, fallbackContent) => {
        if (fallbackError) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html" });
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
    res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
    res.end(content);
  });
}

async function handleApi(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = url.pathname;
  const auth = authFromRequest(req);

  if (route === "/api/health") return sendJson(res, 200, { ok: true });
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
    const profile = auth?.email ? (readJson(USERS_FILE, {})[auth.email]?.profile || DEMO_USERS[auth.email]) : null;
    return sendJson(res, profile ? 200 : 401, profile ? { success: true, user: { ...profile, email: auth.email } } : { success: false, message: "Not signed in." });
  }
  if (route === "/api/users/me" && req.method === "PUT") {
    const body = await readBody(req);
    const users = readJson(USERS_FILE, {});
    const email = normalizeEmail(auth?.email || body.email);
    if (!email || !users[email]) return sendJson(res, 404, { success: false, message: "Profile account not found." });
    users[email].profile = { ...users[email].profile, ...body };
    writeJson(USERS_FILE, users);
    return sendJson(res, 200, { success: true, user: users[email].profile });
  }
  if (route === "/api/users/search" && req.method === "GET") {
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
  if ((route === "/api/v1/posts/search" || route === "/api/posts/search") && req.method === "GET") {
    const db = publicDB();
    const data = searchPostsInDB(db, {
      query: url.searchParams.get("q") || "",
      page: url.searchParams.get("page") || 1,
      limit: url.searchParams.get("limit") || 20
    });
    return sendJson(res, 200, { success: true, ...data });
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

  if (route === "/api/posts/feed" && req.method === "GET") return sendJson(res, 200, { success: true, posts: publicDB().profilePosts || [] });
  if (route === "/api/posts" && req.method === "POST") {
    const body = await readBody(req);
    const db = readJson(DB_FILE, INITIAL_DB);
    const post = { id: `post-${Date.now()}`, author: auth?.name || body.author || "ConnectHub member", content: body.content || "", images: body.images || [], hashtags: body.hashtags || [], likes: [], comments: [], saves: [], createdAt: new Date().toISOString() };
    db.profilePosts = [...(db.profilePosts || []), post];
    writeJson(DB_FILE, db);
    return sendJson(res, 200, { success: true, post, db: publicDB() });
  }
  if (route.match(/^\/api\/posts\/[^/]+\/like$/) && req.method === "PUT") {
    const id = route.split("/")[3];
    const db = readJson(DB_FILE, INITIAL_DB);
    const post = (db.profilePosts || []).find(item => item.id === id);
    if (!post) return sendJson(res, 404, { success: false, message: "Post not found." });
    post.likes = post.likes || [];
    if (!post.likes.includes(auth?.name || "guest")) post.likes.push(auth?.name || "guest");
    writeJson(DB_FILE, db);
    return sendJson(res, 200, { success: true, post, db: publicDB() });
  }
  if (route.match(/^\/api\/posts\/[^/]+\/comment$/) && req.method === "POST") {
    const id = route.split("/")[3];
    const body = await readBody(req);
    const db = readJson(DB_FILE, INITIAL_DB);
    const post = (db.profilePosts || []).find(item => item.id === id);
    if (!post) return sendJson(res, 404, { success: false, message: "Post not found." });
    post.comments = post.comments || [];
    post.comments.push({ user: auth?.name || body.user || "Guest", text: body.text || "", createdAt: new Date().toISOString() });
    writeJson(DB_FILE, db);
    return sendJson(res, 200, { success: true, post, db: publicDB() });
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
    return sendJson(res, 200, { success: true, conversations: rows });
  }
  if (route.match(/^\/api\/messages\/[^/]+$/) && req.method === "GET") {
    const other = decodeURIComponent(route.replace("/api/messages/", ""));
    const userName = auth?.name || url.searchParams.get("user") || "";
    const messages = (publicDB().messages || []).filter(message =>
      (message.from === userName && (message.to === other || message.to === decodeURIComponent(other))) ||
      (message.to === userName && (message.from === other || message.from === decodeURIComponent(other)))
    );
    return sendJson(res, 200, { success: true, messages });
  }
  if (route === "/api/messages" && req.method === "POST") {
    const body = await readBody(req);
    req.url = "/api/messages/send";
    body.from = body.from || auth?.name;
    body.to = body.to || body.receiver;
    body.text = body.text || body.content;
    const db = readJson(DB_FILE, INITIAL_DB);
    const message = { id: `msg-${Date.now()}`, from: body.from, to: body.to, text: body.text, attachment: body.mediaUrl || body.attachment || "", read: false, createdAt: new Date().toISOString() };
    if (!message.from || !message.to || !message.text) return sendJson(res, 400, { success: false, message: "Message sender, recipient, and content are required." });
    db.messages = [...(db.messages || []), message];
    writeJson(DB_FILE, db);
    return sendJson(res, 200, { success: true, message, db: publicDB() });
  }
  if (route === "/api/notifications/read" && req.method === "PUT") {
    const db = readJson(DB_FILE, INITIAL_DB);
    (db.notifications || []).forEach(note => { note.read = true; });
    writeJson(DB_FILE, db);
    return sendJson(res, 200, { success: true, db: publicDB() });
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
    return sendJson(res, 200, { success: true, db: publicDB() });
  }

  if ((route === "/api/login" || route === "/api/auth/login") && req.method === "POST") {
    const { email: rawEmail, password } = await readBody(req);
    const email = normalizeEmail(rawEmail);
    if (DEMO_USERS[email]) {
      const user = { ...DEMO_USERS[email], email };
      return sendJson(res, 200, { success: true, user, token: signToken({ email, name: user.name, role: user.role }) });
    }
    const users = readJson(USERS_FILE, {});
    if (users[email] && verifyPassword(password, users[email])) {
      const user = users[email].profile;
      return sendJson(res, 200, { success: true, user, token: signToken({ email, name: user.name, role: user.role }) });
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
    users[email] = { passwordHash: passwordData.hash, passwordSalt: passwordData.salt, profile };
    writeJson(USERS_FILE, users);
    return sendJson(res, 200, { success: true, user: profile, token: signToken({ email, name: profile.name, role: profile.role }), db: publicDB() });
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
    return sendJson(res, 200, { success: true, user: safeProfile });
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
    const from = String(auth?.name || body.from || "").slice(0, 80);
    const to = String(body.to || "").slice(0, 80);
    const text = String(body.text || "").slice(0, 600);
    if (!from || !to || (!text && !body.attachment)) return sendJson(res, 400, { success: false, message: "Message sender, recipient, and content are required." });
    const message = {
      id: String(body.id || `msg-${Date.now()}`).slice(0, 80),
      from,
      to,
      text,
      kind: String(body.kind || "text").slice(0, 30),
      attachment: body.attachment || null,
      read: false,
      createdAt: body.createdAt || new Date().toISOString()
    };
    const db = readJson(DB_FILE, INITIAL_DB);
    db.messages = db.messages || [];
    if (!db.messages.some(item => item.id === message.id)) db.messages.push(message);
    createNotification(db, to, "message", `New message from ${from}`, { id: `not-${message.id}`, messageId: message.id });
    writeJson(DB_FILE, db);
    const recipient = profileByName(to);
    sendEmailNotification(recipient?.email, "New Connect Hub message", `${from}: ${text}`).catch(() => {});
    return sendJson(res, 200, { success: true, message, db: publicDB() });
  }

  if (route === "/api/messages/inbox" && req.method === "GET") {
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
    writeJson(DB_FILE, db);
    return sendJson(res, 200, { success: true, connection, db: publicDB() });
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

  if (route === "/api/admin/summary" && req.method === "GET") {
    const isAdmin = auth?.role === "admin" || normalizeEmail(auth?.email) === normalizeEmail(process.env.ADMIN_EMAIL);
    if (!isAdmin) return sendJson(res, 403, { success: false, message: "Admin access required." });
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
  const io = new Server(server, { cors: { origin: "*" } });
  const onlineUsers = new Map();
  try {
    const { registerAiHubSocket } = require("./services/socketService");
    registerAiHubSocket(io, { publicDB });
  } catch {}

  io.on("connection", socket => {
    socket.on("user:online", name => {
      const safeName = String(name || "").slice(0, 80);
      if (!safeName) return;
      socket.data.name = safeName;
      onlineUsers.set(safeName, socket.id);
      io.emit("presence:update", Array.from(onlineUsers.keys()));
    });

    socket.on("message:send", message => {
      const incomingId = String(message?.id || "").slice(0, 80);
      const safeMessage = {
        id: incomingId || `msg-${Date.now()}`,
        from: String(message?.from || socket.data.name || "").slice(0, 80),
        to: String(message?.to || "").slice(0, 80),
        text: String(message?.text || "").slice(0, 600),
        kind: String(message?.kind || "text").slice(0, 30),
        attachment: message?.attachment || null,
        read: false,
        createdAt: message?.createdAt || new Date().toISOString()
      };
      if (!safeMessage.from || !safeMessage.to || (!safeMessage.text && !safeMessage.attachment)) return;

      const db = readJson(DB_FILE, INITIAL_DB);
      db.messages = db.messages || [];
      db.notifications = db.notifications || [];
      if (!db.messages.some(item => item.id === safeMessage.id)) {
        db.messages.push(safeMessage);
      }
      const notificationId = `not-${safeMessage.id}`;
      if (!db.notifications.some(item => item.id === notificationId)) {
        db.notifications.push({
          id: notificationId,
          to: safeMessage.to,
          type: "message",
          text: `New message from ${safeMessage.from}`,
          read: false,
          createdAt: safeMessage.createdAt
        });
      }
      writeJson(DB_FILE, db);

      socket.emit("message:new", safeMessage);
      const targetSocket = onlineUsers.get(safeMessage.to);
      if (targetSocket) io.to(targetSocket).emit("message:new", safeMessage);
    });

    socket.on("disconnect", () => {
      if (socket.data.name) onlineUsers.delete(socket.data.name);
      io.emit("presence:update", Array.from(onlineUsers.keys()));
    });
  });
}

server.listen(PORT, () => {
  console.log(`Connect Hub backend running at http://localhost:${PORT}`);
});
