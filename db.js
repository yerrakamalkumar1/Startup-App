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
      city: "Hyderabad",
      state: "Telangana",
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
      city: "Bengaluru",
      state: "Karnataka",
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
      city: "Mumbai",
      state: "Maharashtra",
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
      city: "Hyderabad",
      state: "Telangana",
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
      city: "Hyderabad",
      state: "Telangana",
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
    city: "Hyderabad",
    state: "Telangana",
    bio: "Brand and growth designer for launch-stage Indian startups.",
    skills: ["Branding", "Social Media", "Reels"],
    earnings: "Rs 18,500",
    activeContracts: 1
  },
  "rohan@connecthub.in": {
    name: "Rohan Sharma",
    role: "startup_admin",
    title: "Founder, NexaLocal Commerce",
    avatarInitials: "RS",
    startupId: "st-1",
    companyName: "NexaLocal Commerce",
    city: "Hyderabad",
    state: "Telangana",
    bio: "Founder building local commerce systems for Indian businesses."
  },
  "ananya@connecthub.in": {
    name: "Ananya Sen",
    role: "investor",
    title: "Partner, India Venture Fund",
    avatarInitials: "AS",
    city: "Mumbai",
    state: "Maharashtra",
    bio: "Angel sponsor backing useful Indian startup networks.",
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
      ...(localStorage.getItem("connecthub_token") ? { Authorization: `Bearer ${localStorage.getItem("connecthub_token")}` } : {}),
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
      const db = mergeDBState(getDB(), data.db);
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

function mergeById(localItems = [], remoteItems = []) {
  const map = new Map();
  [...localItems, ...remoteItems].forEach(item => {
    if (!item) return;
    const key = item.id || item.email || `${item.from || ""}-${item.to || ""}-${item.createdAt || ""}-${item.text || item.name || ""}`;
    map.set(key, { ...(map.get(key) || {}), ...item });
  });
  return Array.from(map.values());
}

function mergeDBState(localDB, remoteDB) {
  const local = ensureDBShape(localDB || {});
  const remote = ensureDBShape(remoteDB || {});
  return ensureDBShape({
    ...local,
    ...remote,
    startups: mergeById(local.startups, remote.startups),
    jobs: mergeById(local.jobs, remote.jobs),
    freelancerAds: mergeById(local.freelancerAds, remote.freelancerAds),
    startupPromotions: mergeById(local.startupPromotions, remote.startupPromotions),
    applications: mergeById(local.applications, remote.applications),
    events: mergeById(local.events, remote.events),
    investments: mergeById(local.investments, remote.investments),
    connections: mergeById(local.connections, remote.connections),
    messages: mergeById(local.messages, remote.messages),
    notifications: mergeById(local.notifications, remote.notifications),
    profilePosts: mergeById(local.profilePosts, remote.profilePosts),
    postInteractions: mergeById(local.postInteractions, remote.postInteractions),
    investorInterests: mergeById(local.investorInterests, remote.investorInterests),
    reviews: mergeById(local.reviews, remote.reviews),
    registeredProfiles: mergeById(local.registeredProfiles, remote.registeredProfiles)
  });
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
  const livePosts = (db.jobs?.length || 0) + (db.freelancerAds?.length || 0) + (db.startupPromotions?.length || 0) + (db.profilePosts?.length || 0);
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
  if (!Array.isArray(db.connections)) db.connections = [];
  if (!Array.isArray(db.messages)) db.messages = [];
  if (!Array.isArray(db.notifications)) db.notifications = [];
  if (!Array.isArray(db.profilePosts)) db.profilePosts = [];
  if (!Array.isArray(db.postInteractions)) db.postInteractions = [];
  if (!Array.isArray(db.registeredProfiles)) db.registeredProfiles = [];
  if (!Array.isArray(db.investorInterests)) db.investorInterests = [];
  if (!Array.isArray(db.reviews)) db.reviews = [];
  db.freelancerAds = (db.freelancerAds || []).map(ad => ({ media: null, mediaType: "", ...ad }));
  db.jobs = (db.jobs || []).map(job => ({ media: null, mediaType: "", ...job }));
  db.startups = (db.startups || []).map(startup => ({ city: "", state: "", ...startup }));
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

function fileToAvatar(fileInput) {
  const file = fileInput?.files?.[0];
  if (!file) return Promise.resolve(null);
  const isSupported = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  if (!isSupported) return Promise.reject(new Error("Use a JPG, PNG, or WebP profile photo."));
  if (file.size > 900 * 1024) return Promise.reject(new Error("Keep profile photos under 900 KB for this free demo storage."));

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ dataUrl: reader.result, type: file.type, name: file.name });
    reader.onerror = () => reject(new Error("Could not read that profile photo."));
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

function avatarMarkup(profile, className = "user-avatar") {
  const initials = profile?.avatarInitials || initialsForName(profile?.name || profile?.companyName || "CH");
  if (profile?.avatarPhoto?.dataUrl) {
    return `<img class="${className} avatar-img" src="${profile.avatarPhoto.dataUrl}" alt="${profile.name || 'Profile'}">`;
  }
  return `<div class="${className}">${initials}</div>`;
}

function initialsForName(name) {
  return String(name || "CH").split(" ").map(word => word[0]).join("").toUpperCase().substring(0, 2);
}

function getCurrentUser() {
  const userStr = localStorage.getItem("connecthub_user");
  return userStr ? JSON.parse(userStr) : null;
}

function setCurrentUser(user) {
  localStorage.setItem("connecthub_user", JSON.stringify(user));
}

function setSession(user, token) {
  setCurrentUser(user);
  if (token) localStorage.setItem("connecthub_token", token);
}

function saveCurrentUser(user) {
  setCurrentUser(user);
  const email = normalizeEmail(user.email);
  if (!email) return;
  const users = getRegisteredUsers();
  if (users[email]) {
    users[email].profile = user;
    localStorage.setItem("connecthub_registered_users", JSON.stringify(users));
  }
  if (CONNECTHUB_BACKEND_URL) {
    apiRequest("/api/profile/update", {
      method: "POST",
      body: JSON.stringify({ email, profile: user })
    }).catch(error => console.warn("ConnectHub profile save failed:", error.message));
  }
}

function clearSession() {
  localStorage.removeItem("connecthub_user");
  localStorage.removeItem("connecthub_token");
}

async function authenticateUser(email, password) {
  email = normalizeEmail(email);
  if (CONNECTHUB_BACKEND_URL) {
    const result = await apiRequest("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    if (result.success) setSession(result.user, result.token);
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
    if (result.success) setSession(result.user, result.token);
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
    email,
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
      city: additionalInfo.city || "",
      state: additionalInfo.state || "",
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

function calculateProfileCompleteness(profile) {
  const checks = [
    profile?.name,
    profile?.title,
    profile?.bio,
    profile?.avatarPhoto?.dataUrl,
    profile?.city,
    profile?.state,
    profile?.skills?.length || profile?.companyName,
    profile?.location?.latitude
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function getAllProfiles() {
  const db = getDB();
  const seen = new Set();
  const users = [
    ...Object.entries(DEMO_USERS).map(([email, profile]) => ({ ...profile, email })),
    ...Object.values(getRegisteredUsers()).map(entry => entry.profile),
    ...(db.registeredProfiles || [])
  ];
  return users
    .filter(profile => {
      const key = normalizeEmail(profile.email) || String(profile.name || "").toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(profile => ({
      ...profile,
      completeness: calculateProfileCompleteness(profile)
    }))
    .sort((a, b) => b.completeness - a.completeness);
}

function getMarketplaceProfiles(role = "") {
  return getAllProfiles().filter(profile => !role || profile.role === role);
}

function getUniversalMarketplaceItems() {
  const db = getDB();
  const profiles = getAllProfiles().map(profile => ({
    type: profile.role === "startup_admin" ? "Startup" : profile.role === "investor" ? "Investor" : "Freelancer",
    role: profile.role,
    name: profile.companyName || profile.name,
    personName: profile.name,
    title: profile.title,
    sector: profile.role === "freelancer" ? (profile.skills || []).join(", ") : profile.role === "investor" ? "Funding & Sponsorship" : "Startup",
    city: profile.city || "",
    state: profile.state || "",
    description: profile.bio || profile.title || "",
    avatarProfile: profile,
    completeness: profile.completeness
  }));
  const startups = (db.startups || []).map(startup => ({
    type: "Startup",
    role: "startup_admin",
    id: startup.id,
    name: startup.name,
    personName: startup.name,
    title: startup.stage,
    sector: startup.sector,
    funding: startup.target,
    city: startup.city || "",
    state: startup.state || "",
    description: startup.description,
    startup,
    completeness: startup.city ? 80 : 60
  }));
  return [...startups, ...profiles].sort((a, b) => (b.completeness || 0) - (a.completeness || 0));
}

function updateCurrentProfile(patch) {
  const user = getCurrentUser();
  if (!user) return null;
  const updated = { ...user, ...patch };
  updated.avatarInitials = updated.avatarInitials || initialsForName(updated.name);
  saveCurrentUser(updated);

  const db = getDB();
  if (updated.role === "startup_admin" && updated.startupId) {
    const startup = db.startups.find(s => s.id === updated.startupId);
    if (startup) {
      startup.city = updated.city || startup.city;
      startup.state = updated.state || startup.state;
      startup.description = updated.bio || startup.description;
    }
  }
  saveDB(db);
  return updated;
}

function searchItems(items, query, keys) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return items;
  if (window.Fuse) {
    return new Fuse(items, {
      keys,
      threshold: 0.34,
      ignoreLocation: true,
      includeScore: true
    }).search(q).map(result => result.item);
  }
  return items
    .map(item => {
      const text = keys.map(key => {
        const value = key.split(".").reduce((obj, part) => obj?.[part], item);
        return Array.isArray(value) ? value.join(" ") : value;
      }).join(" ").toLowerCase();
      const direct = text.includes(q) ? 2 : 0;
      const fuzzy = q.split("").every(char => text.includes(char)) ? 1 : 0;
      return { item, score: direct + fuzzy };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(result => result.item);
}

function normalizeKeywords(values) {
  return [...new Set((Array.isArray(values) ? values : String(values || "").split(/[,/|]/))
    .flatMap(value => String(value || "").toLowerCase().split(/[^a-z0-9]+/))
    .map(value => value.trim())
    .filter(value => value.length > 2))];
}

function getFreelancerKeywords(profile = getCurrentUser()) {
  const skills = Array.isArray(profile?.skills)
    ? profile.skills
    : String(profile?.skills || "").split(",");
  return normalizeKeywords([
    ...skills,
    profile?.title,
    profile?.bio
  ]);
}

function scoreGigForFreelancer(job, profile = getCurrentUser()) {
  const skills = getFreelancerKeywords(profile);
  const jobWords = normalizeKeywords([
    job?.title,
    job?.description,
    ...(job?.tags || [])
  ]);
  const matches = jobWords.filter(word => skills.some(skill => skill === word || skill.includes(word) || word.includes(skill)));
  const score = matches.length * 18 + Math.min(25, Number(job?.hourlyRate || 0) / 80);
  return {
    score: Math.round(score),
    matches: [...new Set(matches)].slice(0, 5)
  };
}

function getSuggestedGigs(profile = getCurrentUser(), limit = 6) {
  const db = getDB();
  return (db.jobs || [])
    .filter(job => job.status === "Active")
    .map(job => ({ ...job, match: scoreGigForFreelancer(job, profile) }))
    .filter(job => job.match.score > 0)
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, limit);
}

function getSmartRateSuggestion(category = "", experience = "mid") {
  const table = {
    "Branding & Creative": { beginner: 350, mid: 650, expert: 1200 },
    "Video & Reels": { beginner: 500, mid: 1000, expert: 1800 },
    "Website & App Development": { beginner: 700, mid: 1400, expert: 2500 },
    "Marketing & Growth": { beginner: 450, mid: 900, expert: 1600 },
    "Sales & Lead Generation": { beginner: 350, mid: 800, expert: 1500 },
    "Operations & Automation": { beginner: 600, mid: 1300, expert: 2400 },
    "Finance & Compliance": { beginner: 700, mid: 1500, expert: 2800 },
    Other: { beginner: 400, mid: 800, expert: 1400 }
  };
  const rates = table[category] || table.Other;
  return rates[experience] || rates.mid;
}

function getFreelancerAnalytics(name = getCurrentUser()?.name) {
  const db = getDB();
  const apps = (db.applications || []).filter(app => app.candidateName === name);
  const accepted = apps.filter(app => app.status === "Accepted");
  const totalBid = apps.reduce((sum, app) => sum + Number(app.proposedRate || 0), 0);
  const earnings = accepted.reduce((sum, app) => {
    const job = (db.jobs || []).find(item => item.id === app.jobId);
    return sum + Number(app.proposedRate || 0) * Number(job?.estimatedHours || 20);
  }, 0);
  return {
    applications: apps.length,
    gigsWon: accepted.length,
    averageBid: apps.length ? Math.round(totalBid / apps.length) : 0,
    earnings
  };
}

function notifyMatchingFreelancersForGig(job, startupName = "A startup") {
  const db = getDB();
  getAllProfiles()
    .filter(profile => profile.role === "freelancer")
    .forEach(profile => {
      const match = scoreGigForFreelancer(job, profile);
      if (match.score < 18) return;
      db.notifications.push({
        id: "not-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        to: profile.name,
        type: "gig_match",
        from: startupName,
        text: `${startupName} posted a gig matching your skills: ${job.title}.`,
        targetUrl: "dashboard-freelancer.html",
        read: false,
        createdAt: new Date().toISOString()
      });
    });
  saveDB(db);
}

function requestBrowserLocation() {
  if (!("geolocation" in navigator)) return Promise.reject(new Error("Location is not supported on this device."));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(async position => {
      const location = {
        latitude: Number(position.coords.latitude.toFixed(6)),
        longitude: Number(position.coords.longitude.toFixed(6)),
        accuracy: Math.round(position.coords.accuracy || 0)
      };
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${location.latitude}&lon=${location.longitude}`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const data = await res.json();
        const address = data.address || {};
        location.city = address.city || address.town || address.village || address.county || "";
        location.state = address.state || "";
      } catch {
        location.city = "";
        location.state = "";
      }
      resolve(location);
    }, reject, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  });
}

function connectUsers(targetName) {
  const user = getCurrentUser();
  if (!user || !targetName || targetName === user.name) return;
  const db = getDB();
  const existing = db.connections.find(c =>
    [c.from, c.to].includes(user.name) && [c.from, c.to].includes(targetName)
  );
  if (existing) return existing;
  const request = {
    id: "conn-" + Date.now(),
    from: user.name,
    to: targetName,
    status: "Pending",
    createdAt: new Date().toISOString()
  };
  db.connections.push(request);
  db.notifications.push({
    id: "not-" + Date.now(),
    to: targetName,
    type: "connection_request",
    text: `${user.name} sent you a connection request.`,
    read: false,
    createdAt: new Date().toISOString()
  });
  saveDB(db);
  if (CONNECTHUB_BACKEND_URL) {
    apiRequest("/api/connections", {
      method: "POST",
      body: JSON.stringify({ from: user.name, to: targetName })
    }).then(result => {
      if (result.db) {
        const merged = mergeDBState(getDB(), result.db);
        localStorage.setItem("connecthub_db", JSON.stringify(merged));
      }
    }).catch(error => console.warn("ConnectHub connection sync failed:", error.message));
  }
  return request;
}

function getUnreadCount() {
  const user = getCurrentUser();
  if (!user) return 0;
  const db = getDB();
  const names = [user.name, user.companyName].filter(Boolean);
  return db.messages.filter(m => names.includes(m.to) && !m.read).length +
    db.notifications.filter(n => names.includes(n.to) && !n.read).length;
}

function sendLocalMessage(to, text, extra = {}) {
  const user = getCurrentUser();
  if (!user || !to || (!text && !extra.attachment)) return null;
  const db = getDB();
  const message = {
    id: "msg-" + Date.now(),
    from: user.name,
    to,
    text: String(text).slice(0, 600),
    kind: extra.kind || "text",
    attachment: extra.attachment || null,
    read: false,
    createdAt: new Date().toISOString()
  };
  db.messages.push(message);
  db.notifications.push({
    id: "not-" + Date.now(),
    to,
    type: "message",
    text: `New message from ${user.name}`,
    read: false,
    createdAt: message.createdAt
  });
  saveDB(db);
  if (window.ConnectHubFirebaseChat?.enabled?.()) {
    window.ConnectHubFirebaseChat.sendMessage(message).catch(error =>
      console.warn("ConnectHub Firebase chat sync failed:", error.message)
    );
  }
  if (CONNECTHUB_BACKEND_URL) {
    apiRequest("/api/messages/send", {
      method: "POST",
      body: JSON.stringify(message)
    }).then(result => {
      if (result.db) {
        const merged = mergeDBState(getDB(), result.db);
        localStorage.setItem("connecthub_db", JSON.stringify(merged));
      }
    }).catch(error => {
      console.warn("ConnectHub message API failed:", error.message);
      if (window.ConnectHubSocket) window.ConnectHubSocket.emit("message:send", message);
    });
  } else if (window.ConnectHubSocket) {
    window.ConnectHubSocket.emit("message:send", message);
  }
  return message;
}

function notifyUser(to, text, extra = {}) {
  const db = getDB();
  const notification = {
    id: "not-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    to,
    type: extra.type || "activity",
    from: extra.from || getCurrentUser()?.name || "",
    text,
    targetUrl: extra.targetUrl || "",
    read: false,
    createdAt: new Date().toISOString()
  };
  db.notifications.push(notification);
  saveDB(db);
  return notification;
}

function expressInvestorInterest(startupId, startupName, amount = "", note = "") {
  const user = getCurrentUser();
  if (!user) return null;
  const db = getDB();
  const startup = db.startups.find(item => item.id === startupId || item.name === startupName);
  const interest = {
    id: "interest-" + Date.now(),
    investorName: user.name,
    startupId: startup?.id || startupId,
    startupName: startup?.name || startupName,
    amount,
    note: note || "Interested in discussing investment.",
    status: "Interested",
    createdAt: new Date().toISOString()
  };
  db.investorInterests.push(interest);
  db.notifications.push({
    id: "not-" + Date.now(),
    to: interest.startupName,
    type: "investor_interest",
    text: `${user.name} expressed interest in ${interest.startupName}.`,
    read: false,
    createdAt: interest.createdAt
  });
  saveDB(db);
  if (CONNECTHUB_BACKEND_URL) {
    apiRequest("/api/investor-interest", {
      method: "POST",
      body: JSON.stringify(interest)
    }).then(result => {
      if (result.db) localStorage.setItem("connecthub_db", JSON.stringify(mergeDBState(getDB(), result.db)));
    }).catch(error => console.warn("ConnectHub investor interest sync failed:", error.message));
  }
  return interest;
}

function submitReview(to, rating, text = "") {
  const user = getCurrentUser();
  if (!user || !to) return null;
  const db = getDB();
  const review = {
    id: "review-" + Date.now(),
    from: user.name,
    to,
    rating: Math.max(1, Math.min(5, Number(rating || 5))),
    text: String(text || "").slice(0, 300),
    createdAt: new Date().toISOString()
  };
  db.reviews.push(review);
  db.notifications.push({
    id: "not-" + Date.now(),
    to,
    type: "review",
    from: user.name,
    text: `${user.name} rated you ${review.rating}/5.`,
    targetUrl: `profile/${encodeURIComponent(to)}`,
    read: false,
    createdAt: review.createdAt
  });
  saveDB(db);
  if (CONNECTHUB_BACKEND_URL) {
    apiRequest("/api/reviews", {
      method: "POST",
      body: JSON.stringify(review)
    }).then(result => {
      if (result.db) localStorage.setItem("connecthub_db", JSON.stringify(mergeDBState(getDB(), result.db)));
    }).catch(error => console.warn("ConnectHub review sync failed:", error.message));
  }
  return review;
}
