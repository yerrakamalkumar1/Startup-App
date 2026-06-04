export interface SettingsFeature {
  key: string;
  keywordTokens: string[];
  displayName: string;
  category: string;
  deepLinkRoute: string;
  description: string;
  icon: string;
  priority: number;
}

export const SETTINGS_FEATURE_MAP: SettingsFeature[] = [
  {
    key: "change-password",
    keywordTokens: ["password", "passcode", "security", "credentials", "otp", "login", "reset"],
    displayName: "Change Password",
    category: "Security",
    deepLinkRoute: "/settings/security/update",
    description: "Send OTP and update your ConnectHub passcode securely.",
    icon: "key-round",
    priority: 100
  },
  {
    key: "privacy-visibility",
    keywordTokens: ["privacy", "visibility", "public", "private", "profile", "hide"],
    displayName: "Profile Visibility",
    category: "Privacy",
    deepLinkRoute: "/settings/privacy/visibility",
    description: "Control who can view your profile, connections, and work activity.",
    icon: "eye",
    priority: 95
  },
  {
    key: "edit-profile",
    keywordTokens: ["edit", "profile", "bio", "avatar", "photo", "city", "location", "skills"],
    displayName: "Edit Profile",
    category: "Account",
    deepLinkRoute: "/settings/account/profile",
    description: "Update name, bio, avatar, city, state, skills, and public profile details.",
    icon: "user-pen",
    priority: 90
  },
  {
    key: "notification-preferences",
    keywordTokens: ["notification", "bell", "sound", "email", "messages", "alerts", "push"],
    displayName: "Notification Preferences",
    category: "Notifications",
    deepLinkRoute: "/settings/notifications",
    description: "Manage alerts for messages, connection requests, post activity, and platform updates.",
    icon: "bell",
    priority: 85
  },
  {
    key: "saved-posts",
    keywordTokens: ["saved", "bookmark", "folder", "posts", "gigs", "collection"],
    displayName: "Saved Posts & Gigs",
    category: "Data & Activity",
    deepLinkRoute: "/settings/activity/saved",
    description: "Open your saved posts, opportunities, and service ads.",
    icon: "bookmark",
    priority: 82
  },
  {
    key: "email-phone",
    keywordTokens: ["email", "phone", "whatsapp", "contact", "mobile", "number"],
    displayName: "Manage Email & Phone",
    category: "Account",
    deepLinkRoute: "/settings/account/contact",
    description: "Update your email address, WhatsApp number, and contact details.",
    icon: "mail",
    priority: 78
  },
  {
    key: "dark-mode",
    keywordTokens: ["dark", "light", "theme", "appearance", "mode", "color"],
    displayName: "Theme",
    category: "Appearance",
    deepLinkRoute: "/settings/appearance/theme",
    description: "Switch between light, dark, and system theme modes.",
    icon: "palette",
    priority: 75
  },
  {
    key: "blocked-users",
    keywordTokens: ["block", "blocked", "mute", "muted", "report", "spam"],
    displayName: "Block / Muted Users",
    category: "Privacy",
    deepLinkRoute: "/settings/privacy/blocked",
    description: "Manage people you blocked or muted on ConnectHub.",
    icon: "ban",
    priority: 70
  },
  {
    key: "ai-hub-settings",
    keywordTokens: ["ai", "hub", "matches", "recommendations", "location", "intelligence"],
    displayName: "AI Hub",
    category: "AI & Recommendations",
    deepLinkRoute: "/settings/ai-hub",
    description: "Configure role-specific AI matching, location discovery, and smart suggestions.",
    icon: "sparkles",
    priority: 68
  },
  {
    key: "download-data",
    keywordTokens: ["download", "export", "data", "activity", "backup"],
    displayName: "Download Your Data",
    category: "Data & Activity",
    deepLinkRoute: "/settings/activity/export",
    description: "Prepare a copy of your profile, posts, and activity records.",
    icon: "download",
    priority: 62
  },
  {
    key: "help-support",
    keywordTokens: ["help", "support", "call", "problem", "bug", "feedback"],
    displayName: "Help Center",
    category: "Support",
    deepLinkRoute: "/settings/support/help",
    description: "Call support, report a problem, or send feedback to ConnectHub.",
    icon: "help-circle",
    priority: 58
  },
  {
    key: "logout",
    keywordTokens: ["logout", "log out", "sign out", "exit", "session"],
    displayName: "Log Out",
    category: "Account Actions",
    deepLinkRoute: "/settings/account/logout",
    description: "Sign out from this device safely.",
    icon: "log-out",
    priority: 52
  }
];
