const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.CONNECTHUB_DATA_DIR || path.join(__dirname, "backend", "data");
const DB_FILE = path.join(DATA_DIR, "connecthub-db.json");

const freelancers = [
  ["Priya Sharma", "freelancer", "UI/UX Designer", "Mumbai", "Maharashtra", ["Figma", "Design Systems", "FinTech"], [72.8777, 19.076]],
  ["Sneha Patel", "freelancer", "Full Stack Developer", "Pune", "Maharashtra", ["React", "Node", "MongoDB"], [73.8567, 18.5204]],
  ["Karthik Raj", "freelancer", "Android Developer", "Chennai", "Tamil Nadu", ["Android", "Kotlin", "Mobile"], [80.2707, 13.0827]],
  ["Ananya Singh", "freelancer", "Growth Marketer", "Delhi", "Delhi", ["SEO", "Ads", "Growth"], [77.209, 28.6139]],
  ["Rohit Verma", "freelancer", "Video Editor", "Hyderabad", "Telangana", ["Reels", "Premiere Pro", "Storytelling"], [78.4867, 17.385]],
  ["Meera Nair", "freelancer", "Data Analyst", "Bangalore", "Karnataka", ["Python", "SQL", "Dashboards"], [77.5946, 12.9716]]
];

const startups = [
  ["TechNova", "SaaS & Technology", "Seed", "Bangalore", [77.5946, 12.9716], "B2B CRM for Indian SMEs"],
  ["GreenEats", "Food & Hospitality", "Series A", "Mumbai", [72.8777, 19.076], "AI demand forecasting for kitchens"],
  ["MedBridge", "Health & Wellness", "Seed", "Hyderabad", [78.4867, 17.385], "Healthcare access platform"],
  ["EduLeap", "Education & Training", "Pre-seed", "Pune", [73.8567, 18.5204], "Learning platform for tier-2 India"],
  ["LogiTrack", "Logistics & Mobility", "Seed", "Chennai", [80.2707, 13.0827], "Faster deliveries for local businesses"]
];

const investors = [
  ["Arjun Kapoor", "investor", "Kalaari Capital", "Delhi", [77.209, 28.6139], ["SaaS", "FinTech"]],
  ["Sunita Rao", "investor", "Angel Investor", "Bangalore", [77.5946, 12.9716], ["EdTech", "Consumer"]],
  ["Dev Malhotra", "investor", "Sequoia Scout", "Mumbai", [72.8777, 19.076], ["Tier 2", "SaaS"]]
];

const registeredProfiles = [
  ...freelancers.map(([name, role, title, city, state, skills, coordinates]) => ({ id: slug(name), name, role, title, city, state, skills, avatarInitials: initials(name), location: { type: "Point", coordinates, city, state } })),
  ...startups.map(([name, sector, stage, city, coordinates, description]) => ({ id: slug(name), name, role: "startup", title: description, companyName: name, sector, stage, city, skills: [sector], avatarInitials: initials(name), location: { type: "Point", coordinates, city } })),
  ...investors.map(([name, role, firmName, city, coordinates, focusSectors]) => ({ id: slug(name), name, role, title: firmName, firmName, city, focusSectors, skills: focusSectors, avatarInitials: initials(name), location: { type: "Point", coordinates, city } }))
];

const profilePosts = [
  post("Rahul Mehta", "TechNova just closed its seed round. Building B2B CRM for Indian SMEs. #startup #seed #SaaS", ["startup", "seed", "SaaS"], 142),
  post("Priya Sharma", "Delivered a complete fintech design system in 2 weeks. Open to June projects. #UIdesign #freelance #figma", ["UIdesign", "freelance", "figma"], 89),
  post("Sunita Rao", "Actively looking for EdTech and Consumer startups in Seed stage. Ticket size Rs 25L-Rs 1Cr. #investing #edtech", ["investing", "edtech"], 231),
  post("GreenEats", "Reduced food waste by 32 percent in pilot kitchens using AI demand forecasting. #foodtech #sustainability", ["foodtech", "sustainability"], 178),
  post("Karthik Raj", "Available for Android projects starting June 10. 30+ apps delivered. Rs 950/hr. #android #mobile", ["android", "mobile"], 67),
  post("Dev Malhotra", "Tier 2 city startup energy is incredible. Nagpur, Indore, Surat are moving fast. #india #startups", ["india", "startups"], 312)
];

const reels = [
  reel("TechNova", "We're hiring React Developers!", 2300),
  reel("Priya Sharma", "Fintech dashboard UI case study", 1100),
  reel("GreenEats", "Launching in 5 cities this June", 874),
  reel("Arjun Kapoor", "Looking for SaaS seed startups", 3200),
  reel("EduLeap", "Beta crossed 10,000 users", 2800),
  reel("Meera Nair", "Available for data analytics projects", 654),
  reel("LogiTrack", "Pilot launch in Chennai", 988),
  reel("Sneha Patel", "E-commerce platform in 3 weeks", 1400)
];

const messages = [
  message("Rahul Mehta", "Priya Sharma", "Can we schedule a call?"),
  message("Anita Kumar", "Priya Sharma", "Please share your portfolio link"),
  message("Arjun Kapoor", "Sneha Patel", "Interested in your profile"),
  message("Dev Shah", "Karthik Raj", "Your proposal looks great!"),
  message("Sunita Rao", "Rahul Mehta", "What's your availability?"),
  message("Priya Sharma", "Rahul Mehta", "Interested! I can share a design proposal."),
  message("Karthik Raj", "GreenEats", "I can build the Android MVP."),
  message("Meera Nair", "TechNova", "I can help with analytics dashboards."),
  message("Sneha Patel", "EduLeap", "Sharing my portfolio."),
  message("Dev Malhotra", "GreenEats", "Let's discuss your seed round.")
];

const notifications = Array.from({ length: 20 }, (_, index) => ({
  id: `seed-note-${index + 1}`,
  to: index % 2 ? "Priya Sharma" : "Sarah Jenkins",
  type: ["message", "connection_request", "profile_view", "post_like"][index % 4],
  from: registeredProfiles[index % registeredProfiles.length].name,
  text: `${registeredProfiles[index % registeredProfiles.length].name} ${["sent you a message", "sent a connection request", "viewed your profile", "liked your post"][index % 4]}.`,
  read: index > 6,
  createdAt: new Date(Date.now() - index * 3600000).toISOString()
}));

const db = {
  startups: startups.map(([name, sector, stage, city, coordinates, description], index) => ({ id: `st-${index + 1}`, name, sector, stage, city, description, logoInitials: initials(name), logoColor: "#0f766e", target: "Rs 80 Lakh", raised: "Rs 18 Lakh", views: [40, 60, 90, 110, 130, 170, 220], engagement: [3, 5, 7, 9, 12, 16, 21], location: { type: "Point", coordinates } })),
  jobs: [],
  freelancerAds: [],
  startupPromotions: [],
  applications: [],
  events: [],
  investments: [],
  connections: [],
  savedProfiles: [],
  registeredProfiles,
  profilePosts,
  reels,
  messages,
  notifications,
  investorInterests: [],
  reviews: []
};

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
console.log(`Seeded ConnectHub data at ${DB_FILE}`);

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function initials(value) {
  return value.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();
}

function post(author, content, hashtags, likes) {
  return { id: `post-${slug(author)}`, author, content, hashtags, likes: Array.from({ length: likes }, (_, i) => `u-${i}`), comments: [], saves: [], createdAt: new Date().toISOString() };
}

function reel(author, caption, views) {
  return { id: `reel-${slug(author)}`, author, videoUrl: "", thumbnail: "", caption, views, likes: [], comments: [], duration: 30, createdAt: new Date().toISOString() };
}

function message(sender, receiver, content) {
  return { id: `msg-${slug(sender)}-${slug(receiver)}-${Date.now()}-${Math.random().toString(16).slice(2)}`, from: sender, to: receiver, text: content, read: false, createdAt: new Date().toISOString() };
}
