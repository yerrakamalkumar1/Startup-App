// ConnectHub - local demo database and session persistence

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
      applicants: 4
    },
    {
      id: "job-2",
      startupId: "st-2",
      title: "Product Walkthrough Video Editor",
      description: "Create short walkthrough videos and polished social clips for a new customer-facing campaign.",
      tags: ["Video Editing", "Reels", "Campaign"],
      hourlyRate: 1200,
      estimatedHours: 8,
      status: "Active",
      applicants: 2
    },
    {
      id: "job-3",
      startupId: "st-3",
      title: "Operations Dashboard Integrator",
      description: "Connect internal tools with order tracking, lead tracking, and basic reporting for daily decisions.",
      tags: ["Automation", "Dashboard", "NodeJS"],
      hourlyRate: 800,
      estimatedHours: 25,
      status: "Active",
      applicants: 3
    }
  ],

  // Chain system: freelancers publish service ads, and every startup dashboard can discover them.
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
      contactPhone: "6301394850"
    },
    {
      id: "fa-2",
      freelancerName: "Sarah Jenkins",
      title: "Short-Form Video Editing",
      price: "Rs 12,000",
      category: "Video & Reels",
      description: "Polished short videos with captions, hooks, transitions, and platform-ready export formats.",
      tags: ["Video Editing", "Reels", "Premiere Pro"],
      appliedDate: "20 May 2026",
      contactPhone: "6301394850"
    }
  ],

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

  events: [
    {
      id: "ev-1",
      title: "Indian Startup Operator Summit 2026",
      host: "ConnectHub Partners",
      day: "28",
      month: "May",
      time: "5:00 PM IST",
      rsvpCount: 84,
      registered: false,
      description: "Networking event for founders, freelancers, operators, and partner teams across categories."
    },
    {
      id: "ev-2",
      title: "Growth, Capital & Creator Network",
      host: "UrbanNest Platforms",
      day: "06",
      month: "Jun",
      time: "3:00 PM IST",
      rsvpCount: 120,
      registered: false,
      description: "Pitch session for startups using media, local operations, AI, and partner-led growth."
    }
  ],

  investments: [
    {
      id: "inv-1",
      startupName: "NexaLocal Commerce",
      amount: "Rs 5,00,000",
      date: "15 May 2026",
      equity: "2.0%"
    }
  ]
};

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

const STARTUP_SECTORS = [
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
  "Manufacturing & Hardware",
  "Other"
];

const SERVICE_CATEGORIES = [
  "Branding & Creative",
  "Video & Reels",
  "Website & App Development",
  "Marketing & Growth",
  "Photography",
  "Sales & Lead Generation",
  "Operations & Automation",
  "Finance & Compliance",
  "Other"
];

const CONNECTHUB_BACKEND_URL = (
  window.CONNECTHUB_BACKEND_URL ||
  (location.protocol !== "file:" ? location.origin : "")
).replace(/\/$/, "");

async function apiRequest(path, options = {}) {
  if (!CONNECTHUB_BACKEND_URL) throw new Error("Backend is not configured.");
  const res = await fetch(`${CONNECTHUB_BACKEND_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Backend request failed.");
  return data;
}

async function syncFromBackend() {
  if (!CONNECTHUB_BACKEND_URL) return getDB();
  try {
    const data = await apiRequest("/api/state");
    if (data.db) {
      const db = ensureDBShape(data.db);
      localStorage.setItem("connecthub_db", JSON.stringify(db));
      return db;
    }
  } catch (error) {
    console.warn("ConnectHub backend sync failed:", error.message);
  }
  return getDB();
}

async function requestPasswordOtp(email) {
  return apiRequest("/api/password/request", {
    method: "POST",
    body: JSON.stringify({ email: normalizeEmail(email) })
  });
}

async function resetPasswordWithOtp(email, otp, password) {
  return apiRequest("/api/password/reset", {
    method: "POST",
    body: JSON.stringify({ email: normalizeEmail(email), otp, password })
  });
}

async function createRazorpayOrder(amount, purpose, notes = {}) {
  return apiRequest("/api/payments/create-order", {
    method: "POST",
    body: JSON.stringify({ amount, purpose, notes })
  });
}

async function verifyRazorpayPayment(payload) {
  return apiRequest("/api/payments/verify", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

function getDB() {
  const dbStr = localStorage.getItem("connecthub_db");
  if (!dbStr) {
    const freshDB = ensureDBShape(JSON.parse(JSON.stringify(INITIAL_DB)));
    localStorage.setItem("connecthub_db", JSON.stringify(freshDB));
    return freshDB;
  }
  const db = ensureDBShape(JSON.parse(dbStr));
  localStorage.setItem("connecthub_db", JSON.stringify(db));
  return db;
}

function saveDB(db, options = {}) {
  db = ensureDBShape(db);
  localStorage.setItem("connecthub_db", JSON.stringify(db));
  if (CONNECTHUB_BACKEND_URL && !options.localOnly) {
    apiRequest("/api/state", {
      method: "PUT",
      body: JSON.stringify({ db })
    }).catch(error => console.warn("ConnectHub backend save failed:", error.message));
  }
}

function getRegisteredUsers() {
  return JSON.parse(localStorage.getItem("connecthub_registered_users") || "{}");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getPlatformStats() {
  const db = getDB();
  const registeredUsers = Object.values(getRegisteredUsers()).map(entry => entry.profile);
  const demoUsers = Object.values(DEMO_USERS);
  const users = [...demoUsers, ...registeredUsers];
  const freelancers = users.filter(user => user.role === "freelancer").length;
  const investors = users.filter(user => user.role === "investor").length;
  const startupUsers = users.filter(user => user.role === "startup_admin").length;
  const livePosts = (db.jobs?.length || 0) + (db.freelancerAds?.length || 0) + (db.startupPromotions?.length || 0);
  return {
    startups: Math.max(db.startups?.length || 0, startupUsers),
    freelancers,
    investors,
    livePosts,
    ads: db.freelancerAds?.length || 0,
    gigs: db.jobs?.length || 0
  };
}

function ensureDBShape(db) {
  if (!Array.isArray(db.startupPromotions)) db.startupPromotions = [];
  db.freelancerAds = (db.freelancerAds || []).map(ad => ({ media: null, mediaType: "", ...ad }));
  db.jobs = (db.jobs || []).map(job => ({ media: null, mediaType: "", ...job }));
  return db;
}

function fileToMedia(fileInput) {
  const file = fileInput?.files?.[0];
  if (!file) return Promise.resolve(null);
  const isSupported = file.type.startsWith("image/") || file.type.startsWith("video/");
  if (!isSupported) return Promise.reject(new Error("Please upload an image or video file."));
  if (file.size > 2.5 * 1024 * 1024) return Promise.reject(new Error("Keep uploads under 2.5 MB for this static demo app."));

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ dataUrl: reader.result, type: file.type, name: file.name });
    reader.onerror = () => reject(new Error("Could not read that media file."));
    reader.readAsDataURL(file);
  });
}

function renderMedia(media, mediaType) {
  if (!media) return "";
  const type = mediaType || media.type || "";
  if (type.startsWith("video/")) {
    return `<video class="post-media" controls muted playsinline src="${media.dataUrl || media}"></video>`;
  }
  return `<img class="post-media" src="${media.dataUrl || media}" alt="Advertisement media">`;
}

function getCurrentUser() {
  const userStr = localStorage.getItem("connecthub_user");
  return userStr ? JSON.parse(userStr) : null;
}

function setCurrentUser(user) {
  localStorage.setItem("connecthub_user", JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem("connecthub_user");
}

async function authenticateUser(email, password) {
  email = normalizeEmail(email);
  if (CONNECTHUB_BACKEND_URL) {
    const result = await apiRequest("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    if (result.success) setCurrentUser(result.user);
    return result;
  }

  if (DEMO_USERS[email]) {
    setCurrentUser(DEMO_USERS[email]);
    return { success: true, user: DEMO_USERS[email] };
  }

  const registeredUsers = getRegisteredUsers();
  if (registeredUsers[email] && registeredUsers[email].password === password) {
    const user = registeredUsers[email].profile;
    setCurrentUser(user);
    return { success: true, user };
  }

  return { success: false, message: "Invalid email or passcode." };
}

async function registerUser(name, email, password, role, title, additionalInfo) {
  email = normalizeEmail(email);
  if (CONNECTHUB_BACKEND_URL) {
    const result = await apiRequest("/api/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, role, title, additionalInfo })
    });
    if (result.db) saveDB(result.db, { localOnly: true });
    if (result.success) setCurrentUser(result.user);
    return result;
  }

  const registeredUsers = getRegisteredUsers();

  if (DEMO_USERS[email] || registeredUsers[email]) {
    return { success: false, message: "Email account already registered." };
  }

  const db = getDB();
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().substring(0, 2);
  const userProfile = {
    name,
    role,
    title,
    avatarInitials: initials
  };

  if (role === "freelancer") {
    userProfile.earnings = "Rs 0";
    userProfile.activeContracts = 0;
  } else if (role === "startup_admin") {
    const newStartupId = `st-${Date.now()}`;
    const newStartup = {
      id: newStartupId,
      name: additionalInfo.companyName || `${name}'s Business`,
      sector: additionalInfo.sector || "Commerce & Retail",
      stage: "Pre-seed",
      valuation: "Rs 10 Lakh",
      raised: "Rs 0",
      target: additionalInfo.targetFunding || "Rs 5 Lakh",
      description: "Local Indian startup looking for freelancers, partners, and sponsors.",
      logoColor: "#0f766e",
      logoInitials: initials,
      views: [10, 15, 20, 22, 28, 35, 40],
      engagement: [0, 1, 1, 2, 2, 3, 4]
    };
    db.startups.push(newStartup);
    saveDB(db);

    userProfile.startupId = newStartupId;
    userProfile.companyName = newStartup.name;
    userProfile.title = `Founder, ${newStartup.name}`;
  } else if (role === "investor") {
    userProfile.fundsCommitted = "Rs 0";
    userProfile.portfolioSize = 0;
    userProfile.title = additionalInfo.firmName ? `Partner, ${additionalInfo.firmName}` : "Angel Sponsor";
  }

  registeredUsers[email] = { password, profile: userProfile };
  localStorage.setItem("connecthub_registered_users", JSON.stringify(registeredUsers));
  setCurrentUser(userProfile);
  return { success: true, user: userProfile };
}

function getDashboardUrl(role) {
  if (role === "freelancer") return "dashboard-freelancer.html";
  if (role === "startup_admin") return "dashboard-startup.html";
  if (role === "investor") return "dashboard-investor.html";
  return "index.html";
}

function handleLogout() {
  clearSession();
  window.location.href = "index.html";
}
