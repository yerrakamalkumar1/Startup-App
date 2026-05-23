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

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = process.env.CONNECTHUB_DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "connecthub-db.json");
const USERS_FILE = path.join(DATA_DIR, "connecthub-users.json");
const OTP_FILE = path.join(DATA_DIR, "connecthub-otps.json");

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
  notifications: []
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

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
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
  return Boolean(nodemailer && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendOtpEmail(email, otp) {
  if (!isSmtpConfigured()) {
    throw new Error("Email OTP is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM in Render.");
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
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
  const requestedPath = urlPath === "/" ? "/index.html" : urlPath;
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

  if (req.url === "/api/health") return sendJson(res, 200, { ok: true });

  if (req.url === "/api/state" && req.method === "GET") {
    return sendJson(res, 200, { db: readJson(DB_FILE, INITIAL_DB) });
  }

  if (req.url === "/api/state" && req.method === "PUT") {
    const body = await readBody(req);
    if (!body.db) return sendJson(res, 400, { success: false, message: "Missing db payload." });
    writeJson(DB_FILE, body.db);
    return sendJson(res, 200, { success: true, db: body.db });
  }

  if (req.url === "/api/login" && req.method === "POST") {
    const { email: rawEmail, password } = await readBody(req);
    const email = normalizeEmail(rawEmail);
    if (DEMO_USERS[email]) return sendJson(res, 200, { success: true, user: DEMO_USERS[email] });
    const users = readJson(USERS_FILE, {});
    if (users[email] && verifyPassword(password, users[email])) {
      return sendJson(res, 200, { success: true, user: users[email].profile });
    }
    return sendJson(res, 401, { success: false, message: "Invalid email or passcode." });
  }

  if (req.url === "/api/register" && req.method === "POST") {
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
    return sendJson(res, 200, { success: true, user: profile, db: readJson(DB_FILE, INITIAL_DB) });
  }

  if (req.url === "/api/register/request-otp" && req.method === "POST") {
    const { email: rawEmail } = await readBody(req);
    const email = normalizeEmail(rawEmail);
    const users = readJson(USERS_FILE, {});
    if (!email) return sendJson(res, 400, { success: false, message: "Email is required." });
    if (DEMO_USERS[email] || users[email]) {
      return sendJson(res, 409, { success: false, message: "Email account already registered." });
    }
    const otp = createOtp(`register:${email}`);
    await sendOtpEmail(email, otp);
    return sendJson(res, 200, { success: true, message: "Registration OTP sent to your email." });
  }

  if (req.url === "/api/register/verify-otp" && req.method === "POST") {
    const { email: rawEmail, otp } = await readBody(req);
    const email = normalizeEmail(rawEmail);
    if (!verifyOtp(`register:${email}`, otp)) {
      return sendJson(res, 400, { success: false, message: "Invalid or expired registration OTP." });
    }
    return sendJson(res, 200, { success: true, message: "Email verified." });
  }

  if (req.url === "/api/password/request" && req.method === "POST") {
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

  if (req.url === "/api/password/reset" && req.method === "POST") {
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

  if (req.url === "/api/payments/razorpay-key" && req.method === "GET") {
    if (!razorpayConfigured()) {
      return sendJson(res, 503, { success: false, message: "Razorpay is not configured yet." });
    }
    return sendJson(res, 200, { success: true, keyId: process.env.RAZORPAY_KEY_ID });
  }

  if (req.url === "/api/payments/create-order" && req.method === "POST") {
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

  if (req.url === "/api/payments/verify" && req.method === "POST") {
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

  io.on("connection", socket => {
    socket.on("user:online", name => {
      const safeName = String(name || "").slice(0, 80);
      if (!safeName) return;
      socket.data.name = safeName;
      onlineUsers.set(safeName, socket.id);
      io.emit("presence:update", Array.from(onlineUsers.keys()));
    });

    socket.on("message:send", message => {
      const safeMessage = {
        id: `msg-${Date.now()}`,
        from: String(message?.from || socket.data.name || "").slice(0, 80),
        to: String(message?.to || "").slice(0, 80),
        text: String(message?.text || "").slice(0, 600),
        read: false,
        createdAt: new Date().toISOString()
      };
      if (!safeMessage.from || !safeMessage.to || !safeMessage.text) return;

      const db = readJson(DB_FILE, INITIAL_DB);
      db.messages = db.messages || [];
      db.notifications = db.notifications || [];
      db.messages.push(safeMessage);
      db.notifications.push({
        id: `not-${Date.now()}`,
        to: safeMessage.to,
        type: "message",
        text: `New message from ${safeMessage.from}`,
        read: false,
        createdAt: safeMessage.createdAt
      });
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
