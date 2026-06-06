const AppUX = (() => {
  let audioCtx = null;
  let homeView = "";
  let profileView = "";
  let exploreView = "";
  let adsView = "";
  let onProfileSaved = null;
  let historyStack = [];
  let currentView = "";
  let exploreImagePreview = "";
  let exploreVoiceRecognition = null;
  let avatarLongPressTimer = null;
  let avatarLongPressOpened = false;
  let exploreSearchRequestId = 0;
  let exploreSearchTimer = null;
  let exploreFilters = { role: "", location: "", skills: "", company: "", category: "all", stage: "", sector: "", sort: "relevance" };
  let currentMessageTab = "focused";
  let currentNotificationTab = "all";
  let visibleNotificationIds = [];
  let deferredInstallPrompt = null;
  let networkSearchTimer = null;
  let networkRoleFilter = "";
  let settingsSearchTimer = null;
  let settingsSheetSelect = null;
  const KEYWORD_ROLE_TERMS = new Set([
    "founder", "founders", "cofounder", "co-founder", "startup owner", "startup founder",
    "freelancer", "investor", "sponsor", "angel", "mentor", "designer", "developer",
    "editor", "photographer", "marketer", "consultant", "engineer", "creator"
  ]);
  const KEYWORD_INDUSTRY_TERMS = new Set([
    "commerce", "retail", "food", "hospitality", "property", "infrastructure", "health",
    "wellness", "education", "training", "finance", "legal", "logistics", "mobility",
    "saas", "technology", "consumer services", "media", "entertainment", "manufacturing",
    "hardware", "fintech", "edtech", "healthtech", "foodtech", "proptech"
  ]);

  function unlockAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  function playSound(type = "tap") {
    try {
      unlockAudio();
      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const tones = {
        tap: [420, 0.035, 0.018],
        nav: [540, 0.045, 0.02],
        done: [780, 0.08, 0.025],
        back: [300, 0.04, 0.018],
        bell: [1046, 0.11, 0.028]
      };
      const [frequency, duration, volume] = tones[type] || tones.tap;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.value = volume;
      oscillator.connect(gain);
      gain.connect(audioCtx.destination);
      oscillator.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      oscillator.stop(audioCtx.currentTime + duration + 0.02);
    } catch {
      // Browsers can block audio before the first user gesture.
    }
  }

  function init(options = {}) {
    homeView = options.homeView || homeView;
    profileView = options.profileView || homeView;
    exploreView = options.exploreView || options.browseView || homeView;
    adsView = options.adsView || options.serviceAdsView || exploreView;
    onProfileSaved = options.onProfileSaved || null;
    document.addEventListener("pointerdown", unlockAudio, { once: true });
    installShellControls();
    installProfileMenu();
    installButtonSounds();
    installRefreshBar();
    installDarkMode();
    installAccessibilityPreferences();
    installNotificationBell();
    installRealtime();
    installMessageDock();
    installSettingsOverlays();
    installExplorePage();
    installBottomNav();
    installMediaOptimizer();
    installAdvancedAppFeatures();
    installPremiumInteractions();
    applyUserChrome();
  }

  const CH_REELS = [
    { id: "create", name: "Your Story", initials: "+", role: "Create", city: "India", caption: "Share a reel, image, or announcement with your network.", views: "Create", new: false, type: "create" },
    { id: "reel-technova", name: "TechNova", initials: "TN", role: "Startup", city: "Bangalore", caption: "We're hiring React Developers!", views: "2.3K", new: true, sector: "SaaS" },
    { id: "reel-priya", name: "Priya Sharma", initials: "PS", role: "Freelancer", city: "Mumbai", caption: "Just completed a dashboard UI for a fintech client.", views: "1.1K", new: true, sector: "Design" },
    { id: "reel-greeneats", name: "GreenEats", initials: "GE", role: "Startup", city: "Mumbai", caption: "Launching in 5 cities this June.", views: "874", new: false, sector: "FoodTech" },
    { id: "reel-arjun", name: "Arjun Kapoor", initials: "AK", role: "Investor", city: "Delhi", caption: "Looking for SaaS startups in Seed stage.", views: "3.2K", new: true, sector: "Investor" },
    { id: "reel-eduleap", name: "EduLeap", initials: "EL", role: "Startup", city: "Pune", caption: "Our beta crossed 10,000 users.", views: "2.8K", new: false, sector: "EdTech" },
    { id: "reel-meera", name: "Meera Nair", initials: "MN", role: "Freelancer", city: "Chennai", caption: "Available for data analytics projects this month.", views: "654", new: true, sector: "Analytics" },
    { id: "reel-logitrack", name: "LogiTrack", initials: "LT", role: "Startup", city: "Chennai", caption: "Pilot launch: 40 percent faster deliveries.", views: "988", new: false, sector: "Logistics" },
    { id: "reel-sneha", name: "Sneha Patel", initials: "SP", role: "Freelancer", city: "Pune", caption: "New e-commerce platform delivered in 3 weeks.", views: "1.4K", new: true, sector: "Full Stack" }
  ];

  const CH_POSTS = [
    { id: "post-rahul", name: "Rahul Mehta", role: "Startup", title: "TechNova", city: "Bangalore", initials: "RM", time: "3h", likes: 142, comments: 28, shares: 12, text: "Excited to announce TechNova just closed its seed round! Thank you to our early investors and team. We're building the future of B2B CRM for Indian SMEs. #startup #seed #SaaS", tags: ["startup", "seed", "SaaS"], accent: "#0f766e" },
    { id: "post-priya", name: "Priya Sharma", role: "Freelancer", title: "UI/UX Designer", city: "Mumbai", initials: "PS", time: "6h", likes: 89, comments: 14, shares: 7, text: "Just delivered a complete design system for a fintech startup in 2 weeks. Clean, accessible, and scalable. Open to new projects this June. DM me or check my profile. #UIdesign #freelance #figma", tags: ["UIdesign", "freelance", "figma"], accent: "#7c3aed" },
    { id: "post-sunita", name: "Sunita Rao", role: "Investor", title: "Angel Investor", city: "Bangalore", initials: "SR", time: "1d", likes: 231, comments: 47, shares: 31, text: "I'm actively looking for EdTech and Consumer startups in Seed stage. Ticket size: Rs 25L-Rs 1Cr. If you're building something impactful, drop me a message. #investing #edtech #india", tags: ["investing", "edtech", "india"], accent: "#f59e0b" },
    { id: "post-greeneats", name: "GreenEats", role: "Startup", title: "FoodTech", city: "Mumbai", initials: "GE", time: "2d", likes: 178, comments: 33, shares: 16, text: "We've reduced food waste by 32 percent in our pilot kitchens using AI demand forecasting. This is what sustainable food tech looks like. #foodtech #sustainability #startup", tags: ["foodtech", "sustainability", "startup"], accent: "#10b981" },
    { id: "post-karthik", name: "Karthik Raj", role: "Freelancer", title: "Android Developer", city: "Chennai", initials: "KR", time: "3d", likes: 67, comments: 9, shares: 4, text: "Available for Android projects starting June 10th. 5 years experience, 30+ apps delivered, Rs 950/hr. Let's build something great! #android #freelance #mobile", tags: ["android", "freelance", "mobile"], accent: "#3b82f6" },
    { id: "post-dev", name: "Dev Malhotra", role: "Investor", title: "Sequoia Scout", city: "Mumbai", initials: "DM", time: "4d", likes: 312, comments: 61, shares: 45, text: "Spent the last week visiting startups in Tier 2 cities: Nagpur, Indore, Surat. The energy is incredible. Ecosystem is growing fast. #india #startups #tier2", tags: ["india", "startups", "tier2"], accent: "#ec4899" }
  ];

  const LOCAL_SETTINGS_FEATURE_MAP = [
    { key: "change-password", keywordTokens: ["password", "passcode", "security", "otp", "login"], displayName: "Change Password", category: "Security", deepLinkRoute: "/settings/security/update", description: "Send OTP and update your passcode.", icon: "key-round", priority: 100 },
    { key: "privacy-visibility", keywordTokens: ["privacy", "visibility", "public", "private", "profile"], displayName: "Profile Visibility", category: "Privacy", deepLinkRoute: "/settings/privacy/visibility", description: "Control who can view your profile.", icon: "eye", priority: 95 },
    { key: "edit-profile", keywordTokens: ["edit", "profile", "bio", "avatar", "photo", "location", "skills"], displayName: "Edit Profile", category: "Account", deepLinkRoute: "/settings/account/profile", description: "Update name, bio, avatar, location and skills.", icon: "user-pen", priority: 90 },
    { key: "notification-preferences", keywordTokens: ["notification", "bell", "sound", "email", "messages", "alerts"], displayName: "Notification Preferences", category: "Notifications", deepLinkRoute: "/settings/notifications", description: "Manage alerts and notification sounds.", icon: "bell", priority: 85 },
    { key: "saved-posts", keywordTokens: ["saved", "bookmark", "folder", "posts", "gigs"], displayName: "Saved Posts & Gigs", category: "Data & Activity", deepLinkRoute: "/settings/activity/saved", description: "Open saved posts and opportunities.", icon: "bookmark", priority: 82 },
    { key: "dark-mode", keywordTokens: ["dark", "light", "theme", "appearance", "mode"], displayName: "Theme", category: "Appearance", deepLinkRoute: "/settings/appearance/theme", description: "Switch light, dark, or system theme.", icon: "palette", priority: 75 },
    { key: "language-preference", keywordTokens: ["language", "languages", "hindi", "telugu", "english", "locale"], displayName: "Language", category: "Language & Region", deepLinkRoute: "/settings/language", description: "Switch app labels to supported Indian languages.", icon: "languages", priority: 74 },
    { key: "font-size", keywordTokens: ["font", "size", "text", "accessibility", "large", "small"], displayName: "Font Size", category: "Accessibility", deepLinkRoute: "/settings/accessibility/font-size", description: "Adjust text scale across the app.", icon: "type", priority: 73 },
    { key: "ai-hub-settings", keywordTokens: ["ai", "hub", "matches", "recommendations", "location"], displayName: "AI Hub", category: "AI & Recommendations", deepLinkRoute: "/settings/ai-hub", description: "Configure AI recommendations and location features.", icon: "sparkles", priority: 68 },
    { key: "help-support", keywordTokens: ["help", "support", "call", "problem", "feedback"], displayName: "Help Center", category: "Support", deepLinkRoute: "/settings/support/help", description: "Contact support or report a problem.", icon: "help-circle", priority: 58 },
    { key: "logout", keywordTokens: ["logout", "sign out", "exit", "session"], displayName: "Log Out", category: "Account Actions", deepLinkRoute: "/settings/account/logout", description: "Sign out from this device.", icon: "log-out", priority: 52 }
  ];

  const LANGUAGE_OPTIONS = [
    { value: "en", label: "English" },
    { value: "te", label: "Telugu" },
    { value: "hi", label: "Hindi" },
    { value: "ur", label: "Urdu" },
    { value: "ta", label: "Tamil" },
    { value: "kn", label: "Kannada" },
    { value: "mr", label: "Marathi" }
  ];

  const FONT_SIZE_OPTIONS = [
    { value: "small", label: "Small" },
    { value: "medium", label: "Medium" },
    { value: "large", label: "Large" },
    { value: "extra-large", label: "Extra large" }
  ];

  function installPremiumInteractions() {
    if (window.__connectHubPremiumInteractions) return;
    window.__connectHubPremiumInteractions = true;
    document.addEventListener("click", event => {
      const button = event.target.closest("button, .btn, .sidebar-item a, .bottom-nav button");
      if (!button) return;
      const ripple = document.createElement("span");
      ripple.className = "ch-ripple";
      const rect = button.getBoundingClientRect();
      ripple.style.left = `${event.clientX - rect.left}px`;
      ripple.style.top = `${event.clientY - rect.top}px`;
      button.appendChild(ripple);
      setTimeout(() => ripple.remove(), 620);
    });
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    window.ConnectHubObserveEntrances = root => {
      (root || document).querySelectorAll(".glass-card, .glass-panel, .settings-card, .ch-post-card, .ch-reel-bubble, .aihub-panel").forEach(item => observer.observe(item));
    };
  }

  function installAdvancedAppFeatures() {
    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      deferredInstallPrompt = event;
      showInstallHint();
    });
    window.addEventListener("online", () => updateConnectivityStatus(true));
    window.addEventListener("offline", () => updateConnectivityStatus(false));
    updateConnectivityStatus(navigator.onLine);
    installCommandPalette();
  }

  function showInstallHint() {
    if (localStorage.getItem("connecthub_install_hint_seen") === "true") return;
    localStorage.setItem("connecthub_install_hint_seen", "true");
    setTimeout(() => showToast("ConnectHub can be installed on your home screen"), 900);
  }

  function updateConnectivityStatus(isOnline) {
    let badge = document.getElementById("connectivityBadge");
    if (!badge) {
      badge = document.createElement("button");
      badge.id = "connectivityBadge";
      badge.type = "button";
      badge.className = "connectivity-badge";
      badge.addEventListener("click", () => showToast(isOnline ? "You are online" : "Offline mode: cached dashboards are available"));
      document.body.appendChild(badge);
    }
    badge.classList.toggle("offline", !isOnline);
    badge.innerHTML = `<span></span>${isOnline ? "Online" : "Offline"}`;
  }

  function installCommandPalette() {
    if (document.getElementById("commandPalette")) return;
    const palette = document.createElement("section");
    palette.id = "commandPalette";
    palette.className = "command-palette";
    palette.innerHTML = `
      <button class="command-palette-scrim" type="button" onclick="AppUX.closeCommandPalette()" aria-label="Close command launcher"></button>
      <div class="command-palette-card">
        <div class="command-search"><i data-lucide="search"></i><input id="commandSearchInput" placeholder="Search actions, pages, people..." oninput="AppUX.renderCommandResults(this.value)" autocomplete="off"></div>
        <div id="commandResults" class="command-results"></div>
      </div>`;
    document.body.appendChild(palette);
    document.addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openCommandPalette();
      }
      if (event.key === "Escape") closeCommandPalette();
    });
  }

  function installMediaOptimizer() {
    const apply = () => {
      document.querySelectorAll("img:not([loading])").forEach(img => {
        img.loading = "lazy";
        img.decoding = "async";
      });
      document.querySelectorAll("video").forEach(video => {
        video.preload = "metadata";
      });
    };
    apply();
    if (!window.__connectHubMediaObserver) {
      window.__connectHubMediaObserver = new MutationObserver(apply);
      window.__connectHubMediaObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function installShellControls() {
    const app = document.querySelector(".app-container");
    const nav = document.querySelector(".top-navbar");
    const pageTitle = document.querySelector(".page-title");
    const logo = document.querySelector(".sidebar-logo");
    if (!app || !nav || !pageTitle) return;

    let navControls = document.getElementById("navLeftControls");
    if (!navControls) {
      navControls = document.createElement("div");
      navControls.id = "navLeftControls";
      navControls.className = "nav-left-controls";
      nav.insertBefore(navControls, nav.firstChild);
    }

    if (!document.querySelector(".mobile-nav-backdrop")) {
      const backdrop = document.createElement("button");
      backdrop.className = "mobile-nav-backdrop";
      backdrop.setAttribute("aria-label", "Close navigation");
      backdrop.addEventListener("click", closeMenu);
      document.body.appendChild(backdrop);
    }

    if (!document.getElementById("mobileMenuBtn")) {
      const menuBtn = document.createElement("button");
      menuBtn.id = "mobileMenuBtn";
      menuBtn.className = "btn btn-secondary btn-icon mobile-menu-btn";
      menuBtn.title = "Menu";
      menuBtn.innerHTML = '<i data-lucide="menu"></i>';
      menuBtn.addEventListener("click", () => {
        playSound("nav");
        app.classList.add("nav-open");
      });
      navControls.appendChild(menuBtn);
    }

    if (!document.getElementById("viewBackBtn")) {
      const backBtn = document.createElement("button");
      backBtn.id = "viewBackBtn";
      backBtn.className = "btn btn-secondary btn-icon view-back-btn";
      backBtn.title = "Back";
      backBtn.innerHTML = '<i data-lucide="arrow-left"></i>';
      backBtn.addEventListener("click", back);
      navControls.appendChild(backBtn);
    }

    if (logo) {
      logo.setAttribute("role", "button");
      logo.setAttribute("tabindex", "0");
      logo.title = "Go to dashboard";
      logo.addEventListener("click", () => {
        playSound("nav");
        if (window.go && homeView) window.go(homeView);
        closeMenu();
      });
    }

    const sidebarMenu = document.querySelector(".sidebar-menu");
    if (sidebarMenu && !document.getElementById("t-feed")) {
      const item = document.createElement("li");
      item.id = "t-feed";
      item.className = "sidebar-item";
      item.innerHTML = '<a><i data-lucide="newspaper"></i>Feed</a>';
      item.addEventListener("click", () => {
        playSound("nav");
        if (window.go && homeView) window.go(homeView);
        closeMenu();
      });
      sidebarMenu.insertBefore(item, sidebarMenu.firstElementChild?.nextSibling || null);
    }
    if (sidebarMenu && !document.getElementById("mobileLogoutItem")) {
      const item = document.createElement("li");
      item.id = "mobileLogoutItem";
      item.className = "sidebar-item mobile-logout-item";
      item.innerHTML = '<a><i data-lucide="log-out"></i>Logout</a>';
      item.addEventListener("click", () => {
        playSound("back");
        handleLogout();
      });
      sidebarMenu.appendChild(item);
    }

    if (window.lucide) window.lucide.createIcons();
  }

  function installProfileMenu() {
    const badge = document.querySelector(".user-profile-badge");
    if (!badge || document.getElementById("profileMenu")) return;

    badge.classList.add("profile-trigger");
    const logoutButton = badge.querySelector("button");
    if (logoutButton) logoutButton.remove();

    const menu = document.createElement("div");
    menu.id = "profileMenu";
    menu.className = "profile-menu";
    menu.innerHTML = `
      <button type="button" data-profile-action="open"><i data-lucide="user"></i><span>Open profile</span></button>
      <button type="button" data-profile-action="edit"><i data-lucide="settings"></i><span>Edit profile</span></button>
      <button type="button" data-profile-action="logout"><i data-lucide="log-out"></i><span>Logout</span></button>
    `;
    badge.appendChild(menu);

    badge.addEventListener("click", event => {
      event.stopPropagation();
      playSound("tap");
      menu.classList.toggle("active");
    });

    menu.addEventListener("click", event => {
      event.stopPropagation();
      const button = event.target.closest("button");
      if (!button) return;
      const action = button.dataset.profileAction;
      menu.classList.remove("active");
      playSound(action === "logout" ? "back" : "nav");
      if (action === "logout") handleLogout();
      else if (window.go && profileView) {
        window.go(profileView);
        closeMenu();
      }
    });

    document.addEventListener("click", () => menu.classList.remove("active"));
    if (window.lucide) window.lucide.createIcons();
  }

  function applyUserChrome() {
    const user = getCurrentUser?.();
    if (!user) return;
    const avatar = document.getElementById("av");
    if (avatar) {
      if (user.avatarPhoto?.dataUrl) {
        avatar.innerHTML = `<img class="avatar-img" src="${user.avatarPhoto.dataUrl}" alt="${user.name || "Profile"}">`;
      } else {
        avatar.textContent = user.avatarInitials || "";
      }
    }
    const badge = document.querySelector(".user-profile-badge");
    if (badge && !document.getElementById("unreadBadge")) {
      const unread = getUnreadCount?.() || 0;
      const count = document.createElement("span");
      count.id = "unreadBadge";
      count.className = "unread-badge";
      count.textContent = unread;
      count.style.display = unread ? "inline-flex" : "none";
      badge.appendChild(count);
    }
    const bottomProfile = document.getElementById("bottomProfileAvatar");
    if (bottomProfile) {
      bottomProfile.innerHTML = user.avatarPhoto?.dataUrl
        ? `<img class="avatar-img" src="${user.avatarPhoto.dataUrl}" alt="${user.name || "Profile"}">`
        : `<span>${user.avatarInitials || ""}</span>`;
    }
    document.getElementById("uname") && (document.getElementById("uname").textContent = user.name || "");
    document.getElementById("urole") && (document.getElementById("urole").textContent = user.title || "");
  }

  function installBottomNav() {
    if (document.getElementById("bottomNav")) return;
    const nav = document.createElement("nav");
    nav.id = "bottomNav";
    nav.className = "bottom-nav";
    nav.innerHTML = `
      <button type="button" data-bottom-view="${homeView}" data-bottom-tab="home"><i data-lucide="home"></i><span>Home</span></button>
      <button type="button" data-bottom-action="explore" data-bottom-tab="explore"><i data-lucide="search"></i><span>Explore</span></button>
      <button type="button" data-bottom-action="messages" data-bottom-tab="messages"><i data-lucide="message-circle"></i><span>Messages</span><small id="bottomMsgBadge"></small></button>
      <button type="button" data-bottom-view="${adsView}" data-bottom-tab="ads"><i data-lucide="megaphone"></i><span>Ads</span></button>
      <button type="button" data-bottom-view="${profileView}" data-bottom-tab="profile"><span id="bottomProfileAvatar" class="bottom-avatar"></span><span>Profile</span></button>
    `;
    nav.addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button) return;
      playSound("nav");
      if (button.dataset.bottomAction === "messages") {
        openMessageDock();
        setBottomActive("messages");
        return;
      }
      if (button.dataset.bottomAction === "explore") {
        openExplorePage();
        setBottomActive("explore");
        return;
      }
      if (button.dataset.bottomView && window.go) window.go(button.dataset.bottomView);
    });
    document.body.appendChild(nav);
    updateBottomNav();
    updateUnreadBadge();
    if (window.lucide) window.lucide.createIcons();
  }

  function setBottomActive(tab) {
    document.querySelectorAll(".bottom-nav button").forEach(button => {
      button.classList.toggle("active", button.dataset.bottomTab === tab);
    });
  }

  function updateBottomNav() {
    let tab = "";
    if (currentView === profileView) tab = "profile";
    else if (currentView === adsView && adsView !== exploreView) tab = "ads";
    else if (currentView === exploreView) tab = "explore";
    else if (currentView === homeView) tab = "home";
    setBottomActive(tab);
  }

  function installDarkMode() {
    const saved = localStorage.getItem("connecthub_theme") || "light";
    const applied = saved === "system"
      ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : saved === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = applied;
    document.documentElement.classList.toggle("dark", applied === "dark");
  }

  function installNotificationBell() {
    const user = getCurrentUser?.();
    const nav = document.querySelector(".top-navbar > div:last-child") || document.querySelector(".top-navbar");
    if (!user || !nav || document.getElementById("notificationBell")) return;
    const wrap = document.createElement("div");
    wrap.className = "notification-bell-wrap";
    wrap.innerHTML = `
      <button id="notificationBell" class="btn btn-secondary btn-icon" type="button" title="Notifications">
        <i data-lucide="bell"></i><span id="notificationBellCount"></span>
      </button>
      <div id="notificationPanel" class="notification-panel"></div>
    `;
    nav.prepend(wrap);
    document.getElementById("notificationBell").addEventListener("click", event => {
      event.stopPropagation();
      playSound("tap");
      renderNotificationPanel();
      document.getElementById("notificationPanel").classList.toggle("active");
    });
    document.addEventListener("click", () => document.getElementById("notificationPanel")?.classList.remove("active"));
    updateUnreadBadge();
    if (window.lucide) window.lucide.createIcons();
  }

  function renderNotificationPanel() {
    const user = getCurrentUser?.();
    const panel = document.getElementById("notificationPanel");
    if (!user || !panel) return;
    panel.innerHTML = `
      <div class="notification-panel-head">
        <strong>Notifications</strong>
        <button type="button" onclick="AppUX.markNotificationsRead()">Mark read</button>
      </div>
      <div class="notification-filter-row">
        ${["all", "messages", "network"].map(tab => `<button type="button" class="${currentNotificationTab === tab ? "active" : ""}" onclick="AppUX.setNotificationTab('${tab}')">${tab[0].toUpperCase() + tab.slice(1)}</button>`).join("")}
      </div>
      <div id="notificationPanelItems"><p class="notification-empty">Loading notifications...</p></div>
    `;
    loadNotificationItems(currentNotificationTab);
    if (window.lucide) window.lucide.createIcons();
  }

  async function loadNotificationItems(tab = currentNotificationTab) {
    const user = getCurrentUser?.();
    const holder = document.getElementById("notificationPanelItems");
    if (!user || !holder) return;
    try {
      const data = await apiRequest(`/api/notifications?tab=${encodeURIComponent(tab)}&user=${encodeURIComponent(user.name || "")}&company=${encodeURIComponent(user.companyName || "")}`);
      visibleNotificationIds = (data.notifications || []).map(note => note.id);
      holder.innerHTML = (data.notifications || []).map(note => renderNotificationItem(note)).join("") ||
        `<p class="notification-empty">No ${tab} notifications yet.</p>`;
    } catch {
      const db = getDB();
      const items = (db.notifications || [])
        .filter(note => (note.to === user.name || note.to === user.companyName) && notificationTabMatch(note, tab))
        .slice()
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      visibleNotificationIds = items.map(note => note.id);
      holder.innerHTML = items.map(note => renderNotificationItem(note)).join("") ||
        `<p class="notification-empty">No ${tab} notifications yet.</p>`;
    }
    if (window.lucide) window.lucide.createIcons();
  }

  function setNotificationTab(tab) {
    currentNotificationTab = tab || "all";
    renderNotificationPanel();
  }

  function notificationTabMatch(note, tab) {
    const type = String(note.type || "").toLowerCase();
    if (tab === "messages") return ["message", "new_message", "direct_message"].includes(type);
    if (tab === "network") return ["follow", "connection_request", "connection_accepted", "profile_view", "connection"].includes(type);
    return true;
  }

  function notificationActorName(note) {
    const text = String(note.text || "");
    if (note.actor) return note.actor;
    if (note.from) return note.from;
    if (text.startsWith("New message from ")) return text.replace("New message from ", "").trim();
    if (text.includes(" sent you ")) return text.split(" sent you ")[0].trim();
    if (text.includes(" expressed interest")) return text.split(" expressed interest")[0].trim();
    if (text.includes(" rated you ")) return text.split(" rated you ")[0].trim();
    return "";
  }

  function profileUrl(profile) {
    const id = userIdFor(profile || {});
    return `profile/${encodeURIComponent(id)}`;
  }

  function currentPublicProfileUrl() {
    const user = getCurrentUser?.() || {};
    const pathMatch = location.pathname.match(/\/profile\/([^/]+)\/?$/);
    const path = pathMatch ? location.pathname : `/${profileUrl(user)}`;
    return new URL(path, location.origin || location.href).href;
  }

  function startAvatarLongPress(event) {
    avatarLongPressOpened = false;
    clearTimeout(avatarLongPressTimer);
    avatarLongPressTimer = setTimeout(() => {
      avatarLongPressOpened = true;
      event.preventDefault();
      openProfileShareSheet();
    }, 600);
  }

  function cancelAvatarLongPress() {
    clearTimeout(avatarLongPressTimer);
  }

  function avatarClickGuard(event) {
    if (!avatarLongPressOpened) return true;
    event.preventDefault();
    event.stopPropagation();
    avatarLongPressOpened = false;
    return false;
  }

  function openProfileShareSheet() {
    const user = getCurrentUser?.() || {};
    let sheet = document.getElementById("profileShareSheet");
    if (!sheet) {
      sheet = document.createElement("div");
      sheet.id = "profileShareSheet";
      sheet.className = "profile-share-sheet";
      document.body.appendChild(sheet);
    }
    const avatar = user.avatarPhoto?.dataUrl
      ? `<img src="${user.avatarPhoto.dataUrl}" alt="${escapeHTML(user.name || "Profile")}">`
      : `<span>${escapeHTML(user.avatarInitials || initialsForName(user.name || "CH"))}</span>`;
    sheet.innerHTML = `
      <button class="profile-share-scrim" type="button" onclick="AppUX.closeProfileShareSheet()" aria-label="Close profile actions"></button>
      <div class="profile-share-panel">
        <div class="profile-share-avatar">${avatar}</div>
        <div class="profile-share-actions">
          <button type="button" onclick="AppUX.sharePublicProfile()"><i data-lucide="send"></i><span>Share</span></button>
          <button type="button" onclick="AppUX.copyPublicProfileLink()"><i data-lucide="link"></i><span>Copy link</span></button>
          <button type="button" onclick="AppUX.openProfileQrCode()"><i data-lucide="qr-code"></i><span>QR code</span></button>
        </div>
      </div>
    `;
    sheet.classList.add("active");
    if (window.lucide) window.lucide.createIcons();
  }

  function closeProfileShareSheet() {
    document.getElementById("profileShareSheet")?.classList.remove("active");
  }

  async function copyPublicProfileLink() {
    const url = currentPublicProfileUrl();
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    showToast("Link copied!");
  }

  async function sharePublicProfile() {
    const user = getCurrentUser?.() || {};
    const url = currentPublicProfileUrl();
    if (navigator.share) {
      await navigator.share({ title: `${user.name || "ConnectHub"} profile`, text: "Connect with me on ConnectHub", url }).catch(() => {});
    } else {
      await copyPublicProfileLink();
    }
  }

  async function openProfileQrCode() {
    closeProfileShareSheet();
    let modal = document.getElementById("profileQrModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "profileQrModal";
      modal.className = "profile-qr-modal";
      document.body.appendChild(modal);
    }
    const url = currentPublicProfileUrl();
    modal.innerHTML = `
      <button class="profile-qr-scrim" type="button" onclick="AppUX.closeProfileQrCode()" aria-label="Close QR code"></button>
      <div class="profile-qr-card">
        <button class="profile-qr-close" type="button" onclick="AppUX.closeProfileQrCode()"><i data-lucide="x"></i></button>
        <h3>Profile QR code</h3>
        <p>Scan this code to open the public ConnectHub profile.</p>
        <div id="profileQrCanvasWrap" class="profile-qr-canvas"></div>
        <small>${escapeHTML(url)}</small>
      </div>
    `;
    modal.classList.add("active");
    const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=16&data=${encodeURIComponent(url)}`;
    document.getElementById("profileQrCanvasWrap").innerHTML = `<img class="profile-qr-img" src="${qrApi}" alt="Profile QR code" onerror="this.replaceWith(document.createRange().createContextualFragment(AppUX.generateProfileQrFallback('${encodeURIComponent(url)}')))">`;
    if (window.lucide) window.lucide.createIcons();
  }

  function generateProfileQrFallback(encodedUrl) {
    return generateLocalQrSvg(decodeURIComponent(encodedUrl || ""));
  }

  function closeProfileQrCode() {
    document.getElementById("profileQrModal")?.classList.remove("active");
  }

  function generateLocalQrSvg(text) {
    const version = 5;
    const size = 21 + 4 * (version - 1);
    const dataCodewords = 108;
    const ecCodewords = 26;
    const matrix = Array.from({ length: size }, () => Array(size).fill(null));
    const reserved = Array.from({ length: size }, () => Array(size).fill(false));
    const utf8 = new TextEncoder().encode(text);
    if (utf8.length > 106) {
      return `<p>Profile link is too long for the built-in QR generator.</p>`;
    }

    const set = (row, col, value, isReserved = true) => {
      if (row < 0 || col < 0 || row >= size || col >= size) return;
      matrix[row][col] = Boolean(value);
      if (isReserved) reserved[row][col] = true;
    };
    const addFinder = (row, col) => {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const rr = row + r;
          const cc = col + c;
          if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
          const dark = r >= 0 && r <= 6 && c >= 0 && c <= 6 &&
            (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
          set(rr, cc, dark);
        }
      }
    };
    addFinder(0, 0);
    addFinder(0, size - 7);
    addFinder(size - 7, 0);
    for (let i = 8; i < size - 8; i++) {
      set(6, i, i % 2 === 0);
      set(i, 6, i % 2 === 0);
    }
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        set(30 + r, 30 + c, Math.max(Math.abs(r), Math.abs(c)) === 2 || (r === 0 && c === 0));
      }
    }
    for (let i = 0; i < 8; i++) {
      reserved[8][i] = true;
      reserved[i][8] = true;
      reserved[8][size - 1 - i] = true;
      reserved[size - 1 - i][8] = true;
    }
    reserved[8][8] = true;
    set(4 * version + 9, 8, true);

    const bits = [];
    const pushBits = (value, length) => {
      for (let i = length - 1; i >= 0; i--) bits.push(Boolean((value >> i) & 1));
    };
    pushBits(4, 4);
    pushBits(utf8.length, 8);
    utf8.forEach(byte => pushBits(byte, 8));
    const dataBits = dataCodewords * 8;
    for (let i = 0; i < 4 && bits.length < dataBits; i++) bits.push(false);
    while (bits.length % 8) bits.push(false);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      data.push(bits.slice(i, i + 8).reduce((sum, bit) => (sum << 1) | (bit ? 1 : 0), 0));
    }
    for (let pad = 0; data.length < dataCodewords; pad++) data.push(pad % 2 ? 0x11 : 0xec);

    const exp = Array(512).fill(0);
    const log = Array(256).fill(0);
    let x = 1;
    for (let i = 0; i < 255; i++) {
      exp[i] = x;
      log[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];
    const gfMul = (a, b) => (a && b ? exp[log[a] + log[b]] : 0);
    let generator = [1];
    for (let i = 0; i < ecCodewords; i++) {
      const next = Array(generator.length + 1).fill(0);
      generator.forEach((coef, j) => {
        next[j] ^= coef;
        next[j + 1] ^= gfMul(coef, exp[i]);
      });
      generator = next;
    }
    const message = data.concat(Array(ecCodewords).fill(0));
    for (let i = 0; i < data.length; i++) {
      const coef = message[i];
      if (!coef) continue;
      generator.forEach((gen, j) => {
        message[i + j] ^= gfMul(gen, coef);
      });
    }
    const codewords = data.concat(message.slice(-ecCodewords));
    const stream = [];
    codewords.forEach(byte => pushBitsTo(stream, byte, 8));

    let bitIndex = 0;
    let upward = true;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (let step = 0; step < size; step++) {
        const row = upward ? size - 1 - step : step;
        for (let dc = 0; dc < 2; dc++) {
          const c = col - dc;
          if (reserved[row][c]) continue;
          let bit = stream[bitIndex++] || false;
          if ((row + c) % 2 === 0) bit = !bit;
          set(row, c, bit, false);
        }
      }
      upward = !upward;
    }

    const format = "111011111000100";
    const f = index => format[index] === "1";
    for (let i = 0; i <= 5; i++) set(8, i, f(i));
    set(8, 7, f(6));
    set(8, 8, f(7));
    set(7, 8, f(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, f(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, f(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, f(i));

    const quiet = 4;
    const module = 6;
    const dim = (size + quiet * 2) * module;
    const rects = [];
    matrix.forEach((row, r) => row.forEach((dark, c) => {
      if (dark) rects.push(`<rect x="${(c + quiet) * module}" y="${(r + quiet) * module}" width="${module}" height="${module}"/>`);
    }));
    return `<svg class="profile-qr-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" role="img" aria-label="Profile QR code"><rect width="100%" height="100%" fill="#fff"/><g fill="#0f172a">${rects.join("")}</g></svg>`;
  }

  function pushBitsTo(target, value, length) {
    for (let i = length - 1; i >= 0; i--) target.push(Boolean((value >> i) & 1));
  }

  function renderNotificationItem(note) {
    const actorName = notificationActorName(note);
    const profile = getAllProfiles().find(item => item.name === actorName) || { name: actorName || "Connect Hub", avatarInitials: note.avatarInitials || initialsForName(actorName || "CH"), avatarPhoto: note.avatarPhoto || null };
    const text = escapeHTML(note.text || "New notification");
    const actor = escapeHTML(actorName || profile.name || "Connect Hub");
    const message = actorName ? text.replace(actor, "").trim() : text;
    const href = note.actorProfileUrl || profileUrl(profile);
    return `<article class="notification-item ${note.read ? "" : "unread"}">
      <a class="notification-avatar-link" href="${href}" onclick="AppUX.markNotificationsRead()">${avatarMarkup(profile, "user-avatar")}</a>
      <div class="notification-copy">
        <p><a href="${href}" onclick="AppUX.markNotificationsRead()">${actor}</a> ${message}</p>
        <small>${relativeTime(note.createdAt)}</small>
        <div class="notification-actions">
          <button type="button" onclick="AppUX.openNotification('${note.id}')">Open</button>
          <button type="button" onclick="AppUX.removeNotification('${note.id}')">Remove</button>
        </div>
      </div>
      <button type="button" title="Mark read" onclick="AppUX.markNotificationsRead()"><i data-lucide="check"></i></button>
    </article>`;
  }

  function relativeTime(dateValue) {
    const diff = Math.max(0, Date.now() - new Date(dateValue || Date.now()).getTime());
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < minute) return "Just now";
    if (diff < hour) return `${Math.floor(diff / minute)} min ago`;
    if (diff < day) return `${Math.floor(diff / hour)} hr ago`;
    return `${Math.floor(diff / day)}d ago`;
  }

  function installRealtime() {
    const user = getCurrentUser?.();
    if (!user || window.__connectHubSocketStarted) return;
    window.__connectHubSocketStarted = true;
    const loadSocketScript = sources => {
      if (window.io) return startSocket();
      const [src, ...rest] = sources;
      if (!src) return;
      const script = document.createElement("script");
      script.src = src;
      script.crossOrigin = "anonymous";
      script.onload = startSocket;
      script.onerror = () => loadSocketScript(rest);
      document.head.appendChild(script);
    };
    const startSocket = () => {
      if (!window.io) return;
      const token = localStorage.getItem("connecthub_token") || localStorage.getItem("token") || "";
      const socketUrl = location.protocol === "file:" ? undefined : window.location.origin;
      const socket = window.io(socketUrl, {
        auth: { token, userId: user.name, role: user.role },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionDelay: 700,
        reconnectionDelayMax: 4000
      });
      window.ConnectHubSocket = socket;
      const currentNames = () => [getCurrentUser?.()?.name, getCurrentUser?.()?.companyName].filter(Boolean);
      const joinUserRooms = () => currentNames().forEach(name => socket.emit("user:online", name));
      socket.on("connect", () => {
        joinUserRooms();
        updateConnectivityStatus(true);
        document.dispatchEvent(new CustomEvent("connecthub:socket", { detail: { connected: true } }));
      });
      socket.on("disconnect", () => {
        updateConnectivityStatus(navigator.onLine);
        document.dispatchEvent(new CustomEvent("connecthub:socket", { detail: { connected: false } }));
      });
      socket.on("presence:update", names => {
        window.ConnectHubOnlineUsers = names || [];
        document.dispatchEvent(new CustomEvent("connecthub:presence"));
        if (document.body.classList.contains("messages-open")) {
          const target = document.getElementById("msgTo")?.value;
          if (target) openChat(target);
          else renderInbox(document.getElementById("messageSearch")?.value || "");
        }
      });
      socket.on("message:new", message => {
        const db = getDB();
        db.messages = db.messages || [];
        const names = currentNames();
        if (!names.includes(message.from) && !names.includes(message.to)) return;
        if (!db.messages.some(m => m.id === message.id)) {
          db.messages.push(message);
          saveDB(db, { localOnly: true });
        }
        document.dispatchEvent(new CustomEvent("connecthub:message", { detail: message }));
        const activeTarget = document.getElementById("msgTo")?.value;
        if (document.body.classList.contains("messages-open")) {
          if (activeTarget && [message.from, message.to].includes(activeTarget)) {
            document.getElementById("messageDockBody").innerHTML = renderMessageDockBody(activeTarget);
            markVisibleMessagesRead();
          } else {
            renderInbox(document.getElementById("messageSearch")?.value || "");
          }
        }
        updateUnreadBadge();
        playSound("bell");
        if (!document.body.classList.contains("messages-open") && message.from) {
          showToast(`New message from ${message.from}`);
        }
        if (window.lucide) window.lucide.createIcons();
      });
      const handleRealtimeNotification = note => {
        const db = getDB();
        db.notifications = db.notifications || [];
        const names = currentNames();
        if (note?.to && names.length && !names.includes(note.to)) return;
        const normalized = {
          id: note?.id || `not-${Date.now()}`,
          type: note?.type || "activity",
          text: note?.text || "New notification",
          from: note?.from || "",
          to: note?.to || names[0],
          targetUrl: note?.targetUrl || "",
          read: Boolean(note?.read),
          createdAt: note?.createdAt || new Date().toISOString()
        };
        if (!db.notifications.some(item => item.id === normalized.id)) {
          db.notifications.push(normalized);
          saveDB(db, { localOnly: true });
        }
        document.dispatchEvent(new CustomEvent("connecthub:notification", { detail: normalized }));
        updateUnreadBadge();
        renderNotificationPanel();
        showNotificationPop();
      };
      socket.on("notification:new", handleRealtimeNotification);
      socket.on("notifications:update", payload => {
        if (payload?.notification) handleRealtimeNotification(payload.notification);
        renderNotificationPanel();
      });
      socket.on("feed:newPost", post => {
        document.dispatchEvent(new CustomEvent("connecthub:feed-post", { detail: post }));
        showToast("New post added to the feed");
      });
      socket.on("post:updated", payload => {
        document.dispatchEvent(new CustomEvent("connecthub:post-updated", { detail: payload }));
      });
      socket.on("story:new", story => {
        document.dispatchEvent(new CustomEvent("connecthub:story", { detail: story }));
        showToast("New story is live");
      });
      socket.on("message:typing", payload => {
        const activeTarget = document.getElementById("msgTo")?.value;
        if (activeTarget && payload?.from === activeTarget) {
          let indicator = document.getElementById("typingIndicator");
          if (!indicator) {
            indicator = document.createElement("small");
            indicator.id = "typingIndicator";
            indicator.className = "typing-indicator";
            document.querySelector(".chat-full-header")?.appendChild(indicator);
          }
          indicator.textContent = `${activeTarget.split(" ")[0]} is typing...`;
          clearTimeout(window.__connectHubTypingTimer);
          window.__connectHubTypingTimer = setTimeout(() => indicator.remove(), 1800);
        }
      });
      document.addEventListener("input", event => {
        if (event.target?.id !== "msgText") return;
        const to = document.getElementById("msgTo")?.value;
        if (!to) return;
        clearTimeout(window.__connectHubTypingEmitTimer);
        socket.emit("message:typing", {
          to,
          recipientId: to,
          conversationId: currentNames().concat(to).sort().join("__"),
          at: Date.now()
        });
        window.__connectHubTypingEmitTimer = setTimeout(() => {}, 900);
      });
    };
    loadSocketScript(["/socket.io/socket.io.js", "https://cdn.socket.io/4.7.5/socket.io.min.js"]);
    if (!window.__connectHubNotificationPoll) {
      window.__connectHubNotificationPoll = setInterval(() => {
        syncFromBackend?.().then(() => {
          updateUnreadBadge();
          renderNotificationPanel();
        }).catch(() => {});
      }, 20000);
    }
  }

  function installMessageDock() {
    const user = getCurrentUser?.();
    if (!user || document.getElementById("messageDock")) return;
    const page = document.createElement("section");
    page.id = "messageDock";
    page.className = "message-page";
    page.innerHTML = `
      <div class="message-page-header">
        <button class="btn btn-secondary btn-icon" type="button" onclick="AppUX.closeMessages()"><i data-lucide="arrow-left"></i></button>
        <div><h3>Messages</h3><p>Inbox and direct chat</p></div>
      </div>
      <div id="messageDockBody"></div>
    `;
    document.body.appendChild(page);
    if (window.lucide) window.lucide.createIcons();
  }

  function installExplorePage() {
    const user = getCurrentUser?.();
    if (!user || document.getElementById("exploreDock")) return;
    const page = document.createElement("section");
    page.id = "exploreDock";
    page.className = "explore-page";
    page.innerHTML = `
      <div id="exploreDockBody"></div>
    `;
    document.body.appendChild(page);
    if (window.lucide) window.lucide.createIcons();
  }

  function openExplorePage() {
    const page = document.getElementById("exploreDock");
    if (!page) return;
    page.classList.add("active");
    document.body.classList.add("explore-open");
    setBottomActive("explore");
    renderExploreDirectory();
    const body = document.getElementById("exploreDockBody");
    if (body) body.scrollTop = 0;
    syncFromBackend?.().then(() => {
      if (page.classList.contains("active")) {
        renderExploreDirectory(document.getElementById("exploreSearch")?.value || "");
        const latestBody = document.getElementById("exploreDockBody");
        if (latestBody) latestBody.scrollTop = 0;
      }
    }).catch(() => {});
  }

  function closeExplore() {
    document.getElementById("exploreDock")?.classList.remove("active");
    document.body.classList.remove("explore-open");
    updateBottomNav();
  }

  function userIdFor(profile) {
    return (profile.email || profile.name || "user")
      .toLowerCase()
      .replace(/@.*/, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  }

  function exploreItems() {
    const items = getUniversalMarketplaceItems?.() || [];
    const seen = new Set();
    return items.filter(item => {
      const key = `${item.type}-${item.name}-${item.personName || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function renderExploreDirectory(query = "") {
    const body = document.getElementById("exploreDockBody");
    if (!body) return;
    const q = String(query || "").toLowerCase();
    const user = getCurrentUser?.() || {};
    if (!exploreFilters.location) exploreFilters.location = user.city || user.location?.city || "";
    const db = getDB();
    const allItems = exploreItems();
    const recents = recentExploreProfiles(allItems);
    const suggestions = exploreSuggestions(user);
    const localResults = localPeopleSearch(query).slice(0, 8);
    const panels = buildExplorePanels(db, user, localResults);
    const activity = buildExploreActivity(db, user);
    body.innerHTML = `
      <div class="explore-top-search-wrap">
        <div class="explore-search-shell explore-ai-search">
          <div class="explore-search-input google-style ${q ? "has-value" : ""}" role="combobox" aria-expanded="${q ? "true" : "false"}" aria-controls="exploreResults">
            <div class="explore-search-main">
              <span class="explore-ai-icon" aria-hidden="true"><i data-lucide="search"></i></span>
              <input id="exploreSearch" value="${escapeHTML(query)}" placeholder="Search startups, founders, investors..." oninput="AppUX.filterExplore(this.value)" dir="auto" autocomplete="off">
            </div>
            <div class="explore-search-actions">
              <button type="button" onclick="AppUX.startExploreVoice()" aria-label="Voice search"><i data-lucide="mic"></i></button>
              <button type="button" onclick="AppUX.openExploreMediaSheet()" aria-label="Add image or attachment"><i data-lucide="plus"></i></button>
              <button type="button" onclick="AppUX.pickExploreImage('camera')" aria-label="Scan profile QR code"><i data-lucide="scan-line"></i></button>
              <button type="button" onclick="AppUX.useLocationForExplore()" aria-label="Use current location"><i data-lucide="map-pin"></i></button>
            </div>
          </div>
        </div>
        <nav class="explore-filter-row explore-sticky-filters" aria-label="Explore filters">
          <div class="explore-filter-scroll-row">
            <div class="explore-category-pills">${["all", "startups", "founders", "investors", "jobs", "events"].map(key => `<button type="button" class="${exploreFilters.category === key ? "active" : ""}" onclick="AppUX.setExploreCategory('${key}')">${key[0].toUpperCase() + key.slice(1)}</button>`).join("")}</div>
            ${renderExploreSelect("stage", "Stage", ["", "Idea", "Pre-seed", "Seed", "Series A", "Series B", "Growth"], exploreFilters.stage)}
            ${renderExploreSelect("sector", "Sector", ["", "FinTech", "HealthTech", "EdTech", "SaaS", "D2C", "Deeptech", "AgriTech", "Cleantech"], exploreFilters.sector)}
            ${renderExploreSelect("sort", "Sort", ["relevance", "Most Recent", "Top Funded", "Trending"], exploreFilters.sort)}
            <label class="explore-location-field"><i data-lucide="map-pin"></i><input value="${escapeHTML(exploreFilters.location || "")}" placeholder="Location" oninput="AppUX.setExploreFilter('location', this.value)"></label>
          </div>
        </nav>
      </div>
      ${!q ? `<section class="explore-future-shell explore-future-hero">
          <div class="explore-hero-grid"></div>
          <button class="explore-round-action explore-back" type="button" onclick="AppUX.closeExplore()" aria-label="Back"><i data-lucide="arrow-left"></i></button>
          <div class="explore-hero-copy">
            <span class="explore-kicker"><i data-lucide="sparkles"></i> AI Explore</span>
            <h2>Discover India's Startup Ecosystem</h2>
            <p>Search startups, founders, investors, events & ideas</p>
          </div>
          <div class="explore-trending-chips" aria-label="Trending searches"><span>Trending:</span>${["fintech startups", "series A", "AI founders", "Bangalore tech", "SaaS B2B", "healthtech"].map(item => `<button type="button" onclick="AppUX.applyExploreSuggestion('${item}', 'startups')">${item}</button>`).join("")}</div>
          <section class="explore-recents glass-card">
            <div class="explore-section-title"><strong>Recently viewed</strong><button type="button" onclick="AppUX.clearExploreRecents()">Clear all</button></div>
            <div class="explore-recent-row">${recents.map(renderExploreRecent).join("") || panels.founders.slice(0, 5).map(renderExploreRecentProfile).join("") || '<p>No recent profiles yet.</p>'}</div>
          </section>
      </section>` : ""}
      <div class="explore-results-flow">
      <input id="exploreGalleryInput" type="file" accept="image/*" hidden onchange="AppUX.handleExploreImageSearch(this)">
      <input id="exploreCameraInput" type="file" accept="image/*" capture="environment" hidden onchange="AppUX.handleExploreImageSearch(this)">
      <div id="exploreVoicePanel" class="explore-voice-panel" hidden>
        <div class="voice-wave"><span></span><span></span><span></span><span></span></div>
        <div><strong>Listening...</strong><p id="exploreVoiceText">Speak in English, Hindi, Telugu, Arabic, Spanish, French, or Chinese</p></div>
      </div>
      ${exploreImagePreview ? `<div class="explore-image-preview"><img src="${exploreImagePreview}" alt="Search image preview"><span>Image search preview</span><button type="button" onclick="AppUX.clearExploreImagePreview()">Remove</button></div>` : ""}
      <div id="exploreMediaSheet" class="explore-media-sheet" hidden>
        <button class="sheet-scrim" type="button" onclick="AppUX.closeExploreMediaSheet()" aria-label="Close"></button>
        <div class="sheet-panel">
          <span class="sheet-handle"></span>
          <h3>Search with image</h3>
          <p>Take a photo or upload from gallery. ConnectHub will read visible text and place it in search.</p>
          <button type="button" onclick="AppUX.pickExploreImage('camera')"><i data-lucide="camera"></i><span><strong>Take Photo</strong><small>Open device camera</small></span></button>
          <button type="button" onclick="AppUX.pickExploreImage('gallery')"><i data-lucide="images"></i><span><strong>Upload from Gallery/Media</strong><small>Choose an image from your phone</small></span></button>
        </div>
      </div>
        ${q ? `<section class="explore-search-results glass-card">
          <div id="exploreResultsSummary" class="explore-results-summary">Searching ConnectHub intelligence...</div>
          <div id="exploreResults" class="explore-directory">${skeletonLoader(4)}</div>
        </section>` : `<div id="exploreResultsSummary" class="explore-results-summary" hidden></div><div id="exploreResults" class="explore-directory" hidden></div>`}
        <section class="smart-suggestions-bar glass-card">
          <div><i data-lucide="cpu"></i><strong>AI Picks for You</strong></div>
          <div class="smart-suggestion-scroll">${suggestions.map(item => `<button type="button" onclick="AppUX.applyExploreSuggestion('${item.replace(/'/g, "\\'")}')"><span>${item}</span><i data-lucide="arrow-up-right"></i></button>`).join("")}</div>
        </section>
        <div class="explore-content-layout">
          <main class="explore-masonry-grid">
            ${renderTrendingStartupsPanel(panels.startups)}
            ${renderActiveInvestorsPanel(panels.investors)}
            ${renderFeaturedFoundersPanel(panels.founders)}
            ${renderUpcomingEventsPanel(panels.events)}
            ${renderTrendingTopicsPanel(panels.topics)}
          </main>
          <aside class="explore-activity-sidebar">
            ${renderExploreActivitySidebar(activity, panels.stats)}
          </aside>
        </div>
      </div>
    `;
    const input = document.getElementById("exploreSearch");
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
    if (window.lucide) window.lucide.createIcons();
    if (q) loadExplorePeopleResults(query);
    else loadExploreTrending();
    loadExploreBackendPanels(query);
  }

  function renderExploreSelect(key, label, options, value) {
    return `<label class="explore-select-wrap"><span>${label}</span><select onchange="AppUX.setExploreFilter('${key}', this.value)">${options.map(option => {
      const display = option || `All ${label}s`;
      return `<option value="${escapeHTML(option)}" ${String(value || "") === String(option) ? "selected" : ""}>${escapeHTML(display)}</option>`;
    }).join("")}</select><i data-lucide="chevron-down"></i></label>`;
  }

  function buildExplorePanels(db, user, localResults = []) {
    const startups = buildTrendingStartups(db);
    const people = mergePeopleResults(localResults, localPeopleSearch("")).slice(0, 40);
    const investors = people.filter(person => /investor|angel|vc|sponsor|partner/i.test([person.role, person.title].join(" "))).slice(0, 6);
    const founders = people.filter(person => !investors.some(investor => investor.id === person.id)).slice(0, 8);
    const events = buildExploreEvents(db, user);
    const topics = buildTrendingTopics(db, people);
    const stats = {
      connections: (db.connections || []).filter(item => [item.from, item.to].includes(user.name)).length,
      views: Number(user.profileViews || user.views || 24),
      messages: (db.messages || []).filter(item => [item.from, item.to].includes(user.name)).length,
      opportunities: (db.jobs || []).length + (db.freelancerAds || []).length
    };
    return { startups, investors, founders, events, topics, stats };
  }

  function buildTrendingStartups(db) {
    const startups = (db.startups || []).map((startup, index) => {
      const jobs = (db.jobs || []).filter(job => job.startupId === startup.id);
      const posts = (db.startupPromotions || []).filter(post => post.startupName === startup.name);
      const views = Array.isArray(startup.views) ? startup.views.reduce((sum, value) => sum + Number(value || 0), 0) : 40 + index * 12;
      const connections = Number(startup.connections || startup.engagement?.at?.(-1) || jobs.length * 3 || index + 3);
      const postCount = posts.length + jobs.length;
      const trendingScore = Math.round((views * 0.3) + (connections * 0.5) + (postCount * 18 * 0.2));
      return {
        ...startup,
        city: startup.city || ["Bengaluru", "Hyderabad", "Mumbai", "Delhi", "Chennai"][index % 5],
        score: trendingScore,
        change: Math.max(8, Math.min(72, Math.round((startup.engagement?.at?.(-1) || index + 4) * 4))),
        spark: startup.views || [12, 19, 16, 28, 34]
      };
    });
    const filler = exploreItems().filter(item => /startup/i.test([item.type, item.role].join(" "))).map((item, index) => ({
      id: `startup-extra-${index}`,
      name: item.name,
      sector: item.sector || "SaaS",
      stage: item.stage || "Seed",
      city: item.city || "India",
      logoInitials: initialsForName(item.name || "CH"),
      logoColor: "#0f766e",
      score: 40 - index,
      change: 14 + index * 3,
      spark: [8, 12, 18, 16, 24]
    }));
    return mergeByName([...startups, ...filler], "name").sort((a, b) => b.score - a.score).slice(0, 5);
  }

  function buildExploreEvents(db, user) {
    const realEvents = (db.events || []).map((event, index) => ({
      ...event,
      city: event.city || user.city || "Hyderabad",
      type: event.type || (event.isOnline ? "Virtual" : "In-person"),
      attendees: event.rsvpCount || event.attendees || 60 + index * 12,
      date: event.date || new Date(Date.now() + (index + 1) * 86400000).toISOString()
    }));
    const generated = [
      ["Founder Hiring Mixer", "Hybrid", user.city || "Hyderabad", 96],
      ["AI SaaS Demo Night", "Virtual", "Bengaluru", 180],
      ["Investor Office Hours", "In-person", "Mumbai", 72],
      ["D2C Growth Circle", "Hybrid", "Delhi", 88]
    ].map((item, index) => ({
      id: `event-generated-${index}`,
      title: item[0],
      type: item[1],
      city: item[2],
      organizer: "ConnectHub India",
      attendees: item[3],
      date: new Date(Date.now() + (index + 1) * 43200000).toISOString()
    }));
    return mergeByName([...realEvents, ...generated], "title").slice(0, 4);
  }

  function buildTrendingTopics(db, people) {
    const terms = [
      ...(db.jobs || []).flatMap(job => job.tags || []),
      ...(db.freelancerAds || []).flatMap(ad => ad.tags || []),
      ...(db.profilePosts || []).flatMap(post => post.hashtags || post.tags || []),
      ...people.flatMap(person => person.skills || []),
      "AIinIndia", "SeedFunding", "FounderHiring", "BharatSaaS"
    ].filter(Boolean);
    const counts = terms.reduce((map, raw) => {
      const key = String(raw).replace(/^#/, "").replace(/\s+/g, "");
      map[key] = (map[key] || 0) + 1;
      return map;
    }, {});
    return Object.entries(counts)
      .map(([tag, count], index) => ({ tag, count: count * 120 + 300 + index * 17, change: Math.round(12 + count * 9 + index * 2), contributors: people.slice(index, index + 3) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }

  function buildExploreActivity(db, user) {
    const people = allRecentPeopleForExplore().slice(0, 8);
    const events = buildExploreEvents(db, user);
    const startups = buildTrendingStartups(db);
    return [
      ...people.slice(0, 3).map(person => `${person.name} just joined from ${person.city || "India"}`),
      ...startups.slice(0, 3).map(startup => `${startup.name} is trending in ${startup.sector || "startup"}`),
      ...events.slice(0, 3).map(event => `${event.title} starts soon in ${event.city}`)
    ].slice(0, 9);
  }

  function allRecentPeopleForExplore() {
    return mergePeopleResults(getAllProfiles(), localPeopleSearch("")).filter(person => person.name);
  }

  function mergeByName(items, key) {
    const map = new Map();
    items.filter(Boolean).forEach(item => {
      const name = String(item[key] || item.id || "").toLowerCase();
      if (!name) return;
      map.set(name, { ...(map.get(name) || {}), ...item });
    });
    return Array.from(map.values());
  }

  function sparkline(points = []) {
    const values = points.length ? points.map(Number) : [10, 20, 14, 26, 32];
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const coords = values.map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 66;
      const y = 28 - ((value - min) / Math.max(max - min, 1)) * 24;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return `<svg class="explore-sparkline" viewBox="0 0 68 30" aria-hidden="true"><polyline points="${coords}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>`;
  }

  function roleChip(role = "") {
    const bucket = /investor|angel|vc|sponsor/i.test(role) ? "investor" : /founder|startup|owner/i.test(role) ? "founder" : "freelancer";
    const label = bucket === "founder" ? "Founder" : bucket === "investor" ? "Investor" : "Freelancer";
    return `<small class="explore-role-badge ${bucket}">${label}</small>`;
  }

  function renderTrendingStartupsPanel(startups) {
    return `<section class="explore-panel trending-startups-panel glass-card">
      <header><div><h3>Trending Startups</h3><span class="panel-subtitle">Ranked by views, connections and posts</span></div><span class="week-badge">This Week</span><button type="button" onclick="AppUX.applyExploreSuggestion('trending startups', 'startups')">View all <i data-lucide="arrow-right"></i></button></header>
      <div class="startup-rank-list">${startups.map(renderTrendingStartupRow).join("")}</div>
    </section>`;
  }

  function renderTrendingStartupRow(startup, index = 0) {
    return `<article>
        <span class="rank">#${index + 1}</span>
        <span class="startup-logo" style="background:${escapeHTML(startup.logoColor || "#0f766e")}">${escapeHTML(startup.logoInitials || initialsForName(startup.name || "CH"))}</span>
        <div><strong>${escapeHTML(startup.name || "Startup")}</strong><p><span>${escapeHTML(startup.sector || "SaaS")}</span><i data-lucide="map-pin"></i>${escapeHTML(startup.city || "India")}</p></div>
        <span class="stage-badge">${escapeHTML(startup.stage || "Seed")}</span>
        <div class="trend-metric">${sparkline(startup.spark || startup.sparkline || startup.views || [14, 22, 18, 31, 40])}<b>+${startup.change || 18}%</b></div>
        <button type="button" onclick="AppUX.applyExploreSuggestion('${String(startup.name || "startup").replace(/'/g, "\\'")}', 'startups')">Connect</button>
      </article>`;
  }

  async function loadExploreTrending() {
    try {
      const data = await apiRequest("/api/search/trending");
      const chips = document.querySelector(".explore-trending-chips");
      if (chips && Array.isArray(data.topics) && data.topics.length) {
        chips.innerHTML = `<span>Trending:</span>${data.topics.slice(0, 10).map(item => `<button type="button" onclick="AppUX.applyExploreSuggestion('${String(item).replace(/'/g, "\\'")}', 'startups')">${escapeHTML(item)}</button>`).join("")}`;
      }
      const list = document.querySelector(".startup-rank-list");
      if (list && Array.isArray(data.startups) && data.startups.length) {
        list.innerHTML = data.startups.slice(0, 5).map((startup, index) => renderTrendingStartupRow({
          ...startup,
          logoInitials: startup.logoInitials || initialsForName(startup.name || "CH"),
          spark: startup.spark || startup.sparkline || [12, 18, 24, 21, 34],
          change: startup.change || 18
        }, index)).join("");
      }
      if (window.lucide) window.lucide.createIcons();
    } catch {
      // Keep the instant local trending panels when the free backend is waking up.
    }
  }

  function renderActiveInvestorsPanel(investors) {
    const rows = investors.length ? investors : allRecentPeopleForExplore().filter(person => /investor|partner|angel/i.test([person.role, person.title].join(" "))).slice(0, 4);
    return `<section class="explore-panel active-investors-panel glass-card">
      <header><div><h3>Active Investors</h3><span class="panel-subtitle">Angel, VC and sponsor signals</span></div><div class="mini-toggle"><span>Angel</span><span>VC</span></div></header>
      <div class="investor-list">${rows.slice(0, 4).map((person, index) => `<article>${avatarMarkup(person, "user-avatar")}<div><a href="${profileUrl(person)}" onclick="AppUX.saveExploreRecent('${userIdFor(person)}')"><strong>${escapeHTML(person.name || "Investor")}</strong></a><p>${escapeHTML(person.companyName || person.title || "Angel Network")}</p><small>${(person.skills || person.sectors || []).slice(0, 2).map(escapeHTML).join(" · ") || "Seed · India"}</small><em>${12 + index * 4} investments</em></div><button onclick="connectUsers('${String(person.name || "").replace(/'/g, "\\'")}')">Follow</button></article>`).join("")}</div>
    </section>`;
  }

  function renderFeaturedFoundersPanel(founders) {
    return `<section class="explore-panel featured-founders-panel glass-card">
      <header><div><h3>Featured Founders</h3><span class="panel-subtitle">People hiring and building now</span></div><button type="button" onclick="AppUX.applyExploreSuggestion('founders hiring')">Hiring</button></header>
      <div class="founder-mini-grid">${founders.slice(0, 6).map(person => {
        const safeName = String(person.name || "").replace(/'/g, "\\'");
        return `<article>${avatarMarkup(person, "user-avatar")}<a href="${profileUrl(person)}" onclick="AppUX.saveExploreRecent('${person.id || person.handle || userIdFor(person)}')"><strong>${escapeHTML(person.name || "Founder")}</strong></a><p>${escapeHTML(person.companyName || person.startupName || person.role || "Builder")}</p><div>${(person.skills || []).slice(0, 3).map(skill => `<span>${escapeHTML(skill)}</span>`).join("")}</div><footer><button onclick="connectUsers('${safeName}')"><i data-lucide="user-plus"></i></button><button onclick="AppUX.openMessageTo('${safeName}')"><i data-lucide="message-circle"></i></button></footer></article>`;
      }).join("")}</div>
    </section>`;
  }

  function renderUpcomingEventsPanel(events) {
    return `<section class="explore-panel upcoming-events-panel glass-card">
      <header><div><h3>Upcoming Events</h3><span class="panel-subtitle">Meetups, demo days and circles</span></div><i data-lucide="calendar-days"></i></header>
      <div class="event-list">${events.map((event, index) => {
        const date = new Date(event.date || Date.now());
        return `<article class="${index === 0 ? "today" : ""}"><time><b>${date.toLocaleString("en-IN", { day: "2-digit" })}</b><span>${date.toLocaleString("en-IN", { month: "short" })}</span></time><div><strong>${escapeHTML(event.title || "Startup event")}</strong><p>${escapeHTML(event.organizer || "ConnectHub")} · ${Number(event.attendees || 60)} attending</p></div><span>${escapeHTML(event.type || "Hybrid")}</span><button onclick="AppUX.showToast('RSVP saved')">RSVP</button></article>`;
      }).join("")}</div>
    </section>`;
  }

  function renderTrendingTopicsPanel(topics) {
    return `<section class="explore-panel trending-topics-panel glass-card">
      <header><div><h3>What India's Startup Ecosystem is Talking About</h3><span class="panel-subtitle">Hashtags and idea velocity</span></div></header>
      <div class="topic-scroll">${topics.map(topic => `<article><strong>#${escapeHTML(topic.tag)}</strong><p>${formatCompactNumber(topic.count)} posts</p><span><i data-lucide="trending-up"></i> +${topic.change}%</span><div class="avatar-stack">${(topic.contributors || []).slice(0, 3).map(person => avatarMarkup(person, "user-avatar")).join("")}</div><button onclick="AppUX.applyExploreSuggestion('${String(topic.tag).replace(/'/g, "\\'")}', 'startups')">Explore</button></article>`).join("")}</div>
    </section>`;
  }

  function renderExploreActivitySidebar(activity, stats) {
    return `<section class="activity-card glass-card"><h3><span class="live-dot"></span> Live Activity</h3><div class="activity-marquee">${activity.concat(activity).map(text => `<p>${escapeHTML(text)}</p>`).join("")}</div></section>
      <section class="activity-card glass-card"><h3>Your Network Stats</h3><div class="network-stat-grid">${Object.entries(stats).map(([key, value]) => `<span><b data-count="${value}">${value}</b><small>${escapeHTML(key)}</small></span>`).join("")}</div></section>
      <section class="activity-card glass-card"><h3>Quick Actions</h3><div class="quick-action-grid">${[["Post Idea", "lightbulb"], ["Add Startup", "building-2"], ["Share Event", "calendar-plus"], ["Find Co-founder", "users"]].map(item => `<button type="button" onclick="AppUX.applyExploreSuggestion('${item[0]}')"><i data-lucide="${item[1]}"></i><span>${item[0]}</span></button>`).join("")}</div></section>`;
  }

  function renderExploreRecentProfile(profile) {
    const id = userIdFor(profile);
    return `<a class="explore-recent" href="${profileUrl(profile)}" onclick="AppUX.saveExploreRecent('${id}')">${avatarMarkup(profile, "user-avatar")}<span>${escapeHTML(profile.name || "Member")}</span>${roleChip(profile.role || profile.title)}</a>`;
  }

  function formatCompactNumber(value) {
    const n = Number(value || 0);
    if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
    if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  }

  async function loadExploreBackendPanels(query = "") {
    try {
      const params = new URLSearchParams({
        q: query || "",
        type: exploreFilters.category || "all",
        stage: exploreFilters.stage || "",
        sector: exploreFilters.sector || "",
        location: exploreFilters.location || "",
        sort: exploreFilters.sort || "relevance",
        limit: "5"
      });
      const data = await apiRequest(`/api/explore/search?${params.toString()}`);
      const summary = document.getElementById("exploreResultsSummary");
      const visibleCards = document.querySelectorAll(".people-search-card").length;
      if (query && summary && data.total !== undefined) summary.textContent = `${Math.max(Number(data.total || 0), visibleCards)} ecosystem results for "${query}"`;
    } catch {
      // Local-first Explore remains usable while free Render backend wakes up.
    }
  }

  function filterExplore(query) {
    clearTimeout(exploreSearchTimer);
    exploreSearchTimer = setTimeout(() => renderExploreDirectory(query), String(query || "").trim() ? 300 : 0);
  }

  async function loadExplorePeopleResults(query = "") {
    const requestId = ++exploreSearchRequestId;
    const user = getCurrentUser?.() || {};
    const holder = document.getElementById("exploreResults");
    const summary = document.getElementById("exploreResultsSummary");
    if (!holder) return;
    const localResults = localPeopleSearch(query);
    if (summary) summary.textContent = query ? `${localResults.length} instant matches for "${query}"` : "People and startups you may want to connect with";
    holder.innerHTML = localResults.map(renderPeopleSearchCard).join("") ||
      `<div class="empty-message-state">Searching live ConnectHub profiles for '${escapeHTML(query || "your filters")}'...</div>`;
    if (window.lucide) window.lucide.createIcons();
    try {
      const params = new URLSearchParams({
        q: query || "",
        current: user.name || "",
        type: exploreFilters.category || "all",
        location: exploreFilters.location || "",
        stage: exploreFilters.stage || "",
        sector: exploreFilters.sector || "",
        sort: exploreFilters.sort || "relevance",
        limit: "30"
      });
      const data = await apiRequest(`/api/search?${params.toString()}`);
      if (requestId !== exploreSearchRequestId) return;
      const apiResults = [
        ...(data.users || data.people || []),
        ...(data.startups || []),
        ...(data.gigs || [])
      ];
      const results = mergePeopleResults(apiResults, localResults);
      if (summary) summary.textContent = query ? `${results.length} results found for "${query}"` : "People and startups you may want to connect with";
      holder.innerHTML = results.map(renderPeopleSearchCard).join("") ||
        `<div class="empty-message-state">No results found for '${escapeHTML(query || "your filters")}'. Try a name, @username, role, city, skill, company, or startup topic.</div>`;
      if (window.lucide) window.lucide.createIcons();
    } catch {
      // Keep the instant local results when Render is waking up or offline.
    }
  }

  function mergePeopleResults(...groups) {
    const map = new Map();
    groups.flat().filter(Boolean).forEach(person => {
      const key = String(person.email || person.handle || person.id || person.name || "").toLowerCase();
      if (!key) return;
      const existing = map.get(key) || {};
      map.set(key, { ...existing, ...person, skills: [...new Set([...(existing.skills || []), ...(person.skills || [])].filter(Boolean))] });
    });
    return Array.from(map.values()).sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || String(a.name).localeCompare(String(b.name)));
  }

  function localPeopleSearch(query = "") {
    const db = getDB();
    const user = getCurrentUser?.() || {};
    const q = String(query || "").trim().toLowerCase().replace(/^@/, "");
    const queryTerms = expandLocalPeopleSearchTerms(q);
    const currentConnections = new Set((db.connections || [])
      .filter(item => item.from === user.name || item.to === user.name)
      .map(item => item.from === user.name ? item.to : item.from));
    const profiles = mergePeopleResults(getAllProfiles(), user?.name ? [user] : []).map(profile => enrichLocalProfileForSearch(profile, db));
    const people = profiles.map(profile => {
      const startup = profile.startupId ? (db.startups || []).find(item => item.id === profile.startupId) : null;
      const id = userIdFor(profile);
      const location = [profile.city || startup?.city, profile.state || startup?.state].filter(Boolean).join(", ");
      const role = profile.title || (profile.role === "startup_admin" ? "Startup Owner" : profile.role || "Member");
      const companyName = profile.companyName || startup?.name || "";
      const skills = profile.skills || [];
      const tags = [...new Set([...(profile.tags || []), profile.sector, companyName, profile.city].filter(Boolean).map(String))];
      const haystack = [profile.name, id, role, location, skills.join(" "), tags.join(" "), companyName, profile.bio, profile.searchText].join(" ").toLowerCase();
      const score = !q ? 1 :
        String(profile.name || "").toLowerCase() === q ? 100 :
        String(profile.name || "").toLowerCase().startsWith(q) ? 90 :
        id === q ? 95 :
        fuzzyWordsMatch(profile.name, q) ? 86 :
        queryTerms.some(term => role.toLowerCase().includes(term)) ? 70 :
        queryTerms.some(term => location.toLowerCase().includes(term)) ? 55 :
        queryTerms.some(term => skills.join(" ").toLowerCase().includes(term)) ? 50 :
        queryTerms.some(term => haystack.includes(term)) ? 20 : -1;
      return { ...profile, id, handle: id, role, location, companyName, skills, tags, mutualConnections: currentConnections.has(profile.name) ? 1 : 0, profileUrl: profileUrl(profile), score };
    }).filter(profile => {
      if (profile.score < 0) return false;
      const category = String(exploreFilters.category || "all").toLowerCase();
      if (category && category !== "all") {
        const categoryText = [profile.role, profile.roleType, profile.title, profile.companyName, profile.searchText, profile.sector].join(" ").toLowerCase();
        const categoryMap = {
          startups: ["startup", "founder", "owner"],
          founders: ["founder", "co-founder", "startup owner"],
          investors: ["investor", "angel", "vc", "sponsor"],
          jobs: ["job", "hiring", "gig", "opportunity"],
          events: ["event", "meetup", "webinar"],
          ideas: ["idea", "innovation", "builder"]
        };
        const terms = categoryMap[category] || [category];
        if (!terms.some(term => categoryText.includes(term))) return false;
      }
      if (exploreFilters.stage && !String([profile.stage, profile.searchText, profile.companyName].join(" ")).toLowerCase().includes(exploreFilters.stage.toLowerCase())) return false;
      if (exploreFilters.sector && !String([profile.sector, profile.skills?.join(" "), profile.searchText, profile.companyName].join(" ")).toLowerCase().includes(exploreFilters.sector.toLowerCase())) return false;
      if (exploreFilters.role && !String(profile.role || profile.roleType || "").toLowerCase().includes(exploreFilters.role.toLowerCase())) return false;
      if (exploreFilters.location && !String(profile.location || "").toLowerCase().includes(exploreFilters.location.toLowerCase())) return false;
      if (exploreFilters.skills && !String(profile.skills || "").toLowerCase().includes(exploreFilters.skills.toLowerCase())) return false;
      if (exploreFilters.company && !String(profile.companyName || "").toLowerCase().includes(exploreFilters.company.toLowerCase())) return false;
      return true;
    });
    const sort = String(exploreFilters.sort || "relevance").toLowerCase();
    return people.sort((a, b) => {
      if (sort.includes("recent")) return new Date(b.createdAt || b.joinedAt || 0) - new Date(a.createdAt || a.joinedAt || 0) || b.score - a.score;
      if (sort.includes("active") || sort.includes("trending")) return Number(b.mutualConnections || 0) - Number(a.mutualConnections || 0) || b.score - a.score;
      return b.score - a.score || String(a.name).localeCompare(String(b.name));
    });
  }

  function enrichLocalProfileForSearch(profile, db) {
    const relatedAds = (db.freelancerAds || []).filter(ad => ad.freelancerName === profile.name);
    const relatedPosts = (db.profilePosts || []).filter(post => post.authorName === profile.name || post.authorEmail === profile.email);
    const relatedPromos = (db.startupPromotions || []).filter(post => post.startupName === profile.companyName || post.startupName === profile.name);
    const relatedJobs = (db.jobs || []).filter(job => job.startupId === profile.startupId);
    const extraTerms = [
      ...relatedAds.flatMap(ad => [ad.title, ad.category, ad.description, ...(ad.tags || [])]),
      ...relatedPosts.flatMap(post => [post.title, post.description, post.caption, ...(post.tags || [])]),
      ...relatedPromos.flatMap(post => [post.title, post.description, ...(post.tags || [])]),
      ...relatedJobs.flatMap(job => [job.title, job.description, ...(job.tags || [])])
    ].filter(Boolean);
    const inferredSkills = extraTerms.filter(term => /design|editor|editing|video|reel|photo|camera|developer|marketing|sales|branding|ai|web|app/i.test(term));
    return {
      ...profile,
      skills: [...new Set([...(profile.skills || []), ...inferredSkills].map(String))].slice(0, 12),
      searchText: extraTerms.join(" ")
    };
  }

  function fuzzyWordsMatch(name, query) {
    const q = String(query || "").toLowerCase();
    if (!q) return true;
    return String(name || "").toLowerCase().split(/\s+/).some(part => part.startsWith(q) || q.startsWith(part));
  }

  function expandLocalPeopleSearchTerms(query) {
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

  function normalizeKeywordValue(value) {
    return String(value || "")
      .replace(/^#/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function keywordExploreType(keyword) {
    const value = normalizeKeywordValue(keyword).toLowerCase();
    if (!value) return "all";
    if (KEYWORD_INDUSTRY_TERMS.has(value) || [...KEYWORD_INDUSTRY_TERMS].some(term => value.includes(term))) return "startups";
    if (KEYWORD_ROLE_TERMS.has(value) || [...KEYWORD_ROLE_TERMS].some(term => value.includes(term))) return "founders";
    return "all";
  }

  function escapeJS(value) {
    return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\r?\n/g, " ");
  }

  function keywordButton(keyword) {
    const clean = normalizeKeywordValue(keyword);
    if (!clean) return "";
    return `<button type="button" class="keyword-tag" data-keyword="${escapeAttr(clean)}" onclick="searchByKeyword('${escapeJS(clean)}')">${escapeHTML(clean)}</button>`;
  }

  function profileKeywords(profile = {}, limit = 4) {
    const roleLabel = profile.title || profile.roleType || profile.role || "";
    const items = [
      ...(Array.isArray(profile.skills) ? profile.skills : []),
      ...(Array.isArray(profile.tags) ? profile.tags : []),
      profile.industry,
      profile.sector,
      profile.companyName,
      profile.company,
      profile.city,
      roleLabel
    ];
    const seen = new Set();
    const result = [];
    items.forEach(item => {
      const clean = normalizeKeywordValue(item);
      const key = clean.toLowerCase();
      if (!clean || seen.has(key)) return;
      seen.add(key);
      result.push(clean);
    });
    if (!result.length) result.push("Open to connect");
    return result.slice(0, limit);
  }

  function renderKeywordTags(profile = {}, limit = 4) {
    return profileKeywords(profile, limit).map(keywordButton).join("");
  }

  function searchByKeyword(rawKeyword) {
    const keyword = normalizeKeywordValue(rawKeyword);
    if (!keyword) return;
    const type = keywordExploreType(keyword);
    const fallbackUrl = `/explore?q=${encodeURIComponent(keyword)}&type=${encodeURIComponent(type)}`;
    try {
      openExplorePage();
      exploreFilters.category = type;
      applyExploreSuggestion(keyword, type);
      const input = document.getElementById("exploreSearch");
      if (input) input.value = keyword;
      if (window.history?.replaceState) {
        window.history.replaceState(null, "", `${location.pathname}#explore?q=${encodeURIComponent(keyword)}&type=${type}`);
      }
      showToast(`Searching ${keyword}`);
    } catch {
      window.location.href = fallbackUrl;
    }
  }

  window.searchByKeyword = searchByKeyword;

  function renderPeopleSearchCard(person) {
    const safeName = String(person.name || "").replace(/'/g, "\\'");
    const profile = { ...person, email: person.email || person.handle, title: person.role };
    const href = person.profileUrl || profileUrl(profile);
    return `<article class="explore-card people-search-card">
      <div class="explore-card-main">
        <a href="${href}" onclick="AppUX.saveExploreRecent('${person.id || person.handle}')">${avatarMarkup(profile, "user-avatar")}</a>
        <div>
          <a class="profile-name-link" href="${href}" onclick="AppUX.saveExploreRecent('${person.id || person.handle}')"><strong>${escapeHTML(person.name || "ConnectHub member")}</strong></a>
          <small>@${escapeHTML(person.handle || person.id || userIdFor(profile))}</small>
          <p>${escapeHTML(person.role || "Member")}</p>
        </div>
      </div>
      <p class="explore-card-bio"><i data-lucide="map-pin"></i> ${escapeHTML(person.location || "India")} · ${Number(person.mutualConnections || 0)} mutual connections</p>
      <div class="profile-tag-row">${renderKeywordTags(person, 4)}</div>
      <div class="explore-card-actions">
        <a class="btn btn-secondary" href="${href}" onclick="AppUX.saveExploreRecent('${person.id || person.handle}')">Profile</a>
        <button class="btn btn-secondary" onclick="AppUX.toggleSavedProfile('${safeName}')"><i data-lucide="bookmark"></i>Save</button>
        <button class="btn btn-secondary" onclick="connectUsers('${safeName}'); AppUX.showToast('Connection request sent')">Connect</button>
        <button class="btn btn-primary" onclick="AppUX.openMessageTo('${safeName}')">Message</button>
      </div>
    </article>`;
  }

  function renderNetworkPage(container) {
    const user = getCurrentUser?.();
    const db = getDB();
    if (!user) return;
    const people = getAllProfiles().filter(profile => profile.name && profile.name !== user.name);
    const connections = db.connections || [];
    const pendingIn = connections.filter(item => item.to === user.name && item.status === "Pending");
    const pendingOut = connections.filter(item => item.from === user.name && item.status === "Pending");
    const accepted = connections.filter(item => [item.from, item.to].includes(user.name) && item.status === "Accepted");
    const saved = (db.savedProfiles || []).filter(item => item.owner === user.name);
    const connectedNames = new Set(accepted.map(item => item.from === user.name ? item.to : item.from));
    const pendingNames = new Set([...pendingIn, ...pendingOut].map(item => item.from === user.name ? item.to : item.from));
    const suggestions = people
      .filter(profile => !connectedNames.has(profile.name) && !pendingNames.has(profile.name))
      .map(profile => ({ profile, score: networkSuggestionScore(profile, user) }))
      .sort((a, b) => b.score - a.score || a.profile.name.localeCompare(b.profile.name))
      .slice(0, 8)
      .map(item => item.profile);

    container.innerHTML = `
      <section class="network-shell">
        <div class="network-hero glass-panel">
          <div>
            <span class="section-eyebrow">Professional network</span>
            <h2>Build useful startup connections</h2>
            <p>Track requests, message people, save profiles, and discover relevant freelancers, startups, and investors.</p>
          </div>
          <div class="network-stats">
            <span><strong>${accepted.length}</strong> Connections</span>
            <span><strong>${pendingIn.length}</strong> Requests</span>
            <span><strong>${saved.length}</strong> Saved</span>
          </div>
        </div>
        <div class="network-search-panel">
          <div class="network-search-box">
            <i data-lucide="search"></i>
            <input id="networkSearchInput" type="search" placeholder="Search freelancers, startups, investors..." oninput="AppUX.handleNetworkSearchInput()" onkeydown="if(event.key==='Enter') AppUX.runNetworkSearch()">
            <button type="button" onclick="AppUX.runNetworkSearch()">Search</button>
          </div>
          <div class="network-filter-tabs">
            ${[
              ["", "All"],
              ["freelancer", "Freelancers"],
              ["startup", "Startups"],
              ["investor", "Investors"]
            ].map(([role, label], index) => `<button type="button" class="${index === 0 ? "active" : ""}" data-network-role="${role}" onclick="AppUX.setNetworkRoleFilter('${role}')">${label}</button>`).join("")}
          </div>
          <div id="networkSearchResults" class="network-search-results" hidden></div>
        </div>
        ${renderNetworkSection("Connection requests", pendingIn, "request")}
        ${renderNetworkSection("Suggested for you", suggestions, "suggestion")}
        ${renderNetworkSection("My connections", accepted.map(item => people.find(profile => profile.name === (item.from === user.name ? item.to : item.from))).filter(Boolean), "connected")}
        ${renderNetworkSection("Saved profiles", saved.map(item => people.find(profile => profile.name === item.name)).filter(Boolean), "saved")}
      </section>`;
    if (window.lucide) window.lucide.createIcons();
  }

  function networkSuggestionScore(profile, user) {
    const cityMatch = profile.city && user.city && String(profile.city).toLowerCase() === String(user.city).toLowerCase() ? 35 : 0;
    const role = String(profile.role || "").toLowerCase();
    const mine = String(user.role || "").toLowerCase();
    const roleFit = mine.includes("freelancer") && role.includes("startup") ? 30 :
      mine.includes("startup") && role.includes("freelancer") ? 30 :
      mine.includes("investor") && role.includes("startup") ? 30 : 15;
    const filled = [profile.bio, profile.title, profile.city, profile.avatarPhoto, profile.skills?.length].filter(Boolean).length * 5;
    return cityMatch + roleFit + filled;
  }

  function renderNetworkSection(title, rows, mode) {
    return `<section class="network-section">
      <div class="network-section-head"><h3>${escapeHTML(title)}</h3><span>${rows.length}</span></div>
      <div class="network-grid">
        ${rows.length ? rows.map(row => mode === "request" ? renderRequestCard(row) : renderNetworkProfileCard(row, mode)).join("") : `<div class="empty-message-state">No ${escapeHTML(title.toLowerCase())} yet.</div>`}
      </div>
    </section>`;
  }

  function renderRequestCard(request) {
    const profile = getAllProfiles().find(item => item.name === request.from) || { name: request.from, avatarInitials: initialsForName(request.from || "CH") };
    return `<article class="network-card">
      <div class="network-card-main">${avatarMarkup(profile, "user-avatar")}<div><strong>${escapeHTML(profile.name)}</strong><p>${escapeHTML(profile.title || profile.role || "ConnectHub member")}</p></div></div>
      <div class="network-actions">
        <button class="btn btn-primary" onclick="AppUX.respondConnection('${request.id}', 'Accepted')">Accept</button>
        <button class="btn btn-secondary" onclick="AppUX.respondConnection('${request.id}', 'Declined')">Decline</button>
      </div>
    </article>`;
  }

  function renderNetworkProfileCard(profile, mode) {
    const safeName = String(profile.name || "").replace(/'/g, "\\'");
    const saved = isProfileSaved(profile.name);
    return `<article class="network-card">
      <div class="network-card-main">
        <a href="${profileUrl(profile)}">${avatarMarkup(profile, "user-avatar")}</a>
        <div><a class="profile-name-link" href="${profileUrl(profile)}"><strong>${escapeHTML(profile.name)}</strong></a><p>${escapeHTML(profile.title || profile.role || "ConnectHub member")}</p></div>
      </div>
      <div class="profile-tag-row">${renderKeywordTags(profile, 4)}</div>
      <div class="network-actions">
        <button class="btn btn-secondary" onclick="AppUX.toggleSavedProfile('${safeName}')"><i data-lucide="${saved ? "bookmark-check" : "bookmark"}"></i>${saved ? "Saved" : "Save"}</button>
        ${mode === "connected" ? `<button class="btn btn-secondary" onclick="AppUX.removeConnection('${safeName}')">Remove</button>` : `<button class="btn btn-secondary" onclick="connectUsers('${safeName}'); AppUX.showToast('Connection request sent'); AppUX.renderNetworkPage(document.getElementById('body'))">Connect</button>`}
        <button class="btn btn-primary" onclick="AppUX.openMessageTo('${safeName}')">Message</button>
      </div>
    </article>`;
  }

  function setNetworkRoleFilter(role = "") {
    networkRoleFilter = role;
    document.querySelectorAll("[data-network-role]").forEach(button => {
      button.classList.toggle("active", button.dataset.networkRole === role);
    });
    runNetworkSearch();
  }

  function handleNetworkSearchInput() {
    clearTimeout(networkSearchTimer);
    networkSearchTimer = setTimeout(runNetworkSearch, 300);
  }

  async function runNetworkSearch() {
    const input = document.getElementById("networkSearchInput");
    const mount = document.getElementById("networkSearchResults");
    if (!input || !mount) return;
    const query = input.value.trim();
    const user = getCurrentUser?.() || {};
    if (!query && !networkRoleFilter) {
      mount.hidden = true;
      mount.innerHTML = "";
      return;
    }
    mount.hidden = false;
    mount.innerHTML = `<div class="network-search-loading">Searching people...</div>`;
    let results = [];
    try {
      const params = new URLSearchParams({ q: query });
      if (networkRoleFilter) params.set("role", networkRoleFilter);
      const response = await fetch(`/api/people/search?${params.toString()}`);
      if (response.ok) {
        const payload = await response.json();
        results = payload.results || [];
      }
    } catch {
      results = [];
    }
    if (!results.length) {
      results = localNetworkSearch(query, networkRoleFilter, user.name);
    }
    mount.innerHTML = results.length
      ? results.slice(0, 10).map(renderNetworkSearchResult).join("")
      : `<div class="network-search-empty">No results found for "${escapeHTML(query || networkRoleFilter)}".</div>`;
    if (window.lucide) window.lucide.createIcons();
  }

  function localNetworkSearch(query, role, currentName) {
    const q = String(query || "").toLowerCase().replace(/^@/, "");
    const roleFilter = String(role || "").toLowerCase();
    return getAllProfiles()
      .filter(profile => profile.name && profile.name !== currentName)
      .map(profile => {
        const roleText = [profile.role, profile.title].filter(Boolean).join(" ").toLowerCase();
        const text = [
          profile.name,
          profile.handle,
          roleText,
          profile.companyName,
          profile.city,
          profile.state,
          profile.sector,
          ...(profile.skills || []),
          ...(profile.tags || [])
        ].filter(Boolean).join(" ").toLowerCase();
        if (roleFilter && !roleText.includes(roleFilter)) return null;
        if (q && !text.includes(q)) return null;
        const name = String(profile.name || "").toLowerCase();
        const score = name === q ? 100 : name.startsWith(q) ? 90 : roleText.includes(q) ? 70 : text.includes(q) ? 40 : 1;
        return {
          ...profile,
          handle: profile.handle || userIdFor(profile),
          roleType: roleText.includes("startup") ? "startup" : roleText.includes("investor") ? "investor" : "freelancer",
          location: [profile.city, profile.state].filter(Boolean).join(", "),
          tags: [...new Set([...(profile.tags || []), profile.sector, profile.city, profile.companyName].filter(Boolean).map(String))],
          mutualConnections: 0,
          profileUrl: profileUrl(profile),
          score
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name)));
  }

  function renderNetworkSearchResult(profile) {
    const safeName = String(profile.name || "").replace(/'/g, "\\'");
    const handle = profile.handle ? `@${String(profile.handle).replace(/^@/, "")}` : "@connecthub";
    return `<article class="network-search-result">
      <a href="${escapeAttr(profile.profileUrl || profileUrl(profile))}">${avatarMarkup(profile, "user-avatar")}</a>
      <div>
        <a class="profile-name-link" href="${escapeAttr(profile.profileUrl || profileUrl(profile))}"><strong>${escapeHTML(profile.name || "ConnectHub member")}</strong></a>
        <p>${escapeHTML(handle)} · ${escapeHTML(profile.role || profile.title || profile.roleType || "Member")}</p>
        <small>${escapeHTML(profile.location || [profile.city, profile.state].filter(Boolean).join(", ") || "India")} · ${Number(profile.mutualConnections || 0)} mutual connections</small>
        <div class="profile-tag-row">${renderKeywordTags(profile, 4)}</div>
      </div>
      <button type="button" onclick="connectUsers('${safeName}'); AppUX.showToast('Connection request sent')">Connect</button>
    </article>`;
  }

  function isProfileSaved(name) {
    const user = getCurrentUser?.();
    const db = getDB();
    return Boolean(user && (db.savedProfiles || []).some(item => item.owner === user.name && item.name === name));
  }

  function toggleSavedProfile(name) {
    const user = getCurrentUser?.();
    if (!user || !name) return;
    const db = getDB();
    const profile = getAllProfiles().find(item => item.name === name || userIdFor(item) === name);
    db.savedProfiles = db.savedProfiles || [];
    const index = db.savedProfiles.findIndex(item => item.owner === user.name && item.name === name);
    let shouldSave = true;
    if (index >= 0) {
      db.savedProfiles.splice(index, 1);
      shouldSave = false;
      showToast("Removed from saved profiles");
    } else {
      db.savedProfiles.push({ id: `saved-${Date.now()}`, owner: user.name, name, createdAt: new Date().toISOString() });
      showToast("Profile saved");
    }
    saveDB(db);
    if (profile && typeof apiRequest === "function") {
      apiRequest(`/api/network/save/${encodeURIComponent(profile.handle || userIdFor(profile))}`, {
        method: "POST",
        body: JSON.stringify({ saved: shouldSave })
      }).catch(error => console.warn("ConnectHub profile save sync failed:", error.message));
    }
  }

  function respondConnection(id, status) {
    const db = getDB();
    const request = (db.connections || []).find(item => item.id === id);
    if (!request) return;
    request.status = status;
    request.updatedAt = new Date().toISOString();
    if (status === "Accepted") {
      db.notifications.push({ id: `not-${Date.now()}`, to: request.from, type: "connection_accepted", text: `${request.to} accepted your connection request.`, read: false, createdAt: new Date().toISOString() });
    }
    saveDB(db);
    showToast(status === "Accepted" ? "Connection accepted" : "Request declined");
    renderNetworkPage(document.getElementById("body"));
  }

  function removeConnection(name) {
    const user = getCurrentUser?.();
    if (!user || !name) return;
    const db = getDB();
    db.connections = (db.connections || []).filter(item => !([item.from, item.to].includes(user.name) && [item.from, item.to].includes(name)));
    saveDB(db);
    showToast("Connection removed");
    renderNetworkPage(document.getElementById("body"));
  }

  function openExploreFilter(key) {
    const labels = { role: "Role (freelancer, startup, investor)", location: "Location / city", skills: "Skill", company: "Company name" };
    const value = prompt(`Filter by ${labels[key] || key}`, exploreFilters[key] || "");
    if (value === null) return;
    exploreFilters[key] = value.trim();
    renderExploreDirectory(document.getElementById("exploreSearch")?.value || "");
  }

  function openExploreMediaSheet() {
    const sheet = document.getElementById("exploreMediaSheet");
    if (sheet) sheet.hidden = false;
    if (window.lucide) window.lucide.createIcons();
  }

  function closeExploreMediaSheet() {
    const sheet = document.getElementById("exploreMediaSheet");
    if (sheet) sheet.hidden = true;
  }

  function pickExploreImage(source) {
    closeExploreMediaSheet();
    const input = document.getElementById(source === "camera" ? "exploreCameraInput" : "exploreGalleryInput");
    input?.click();
  }

  function clearExploreImagePreview() {
    exploreImagePreview = "";
    renderExploreDirectory(document.getElementById("exploreSearch")?.value || "");
  }

  async function handleExploreImageSearch(input) {
    const file = input?.files?.[0];
    if (!file) return;
    exploreImagePreview = URL.createObjectURL(file);
    const currentQuery = document.getElementById("exploreSearch")?.value || "";
    renderExploreDirectory(currentQuery);
    showToast("Reading image text...");
    try {
      const qrText = await scanExploreQr(file).catch(() => "");
      if (qrText) {
        await openScannedProfile(qrText);
        return;
      }
      const text = await runExploreOCR(file);
      if (text) {
        const possibleProfile = extractConnectHubProfileFromText(text);
        if (possibleProfile) {
          await openScannedProfile(possibleProfile);
          return;
        }
        renderExploreDirectory(text.trim());
        showToast("Image text added to search");
      } else {
        showToast("No readable text found in that image", "error");
      }
    } catch (error) {
      showToast(error.message || "Image search could not read text", "error");
    } finally {
      input.value = "";
    }
  }

  async function openScannedProfile(qrText) {
    const value = String(qrText || "").trim();
    const invalid = "Invalid QR code. Please scan a ConnectHub profile QR code.";
    const localTarget = parseConnectHubProfileValue(value);
    if (localTarget) {
      showToast("Opening ConnectHub profile");
      window.location.href = localTarget;
      return;
    }
    try {
      const result = await apiRequest(`/api/people/resolve?value=${encodeURIComponent(value)}`);
      if (result.profile?.profileUrl) {
        showToast("Opening ConnectHub profile");
        window.location.href = result.profile.profileUrl;
        return;
      }
    } catch {}
    showToast(invalid, "error");
  }

  function parseConnectHubProfileValue(value) {
    if (!value) return "";
    const raw = String(value).trim();
    if (/^@[a-z0-9_.-]+$/i.test(raw)) return `profile/${encodeURIComponent(raw.slice(1).toLowerCase())}`;
    if (/^[a-z0-9_]{2,}$/i.test(raw)) return `profile/${encodeURIComponent(raw.toLowerCase())}`;
    try {
      const parsed = new URL(raw, location.origin);
      const profilePath = parsed.pathname.match(/\/profile\/([^/]+)\/?$/);
      const id = profilePath?.[1] || parsed.searchParams.get("id") || parsed.searchParams.get("name");
      const sameHost = /connecthub-f2sp\.onrender\.com$/i.test(parsed.hostname) || parsed.hostname === location.hostname;
      if (sameHost && id) return `${parsed.origin}/profile/${encodeURIComponent(id)}`;
    } catch {}
    return "";
  }

  function extractConnectHubProfileFromText(text) {
    const clean = String(text || "").replace(/\s+/g, "");
    const urlMatch = clean.match(/https?:\/\/(?:www\.)?connecthub-f2sp\.onrender\.com\/profile\/[a-z0-9_-]+/i);
    if (urlMatch) return urlMatch[0];
    const legacyMatch = clean.match(/profile\.html\?id=([a-z0-9_-]+)/i);
    if (legacyMatch) return `profile/${legacyMatch[1]}`;
    const handleMatch = clean.match(/@([a-z0-9_]{2,})/i);
    return handleMatch ? `@${handleMatch[1]}` : "";
  }

  async function scanExploreQr(file) {
    if ("BarcodeDetector" in window) {
      try {
        const detector = new BarcodeDetector({ formats: ["qr_code"] });
        const bitmap = await createImageBitmap(file);
        const codes = await detector.detect(bitmap);
        if (codes?.[0]?.rawValue) return codes[0].rawValue;
      } catch {}
    }
    if (!window.jsQR) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
        script.onload = resolve;
        script.onerror = () => reject(new Error("QR scanner could not load."));
        document.head.appendChild(script);
      });
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });
    const canvas = document.createElement("canvas");
    const maxSide = 1800;
    const naturalWidth = img.naturalWidth || img.width;
    const naturalHeight = img.naturalHeight || img.height;
    const scale = Math.min(1, maxSide / Math.max(naturalWidth, naturalHeight));
    canvas.width = Math.max(1, Math.round(naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(naturalHeight * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return decodeQrFromCanvas(canvas) || decodeQrFromLikelyCrops(canvas) || "";
  }

  function decodeQrFromCanvas(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const attempts = [
      ctx.getImageData(0, 0, canvas.width, canvas.height),
      thresholdImageData(ctx.getImageData(0, 0, canvas.width, canvas.height), false),
      thresholdImageData(ctx.getImageData(0, 0, canvas.width, canvas.height), true)
    ];
    for (const imageData of attempts) {
      const code = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" });
      if (code?.data) return code.data;
    }
    return "";
  }

  function decodeQrFromLikelyCrops(canvas) {
    const crops = [
      [0.05, 0.05, 0.9, 0.55],
      [0.1, 0.1, 0.8, 0.45],
      [0.2, 0.15, 0.6, 0.45],
      [0, 0, 1, 1]
    ];
    for (const [x, y, w, h] of crops) {
      const crop = document.createElement("canvas");
      crop.width = 900;
      crop.height = 900;
      const ctx = crop.getContext("2d", { willReadFrequently: true });
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(canvas, canvas.width * x, canvas.height * y, canvas.width * w, canvas.height * h, 0, 0, crop.width, crop.height);
      const decoded = decodeQrFromCanvas(crop);
      if (decoded) return decoded;
    }
    return "";
  }

  function thresholdImageData(imageData, invert = false) {
    const data = new Uint8ClampedArray(imageData.data);
    for (let i = 0; i < data.length; i += 4) {
      const gray = (data[i] * 0.299) + (data[i + 1] * 0.587) + (data[i + 2] * 0.114);
      const value = (gray > 150) !== invert ? 255 : 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }
    return new ImageData(data, imageData.width, imageData.height);
  }

  async function runExploreOCR(file) {
    if (!window.Tesseract) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
        script.onload = resolve;
        script.onerror = () => reject(new Error("OCR library could not load."));
        document.head.appendChild(script);
      });
    }
    const result = await window.Tesseract.recognize(file, "eng+hin+tel+ara+spa+fra+chi_sim");
    return result?.data?.text || "";
  }

  function startExploreVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Voice search is not supported in this browser", "error");
      return;
    }
    if (exploreVoiceRecognition) {
      exploreVoiceRecognition.stop();
      exploreVoiceRecognition = null;
      return;
    }
    const panel = document.getElementById("exploreVoicePanel");
    const textNode = document.getElementById("exploreVoiceText");
    exploreVoiceRecognition = new SpeechRecognition();
    exploreVoiceRecognition.lang = navigator.language || "en-IN";
    exploreVoiceRecognition.continuous = false;
    exploreVoiceRecognition.interimResults = true;
    if (panel) panel.hidden = false;
    exploreVoiceRecognition.onresult = event => {
      const transcript = Array.from(event.results).map(result => result[0]?.transcript || "").join(" ").trim();
      if (textNode) textNode.textContent = transcript || "Listening...";
      if (transcript) {
        const input = document.getElementById("exploreSearch");
        if (input) input.value = transcript;
      }
    };
    exploreVoiceRecognition.onend = () => {
      const transcript = document.getElementById("exploreSearch")?.value || "";
      if (panel) panel.hidden = true;
      exploreVoiceRecognition = null;
      if (transcript) renderExploreDirectory(transcript);
    };
    exploreVoiceRecognition.onerror = () => {
      if (panel) panel.hidden = true;
      exploreVoiceRecognition = null;
      showToast("Voice search stopped. Try again.", "error");
    };
    exploreVoiceRecognition.start();
    playSound("nav");
  }

  function recentExploreProfiles(items) {
    if (localStorage.getItem("connecthub_explore_recents_cleared") === "true") return [];
    let recentIds = [];
    try {
      recentIds = JSON.parse(localStorage.getItem("connecthub_explore_recents") || "[]");
    } catch (error) {
      recentIds = [];
    }
    const byId = new Map(items.map(item => {
      const profile = item.avatarProfile || { name: item.personName || item.name, email: item.email };
      return [userIdFor(profile), item];
    }));
    const stored = recentIds.map(id => byId.get(id)).filter(Boolean);
    const fallback = items.filter(item => item.avatarProfile).slice(0, 5);
    return (stored.length ? stored : fallback).slice(0, 5);
  }

  function renderExploreRecent(item) {
    const profile = item.avatarProfile || { name: item.personName || item.name, title: item.title, email: item.email };
    const id = userIdFor(profile);
    const label = profile.name || item.name || "Member";
    return `<a class="explore-recent" href="profile/${encodeURIComponent(id)}" onclick="AppUX.saveExploreRecent('${id}')">
      ${avatarMarkup(profile, "user-avatar")}
      <span>${label}</span>
    </a>`;
  }

  function exploreSuggestions(user) {
    const city = user.city || user.location?.city || "";
    return [
      "startups near me",
      city ? `freelancers in ${city}` : "freelancers near me",
      "investors for seed funding",
      "startup jobs",
      "design freelancers",
      "SaaS founders"
    ];
  }

  function suggestionMatch(item, query, user) {
    if (!query) return true;
    const city = String(user.city || user.location?.city || "").toLowerCase();
    const type = String(item.type || "").toLowerCase();
    const role = String(item.role || "").toLowerCase();
    const sector = String(item.sector || "").toLowerCase();
    const itemCity = String(item.city || "").toLowerCase();
    if (query.includes("near me")) return city ? itemCity === city : Boolean(item.city);
    if (query.includes("startup")) return type.includes("startup") || role.includes("startup");
    if (query.includes("freelancer")) return type.includes("freelancer") || role.includes("freelancer");
    if (query.includes("investor") || query.includes("funding")) return type.includes("investor") || sector.includes("fund");
    if (query.includes("job")) return type.includes("startup") || sector.includes("startup");
    return false;
  }

  function applyExploreSuggestion(query, category = "") {
    if (category) exploreFilters.category = category;
    renderExploreDirectory(query);
  }

  function setExploreCategory(category = "all") {
    exploreFilters.category = category || "all";
    renderExploreDirectory(document.getElementById("exploreSearch")?.value || "");
  }

  function setExploreFilter(key, value = "") {
    exploreFilters[key] = String(value || "").trim();
    clearTimeout(exploreSearchTimer);
    exploreSearchTimer = setTimeout(() => renderExploreDirectory(document.getElementById("exploreSearch")?.value || ""), key === "location" ? 300 : 0);
  }

  function toggleExploreFullscreen() {
    document.getElementById("exploreDock")?.classList.toggle("fullscreen-search");
    showToast(document.getElementById("exploreDock")?.classList.contains("fullscreen-search") ? "Expanded Explore search" : "Compact Explore search");
  }

  function clearExploreRecents() {
    localStorage.setItem("connecthub_explore_recents_cleared", "true");
    localStorage.removeItem("connecthub_explore_recents");
    showToast("Recent profiles cleared");
    renderExploreDirectory("");
  }

  async function useLocationForExplore() {
    try {
      const location = await requestBrowserLocation();
      const user = getCurrentUser();
      if (user) updateCurrentProfile({ location, city: location.city || user.city, state: location.state || user.state });
      showToast("Showing nearby profiles");
      renderExploreDirectory("startups near me");
    } catch (error) {
      showToast(error.message || "Location permission needed", "error");
    }
  }

  function renderExploreCard(item) {
    const profile = item.avatarProfile || { name: item.personName || item.name, title: item.title, email: item.email };
    const targetName = (item.personName || profile.name || item.name).replace(/'/g, "\\'");
    const id = userIdFor(profile);
    const href = profileUrl(profile);
    const online = (window.ConnectHubOnlineUsers || []).includes(profile.name);
    const meta = [item.type, item.sector, item.city].filter(Boolean).join(" • ");
    return `<article class="explore-card">
      <div class="explore-card-main">
        <a class="message-avatar-wrap" href="${href}" onclick="AppUX.saveExploreRecent('${id}')">${avatarMarkup(profile, "user-avatar")}<i class="${online ? "online" : ""}"></i></a>
        <div>
          <a class="profile-name-link" href="${href}" onclick="AppUX.saveExploreRecent('${id}')"><strong>${escapeHTML(item.name || profile.name)}</strong></a>
          <small>@${id}</small>
          <p>${meta || profile.title || "Connect Hub member"}</p>
        </div>
      </div>
      <p class="explore-card-bio">${item.description || profile.bio || "Open to networking and collaboration."}</p>
      <div class="explore-card-actions">
        <a class="btn btn-secondary" href="${href}" onclick="AppUX.saveExploreRecent('${id}')">Profile</a>
        <button class="btn btn-secondary" onclick="connectUsers('${targetName}'); AppUX.showToast('Connection request sent')">Connect</button>
        <button class="btn btn-secondary" onclick="AppUX.reviewUser('${targetName}')">Review</button>
        <button class="btn btn-primary" onclick="AppUX.openMessageTo('${targetName}')">Message</button>
      </div>
    </article>`;
  }

  function reviewUser(name) {
    const rating = prompt(`Rate ${name} from 1 to 5`, "5");
    if (!rating) return;
    const text = prompt("Short review note", "") || "";
    submitReview?.(name, rating, text);
    showToast("Review submitted");
  }

  function saveExploreRecent(id) {
    localStorage.removeItem("connecthub_explore_recents_cleared");
    let recents = [];
    try {
      recents = JSON.parse(localStorage.getItem("connecthub_explore_recents") || "[]");
    } catch (error) {
      recents = [];
    }
    localStorage.setItem("connecthub_explore_recents", JSON.stringify([id, ...recents.filter(item => item !== id)].slice(0, 8)));
  }

  function openMessageTo(name) {
    closeExplore();
    openMessageDock({ skipInbox: true });
    openChat(name);
  }

  function openMessageDock(options = {}) {
    const page = document.getElementById("messageDock");
    if (!page) return;
    page.classList.add("active");
    document.body.classList.add("messages-open");
    setBottomActive("messages");
    if (!options.skipInbox) renderInbox();
    markVisibleMessagesRead();
    syncFromBackend?.().then(() => {
      const activeChatTo = document.getElementById("msgTo")?.value;
      if (page.classList.contains("active") && !activeChatTo && !options.skipInbox) {
        renderInbox(document.getElementById("messageSearch")?.value || "");
      }
      updateUnreadBadge();
    }).catch(() => {});
    if (window.lucide) window.lucide.createIcons();
  }

  function closeMessages() {
    document.getElementById("messageDock")?.classList.remove("active");
    document.body.classList.remove("messages-open");
    updateBottomNav();
  }

  function getMessageContacts() {
    const user = getCurrentUser();
    const db = getDB();
    const seen = new Set();
    const baseProfiles = mergePeopleResults(getAllProfiles(), user?.name ? [user] : [])
      .map(profile => enrichLocalProfileForSearch(profile, db));
    const startupContacts = (db.startups || []).map(startup => ({
      name: startup.name,
      title: `${startup.stage || "Startup"} - ${startup.sector || "Business"}`,
      role: "startup_admin",
      email: startup.id,
      avatarInitials: startup.logoInitials,
      city: startup.city,
      state: startup.state,
      bio: startup.description,
      companyName: startup.name,
      skills: [startup.sector, startup.stage].filter(Boolean)
    }));
    return [...baseProfiles, ...startupContacts]
      .filter(profile => profile?.name && profile.name !== user?.name)
      .filter(profile => {
        const key = String(profile.email || profile.name).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function renderInbox(query = "") {
    document.getElementById("messageDockBody").innerHTML = `
      <div class="message-inbox-tools">
        <div class="message-search"><i data-lucide="search"></i><input id="messageSearch" placeholder="Search messages by name, @id or text" value="${escapeHTML(query)}" oninput="AppUX.filterMessages(this.value)" onkeydown="AppUX.handleMessageSearchKey(event)"></div>
        <button class="btn btn-secondary btn-icon" type="button" onclick="AppUX.focusMessageSearch()" title="New message"><i data-lucide="edit-3"></i></button>
      </div>
      <div class="message-filter-row">
        ${["focused", "jobs", "unread", "network"].map(tab => `<button class="${currentMessageTab === tab ? "active" : ""}" type="button" onclick="AppUX.setMessageTab('${tab}')">${tab[0].toUpperCase() + tab.slice(1)}</button>`).join("")}
      </div>
      <div id="messageRows" class="message-list">${skeletonLoader(4)}</div>
    `;
    if (window.lucide) window.lucide.createIcons();
    const search = document.getElementById("messageSearch");
    if (search && query) {
      search.focus();
      search.setSelectionRange(search.value.length, search.value.length);
    }
    loadInboxRows(query, currentMessageTab);
  }

  function filterMessages(query) {
    renderInbox(query);
  }

  function setMessageTab(tab) {
    currentMessageTab = tab || "focused";
    renderInbox(document.getElementById("messageSearch")?.value || "");
  }

  async function loadInboxRows(query = "", tab = currentMessageTab) {
    const user = getCurrentUser();
    const holder = document.getElementById("messageRows");
    if (!user || !holder) return;
    const localRows = localInboxRows(query, tab);
    holder.innerHTML = localRows.map(renderMessageRow).join("") ||
      `<div class="empty-message-state">No ${tab} messages yet. Checking live profiles...</div>`;
    if (window.lucide) window.lucide.createIcons();
    try {
      const params = new URLSearchParams({ tab, q: query || "", user: user.name || "" });
      const data = await apiRequest(`/api/messages/inbox?${params.toString()}`);
      const merged = mergeMessageRows(data.conversations || [], localRows);
      holder.innerHTML = merged.map(renderMessageRow).join("") ||
        `<div class="empty-message-state">No ${tab} messages yet.</div>`;
      if (window.lucide) window.lucide.createIcons();
    } catch {
      // Keep instant local rows while Render wakes up.
    }
  }

  function mergeMessageRows(...groups) {
    const map = new Map();
    groups.flat().filter(Boolean).forEach(row => {
      const key = String(row.handle || row.email || row.name || "").toLowerCase();
      if (!key) return;
      const existing = map.get(key) || {};
      const chosenLast = new Date(row.recentAt || 0) > new Date(existing.recentAt || 0) ? row : existing;
      map.set(key, { ...existing, ...row, lastMessage: chosenLast.lastMessage || row.lastMessage || existing.lastMessage, recentAt: chosenLast.recentAt || row.recentAt || existing.recentAt, unread: Math.max(Number(existing.unread || 0), Number(row.unread || 0)) });
    });
    return Array.from(map.values()).sort((a, b) => new Date(b.recentAt || 0) - new Date(a.recentAt || 0) || String(a.name).localeCompare(String(b.name)));
  }

  function localInboxRows(query = "", tab = "focused") {
    const user = getCurrentUser();
    const db = getDB();
    const q = String(query || "").trim().toLowerCase();
    const queryTerms = expandLocalPeopleSearchTerms(q);
    const connected = new Set((db.connections || [])
      .filter(item => item.from === user.name || item.to === user.name)
      .map(item => item.from === user.name ? item.to : item.from));
    const jobWords = /\b(hiring|role|opportunity|apply|job|gig)\b/i;
    return getMessageContacts().map(profile => {
      const last = [...(db.messages || [])].reverse().find(m =>
        (m.from === user.name && m.to === profile.name) || (m.from === profile.name && m.to === user.name)
      );
      const unread = (db.messages || []).filter(m => m.from === profile.name && m.to === user.name && !m.read).length;
      const handle = userIdFor(profile);
      const roleType = profile.role === "startup_admin" ? "startup" : profile.role || "freelancer";
      return {
        name: profile.name,
        handle,
        role: profile.title || roleType,
        roleType,
        location: [profile.city, profile.state].filter(Boolean).join(", "),
        skills: profile.skills || [],
        companyName: profile.companyName || "",
        searchText: profile.searchText || profile.bio || "",
        avatarInitials: profile.avatarInitials,
        avatarPhoto: profile.avatarPhoto,
        lastMessage: last,
        lastText: last?.text || "",
        unread,
        connected: connected.has(profile.name),
        recentAt: last?.createdAt || ""
      };
    }).filter(row => {
      const text = [row.name, row.handle, row.role, row.location, row.companyName, (row.skills || []).join(" "), row.searchText, row.lastText].join(" ").toLowerCase();
      if (q && !queryTerms.some(term => text.includes(term))) return false;
      if (tab === "jobs") return row.roleType === "startup" || row.roleType === "recruiter" || jobWords.test(row.lastText);
      if (tab === "unread") return row.unread > 0;
      if (tab === "network") return row.connected && row.roleType !== "startup";
      return true;
    }).sort((a, b) => new Date(b.recentAt || 0) - new Date(a.recentAt || 0) || a.name.localeCompare(b.name));
  }

  function renderMessageRow(row) {
    const online = (window.ConnectHubOnlineUsers || []).includes(row.name);
    const safeName = String(row.name || "").replace(/'/g, "\\'");
    const href = profileUrl({ ...row, email: row.email || row.handle });
    return `<div class="message-row" role="button" tabindex="0" onclick="AppUX.openChat('${safeName}')" onkeydown="if(event.key==='Enter') AppUX.openChat('${safeName}')">
      <a class="message-avatar-wrap" href="${href}" onclick="event.stopPropagation()">${avatarMarkup(row, "user-avatar")}<i class="${online ? "online" : ""}"></i></a>
      <span class="message-row-main">
        <a class="profile-name-link" href="${href}" onclick="event.stopPropagation()"><strong>${escapeHTML(row.name)}</strong></a>
        <small>@${escapeHTML(row.handle || userIdFor(row))} · ${escapeHTML(row.role || "Member")}</small>
        <em>${escapeHTML(messagePreview(row.lastMessage || { text: row.lastText }))}</em>
      </span>
      <span class="message-row-meta"><small>${row.recentAt ? relativeTime(row.recentAt) : ""}</small>${row.unread ? `<b>${row.unread}</b>` : ""}</span>
    </div>`;
  }

  function skeletonLoader(count = 3) {
    return `<div class="skeleton-stack">${Array.from({ length: count }, () => '<div class="skeleton-card"></div>').join("")}</div>`;
  }

  function handleMessageSearchKey(event) {
    if (event.key !== "Enter") return;
    const q = String(event.target.value || "").trim().toLowerCase();
    if (!q) return;
    const match = getMessageContacts().find(profile => {
      const id = userIdFor(profile);
      const text = [profile.name, id, profile.title, profile.role, profile.city, profile.state, profile.companyName, (profile.skills || []).join(" "), profile.searchText, profile.bio].join(" ").toLowerCase();
      return text.includes(q);
    });
    if (match) openChat(match.name);
  }

  function focusMessageSearch() {
    document.getElementById("messageSearch")?.focus();
  }

  function messagePreview(message) {
    if (!message) return "Start a conversation";
    if (message.kind === "image") return "Photo";
    if (message.kind === "voice") return "Voice message";
    if (message.kind === "location") return "Location shared";
    return message.text || "Message";
  }

  function openChat(selectedName) {
    const body = document.getElementById("messageDockBody");
    if (!body) return;
    body.innerHTML = renderMessageDockBody(selectedName);
    markVisibleMessagesRead();
    subscribeFirebaseChat(selectedName);
    syncFromBackend?.().then(() => {
      const currentTarget = document.getElementById("msgTo")?.value;
      if (currentTarget === selectedName) body.innerHTML = renderMessageDockBody(selectedName);
      updateUnreadBadge();
      if (window.lucide) window.lucide.createIcons();
    }).catch(() => {});
    if (window.lucide) window.lucide.createIcons();
  }

  function subscribeFirebaseChat(selectedName) {
    if (!window.ConnectHubFirebaseChat?.enabled?.()) return;
    window.ConnectHubFirebaseChat.subscribeToThread(selectedName, message => {
      const db = getDB();
      db.messages = db.messages || [];
      if (!db.messages.some(item => item.id === message.id)) {
        db.messages.push(message);
        saveDB(db, { localOnly: true });
        const currentTarget = document.getElementById("msgTo")?.value;
        if (currentTarget === selectedName) {
          document.getElementById("messageDockBody").innerHTML = renderMessageDockBody(selectedName);
          if (window.lucide) window.lucide.createIcons();
        }
        updateUnreadBadge();
      }
    }).catch(error => console.warn("ConnectHub Firebase chat subscribe failed:", error.message));
  }

  function escapeHTML(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHTML(value);
  }

  function renderMessageContent(message) {
    const text = escapeHTML(message.text || "");
    if (message.kind === "image" && message.attachment?.dataUrl) {
      return `<img class="chat-attachment-image" src="${message.attachment.dataUrl}" alt="Shared image"><span>${text || "Photo"}</span>`;
    }
    if (message.kind === "voice" && message.attachment?.dataUrl) {
      return `<audio class="chat-attachment-audio" controls src="${message.attachment.dataUrl}"></audio><span>${text || "Voice message"}</span>`;
    }
    if (message.kind === "location" && message.attachment?.latitude) {
      const lat = Number(message.attachment.latitude).toFixed(5);
      const lon = Number(message.attachment.longitude).toFixed(5);
      const mapUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
      return `<a class="chat-location-card" href="${mapUrl}" target="_blank" rel="noopener">
        <i data-lucide="map-pin"></i>
        <span><strong>Shared location</strong><small>${escapeHTML(message.attachment.city || "")} ${escapeHTML(message.attachment.state || "")}</small></span>
      </a>`;
    }
    return text.replace(/\n/g, "<br>");
  }

  function renderMessageDockBody(selectedName) {
    const user = getCurrentUser();
    const db = getDB();
    const profile = getAllProfiles().find(item => item.name === selectedName) || { name: selectedName, title: "Connect Hub member" };
    const online = (window.ConnectHubOnlineUsers || []).includes(selectedName);
    const messages = db.messages.filter(m =>
      (m.from === user.name && m.to === selectedName) || (m.from === selectedName && m.to === user.name)
    );
    return `<div class="chat-full-header">
      <button class="btn btn-secondary btn-icon" onclick="AppUX.renderInbox()" type="button"><i data-lucide="arrow-left"></i></button>
      ${avatarMarkup(profile, "user-avatar")}
      <div><strong>${profile.name}</strong><small>${online ? "Online" : "Offline"} · ${profile.title || profile.role || "Member"}</small></div>
    </div>
    <div class="message-panel full-chat-panel">
      ${messages.map(message => {
        const mine = message.from === user.name;
        return `<div class="message-bubble ${mine ? "mine" : "theirs"}">
          ${renderMessageContent(message)}
          <small>${new Date(message.createdAt || Date.now()).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</small>
        </div>`;
      }).join("") || '<p style="color:#7b8794;text-align:center;padding:1rem;">No messages yet.</p>'}
    </div>
    <div class="chat-compose">
      <input id="msgTo" type="hidden" value="${selectedName}">
      <input id="chatImageInput" type="file" accept="image/*" hidden onchange="AppUX.sendImageMessage(this)">
      <div class="chat-attach-label">Send media and updates</div>
      <div class="chat-quick-actions">
        <button type="button" title="Send photo" onclick="document.getElementById('chatImageInput').click()"><i data-lucide="image"></i><span>Photo</span></button>
        <button type="button" title="Send location" onclick="AppUX.sendLocationMessage()"><i data-lucide="map-pin"></i><span>Location</span></button>
        <button type="button" id="voiceNoteBtn" title="Voice note" onclick="AppUX.toggleVoiceRecording()"><i data-lucide="mic"></i><span>Voice</span></button>
      </div>
      <input id="msgText" class="form-control" placeholder="Message ${profile.name.split(" ")[0]}...">
      <button class="btn btn-primary" onclick="AppUX.sendDockMessage()"><i data-lucide="send"></i></button>
    </div>`;
  }

  function sendDockMessage(extra = {}) {
    const to = document.getElementById("msgTo")?.value;
    const text = document.getElementById("msgText")?.value || extra.text || "";
    if (!to || (!text && !extra.attachment)) return;
    sendLocalMessage(to, text, extra);
    document.getElementById("messageDockBody").innerHTML = renderMessageDockBody(to);
    updateUnreadBadge();
    playSound("done");
    if (window.lucide) window.lucide.createIcons();
  }

  function sendImageMessage(input) {
    const file = input?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return showToast("Choose an image file", "error");
    if (file.size > 900 * 1024) return showToast("Keep images under 900 KB for free storage", "error");
    const reader = new FileReader();
    reader.onload = () => sendDockMessage({
      kind: "image",
      text: document.getElementById("msgText")?.value || "Photo",
      attachment: { dataUrl: reader.result, type: file.type, name: file.name }
    });
    reader.readAsDataURL(file);
  }

  async function sendLocationMessage() {
    try {
      const location = await requestBrowserLocation();
      sendDockMessage({ kind: "location", text: "Shared location", attachment: location });
    } catch (error) {
      showToast(error.message || "Location permission needed", "error");
    }
  }

  let voiceRecorder = null;
  let voiceChunks = [];

  async function toggleVoiceRecording() {
    const button = document.getElementById("voiceNoteBtn");
    if (voiceRecorder && voiceRecorder.state === "recording") {
      voiceRecorder.stop();
      button?.classList.remove("recording");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      showToast("Voice recording is not supported on this browser", "error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceChunks = [];
      voiceRecorder = new MediaRecorder(stream);
      voiceRecorder.ondataavailable = event => {
        if (event.data.size) voiceChunks.push(event.data);
      };
      voiceRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(voiceChunks, { type: voiceRecorder.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => sendDockMessage({
          kind: "voice",
          text: "Voice message",
          attachment: { dataUrl: reader.result, type: blob.type, name: "voice-note.webm" }
        });
        reader.readAsDataURL(blob);
      };
      voiceRecorder.start();
      button?.classList.add("recording");
      showToast("Recording voice note...");
    } catch {
      showToast("Microphone permission needed", "error");
    }
  }

  function markVisibleMessagesRead() {
    const user = getCurrentUser?.();
    if (!user) return;
    const activeTarget = document.getElementById("msgTo")?.value;
    if (!activeTarget) return;
    const db = getDB();
    const names = [user.name, user.companyName].filter(Boolean);
    db.messages.forEach(message => {
      if (names.includes(message.to) && message.from === activeTarget) message.read = true;
    });
    db.notifications.forEach(note => {
      if (names.includes(note.to) && notificationActorName(note) === activeTarget && notificationTabMatch(note, "messages")) note.read = true;
    });
    saveDB(db);
    updateUnreadBadge();
  }

  function updateUnreadBadge() {
    const badge = document.getElementById("unreadBadge");
    const unread = getUnreadCount?.() || 0;
    if (badge) {
      badge.textContent = unread;
      badge.style.display = unread ? "inline-flex" : "none";
    }
    const bottomBadge = document.getElementById("bottomMsgBadge");
    if (bottomBadge) {
      bottomBadge.textContent = unread;
      bottomBadge.style.display = unread ? "inline-flex" : "none";
    }
    const bellCount = document.getElementById("notificationBellCount");
    if (bellCount) {
      bellCount.textContent = unread;
      bellCount.style.display = unread ? "inline-flex" : "none";
    }
    const previous = Number(sessionStorage.getItem("connecthub_unread_seen") || "0");
    if (unread > previous && document.hasFocus()) showNotificationPop();
    sessionStorage.setItem("connecthub_unread_seen", String(unread));
  }

  function showNotificationPop() {
    const user = getCurrentUser?.();
    if (!user) return;
    const names = [user.name, user.companyName].filter(Boolean);
    const latest = (getDB().notifications || [])
      .filter(note => names.includes(note.to) && !note.read)
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
    if (!latest) return;
    playSound("bell");
    let pop = document.getElementById("notificationPop");
    if (!pop) {
      pop = document.createElement("div");
      pop.id = "notificationPop";
      pop.className = "notification-pop";
      document.body.appendChild(pop);
    }
    pop.innerHTML = `
      <button class="notification-pop-main" type="button" onclick="AppUX.openNotification('${latest.id}')">
        <i data-lucide="bell"></i>
        <span>${escapeHTML(latest.text || "New notification")}</span>
      </button>
      <button type="button" aria-label="Remove notification" onclick="AppUX.removeNotification('${latest.id}')"><i data-lucide="x"></i></button>
    `;
    pop.classList.add("active");
    if (window.lucide) window.lucide.createIcons();
    clearTimeout(window.__connectHubNotificationPopTimer);
    window.__connectHubNotificationPopTimer = setTimeout(() => pop.classList.remove("active"), 5200);
  }

  function openNotification(id) {
    const db = getDB();
    const note = (db.notifications || []).find(item => item.id === id);
    if (!note) return;
    note.read = true;
    saveDB(db);
    updateUnreadBadge();
    const target = note.targetUrl || profileUrl(getAllProfiles().find(item => item.name === notificationActorName(note)) || {});
    window.location.href = target || "profile.html";
  }

  function removeNotification(id) {
    const db = getDB();
    db.notifications = (db.notifications || []).filter(note => note.id !== id);
    saveDB(db);
    updateUnreadBadge();
    renderNotificationPanel();
    document.getElementById("notificationPop")?.classList.remove("active");
  }

  function markNotificationsRead() {
    const user = getCurrentUser?.();
    if (!user) return;
    const db = getDB();
    const ids = new Set(visibleNotificationIds);
    db.notifications.forEach(note => {
      if ((ids.size ? ids.has(note.id) : (note.to === user.name || note.to === user.companyName)) && notificationTabMatch(note, currentNotificationTab)) note.read = true;
    });
    saveDB(db);
    if (CONNECTHUB_BACKEND_URL && ids.size) {
      apiRequest("/api/notifications/mark-read", {
        method: "POST",
        body: JSON.stringify({ ids: [...ids] })
      }).catch(error => console.warn("ConnectHub notification mark-read failed:", error.message));
    }
    updateUnreadBadge();
    renderNotificationPanel();
  }

  function openCommandPalette() {
    const palette = document.getElementById("commandPalette");
    if (!palette) return;
    palette.classList.add("active");
    renderCommandResults("");
    setTimeout(() => document.getElementById("commandSearchInput")?.focus(), 40);
    if (window.lucide) window.lucide.createIcons();
  }

  function closeCommandPalette() {
    document.getElementById("commandPalette")?.classList.remove("active");
  }

  function commandItems() {
    const user = getCurrentUser?.() || {};
    const role = String(user.role || "").includes("startup") ? "startup" : String(user.role || "").includes("investor") ? "investor" : "freelancer";
    const people = getAllProfiles().filter(profile => profile.name && profile.name !== user.name).slice(0, 8);
    return [
      { label: "Home dashboard", icon: "home", action: () => window.go?.(homeView) },
      { label: "Explore people", icon: "search", action: () => openExplorePage() },
      { label: "Messages", icon: "message-circle", action: () => openMessageDock() },
      { label: "My Network", icon: "users", action: () => window.go?.("network") },
      { label: "Profile", icon: "user", action: () => window.go?.(profileView) },
      { label: "Settings", icon: "settings", action: () => window.go?.("settings") },
      { label: "AI Hub", icon: "sparkles", action: () => { window.location.href = `/dashboard/aihub?role=${role}`; } },
      { label: "Install app", icon: "download", action: () => installConnectHubApp() },
      ...people.map(profile => ({ label: `Open ${profile.name}`, icon: "user-round", action: () => { window.location.href = profileUrl(profile); } }))
    ];
  }

  function renderCommandResults(query = "") {
    const holder = document.getElementById("commandResults");
    if (!holder) return;
    const q = String(query || "").toLowerCase();
    const rows = commandItems().filter(item => !q || item.label.toLowerCase().includes(q)).slice(0, 10);
    holder.innerHTML = rows.map((item, index) => `
      <button type="button" onclick="AppUX.runCommand(${index}, '${escapeAttr(query)}')">
        <i data-lucide="${item.icon}"></i><span>${escapeHTML(item.label)}</span>
      </button>
    `).join("") || `<p>No command found.</p>`;
    if (window.lucide) window.lucide.createIcons();
  }

  function runCommand(index, query = "") {
    const q = String(query || "").toLowerCase();
    const rows = commandItems().filter(item => !q || item.label.toLowerCase().includes(q)).slice(0, 10);
    closeCommandPalette();
    rows[index]?.action?.();
  }

  async function installConnectHubApp() {
    if (!deferredInstallPrompt) {
      showToast("Use your browser menu: Add to Home Screen");
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice.catch(() => null);
    deferredInstallPrompt = null;
  }

  function installButtonSounds() {
    document.addEventListener("click", event => {
      if (event.target.closest("button, .sidebar-item, .auth-tab, .role-chip")) {
        playSound("tap");
      }
    });
  }

  function installRefreshBar() {
    if (document.getElementById("appRefreshBar")) return;
    const bar = document.createElement("div");
    bar.id = "appRefreshBar";
    bar.className = "app-refresh-bar";
    document.body.appendChild(bar);
  }

  function loadRazorpayCheckout() {
    return new Promise((resolve, reject) => {
      if (window.Razorpay) return resolve();
      const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existing) {
        existing.addEventListener("load", resolve);
        existing.addEventListener("error", reject);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Could not load Razorpay Checkout."));
      document.head.appendChild(script);
    });
  }

  async function startPayment({ amount, purpose, payeeName }) {
    const rupees = Number(amount || prompt("Enter amount in INR"));
    if (!Number.isFinite(rupees) || rupees < 1) {
      alert("Enter a valid payment amount.");
      return;
    }
    try {
      await loadRazorpayCheckout();
      const data = await createRazorpayOrder(rupees, purpose, { payeeName });
      const user = getCurrentUser() || {};
      const options = {
        key: data.keyId,
        amount: data.order.amount,
        currency: data.order.currency,
        name: "Connect Hub",
        description: purpose || "Connect Hub payment",
        order_id: data.order.id,
        prefill: { name: user.name || "", email: "" },
        theme: { color: "#0f766e" },
        handler: async response => {
          try {
            await verifyRazorpayPayment(response);
            playSound("done");
            alert("Payment verified successfully.");
          } catch (error) {
            alert(error.message);
          }
        }
      };
      new window.Razorpay(options).open();
    } catch (error) {
      alert(error.message);
    }
  }

  function enhanceDashboardHome(view) {
    const body = document.getElementById("body");
    if (!body || view !== homeView) return;
    if (body.querySelector(".ch-social-portal")) return;
    body.insertAdjacentHTML("afterbegin", renderSocialPortal());
    window.ConnectHubObserveEntrances?.(body);
    if (window.lucide) window.lucide.createIcons();
  }

  function renderSocialPortal() {
    return `
      <section class="ch-social-portal" aria-label="Feed Dashboard">
        <div class="ch-feed-main">
          <div class="ch-portal-head">
            <div><span class="section-eyebrow">Network Pulse</span><p>What's happening in your startup world</p></div>
            <button class="btn btn-primary ch-desktop-post-btn" type="button" onclick="AppUX.openPostComposer()"><i data-lucide="plus"></i>Post</button>
          </div>
          <div class="ch-feed-section-title">Stories</div>
          <div class="ch-reels-row">${CH_REELS.map(renderReelBubble).join("")}</div>
          <div class="ch-post-feed">${CH_POSTS.map(renderPostCard).join("")}</div>
          <div class="ch-mobile-feed-insights">
            ${renderFeedInsightCards()}
          </div>
        </div>
        <aside class="ch-feed-aside" aria-label="Feed insights">
          ${renderFeedInsightCards()}
        </aside>
        <button class="ch-mobile-post-fab" type="button" onclick="AppUX.openPostComposer()" aria-label="Create post"><i data-lucide="sparkles"></i></button>
      </section>
      ${renderReelModal()}
      ${renderPostComposer()}`;
  }

  function renderFeedInsightCards() {
    return `
      <article>
        <h3>Trending hashtags</h3>
        <div class="ch-aside-tags">${["startup", "freelance", "SaaS", "seed", "figma", "india"].map(tag => `<button type="button" onclick="AppUX.openExplorePage(); AppUX.applyExploreSuggestion('${tag}')">#${tag}</button>`).join("")}</div>
      </article>
      <article>
        <h3>Suggested connections</h3>
        ${CH_POSTS.slice(1, 4).map(post => `<a class="ch-suggested-user" href="profile.html?name=${encodeURIComponent(post.name)}"><span>${escapeHTML(post.initials)}</span><strong>${escapeHTML(post.name)}</strong><small>${escapeHTML(post.role)} · ${escapeHTML(post.city)}</small></a>`).join("")}
      </article>
      <article>
        <h3>Active users</h3>
        <p><span class="ch-live-dot"></span> 24 members active around Indian startup hubs</p>
      </article>`;
  }

  function renderReelBubble(reel, index) {
    const action = reel.type === "create" ? "AppUX.openPostComposer()" : `AppUX.openReel('${reel.id}')`;
    return `<button class="ch-reel-bubble ${reel.type === "create" ? "create" : ""}" type="button" onclick="${action}" style="--delay:${index * 50}ms">
      <span class="ch-reel-ring"><span>${escapeHTML(reel.initials)}</span>${reel.new ? "<i></i>" : ""}</span>
      <strong>${escapeHTML(reel.name)}</strong>
    </button>`;
  }

  function renderPostCard(post, index) {
    const safeName = post.name.replace(/'/g, "\\'");
    const state = getPostState(post.id, post);
    return `<article class="ch-post-card" style="--accent:${post.accent};--delay:${index * 70}ms" data-post-id="${post.id}">
      <header>
        <button class="ch-avatar-button" type="button" onclick="AppUX.openProfileFromPost('${safeName}')">${escapeHTML(post.initials)}</button>
        <div>
          <h3><button type="button" onclick="AppUX.openProfileFromPost('${safeName}')">${escapeHTML(post.name)}</button> <span>${escapeHTML(post.role)}</span></h3>
          <p>${escapeHTML(post.title)} - ${escapeHTML(post.city)} - ${escapeHTML(post.time)} ago</p>
        </div>
        <button class="ch-follow-btn" type="button" onclick="AppUX.toggleFollow(this)">Follow</button>
      </header>
      <p class="ch-post-text">${linkPostTags(decodePostContent(post.text))}</p>
      <div class="ch-post-visual"><div><i data-lucide="image"></i><strong>${escapeHTML(post.title)}</strong><span>${escapeHTML(post.role)} update</span></div></div>
      <div class="ch-post-tags">${post.tags.map(tag => `<button type="button" onclick="AppUX.openExplorePage(); AppUX.applyExploreSuggestion('${tag}')">#${escapeHTML(tag)}</button>`).join("")}</div>
      <footer>
        <button type="button" class="${state.liked ? "active" : ""}" onclick="AppUX.likePost(this, '${post.id}')"><i data-lucide="thumbs-up"></i><span>Like</span><b class="like-count">${state.likes}</b></button>
        <button type="button" onclick="AppUX.togglePostComments('${post.id}')"><i data-lucide="message-circle"></i><span>Comment</span><b class="comment-count">${state.comments}</b></button>
        <button type="button" onclick="AppUX.sharePost('${post.id}')"><i data-lucide="send"></i><span>Share</span><b class="share-count">${state.shares}</b></button>
        <button type="button" class="${state.saved ? "active" : ""}" onclick="AppUX.savePost(this, '${post.id}')"><i data-lucide="${state.saved ? "bookmark-check" : "bookmark"}"></i><span>${state.saved ? "Saved" : "Save"}</span></button>
      </footer>
      <div id="comments-${post.id}" class="ch-comments" hidden>
        <div class="ch-comment-input">
          <input id="comment-input-${post.id}" type="text" placeholder="Write a comment..." onkeydown="if(event.key==='Enter') AppUX.postComment('${post.id}')">
          <button type="button" onclick="AppUX.postComment('${post.id}')">Post</button>
        </div>
        <div id="comments-list-${post.id}" class="ch-comment-list">${renderComments(post.id)}</div>
      </div>
    </article>`;
  }

  function decodePostContent(text = "") {
    return String(text)
      .replace(/&#039;|&apos;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  function postStateStore() {
    try {
      return JSON.parse(localStorage.getItem("connecthub_post_state") || "{}");
    } catch {
      return {};
    }
  }

  function savePostStateStore(state) {
    localStorage.setItem("connecthub_post_state", JSON.stringify(state));
  }

  function getPostState(id, post = {}) {
    const state = postStateStore();
    const saved = state[id] || {};
    return {
      liked: Boolean(saved.liked),
      saved: Boolean(saved.saved),
      likes: Number.isFinite(saved.likes) ? saved.likes : Number(post.likes || 0),
      comments: Number.isFinite(saved.comments) ? saved.comments : Number(post.comments || 0),
      shares: Number.isFinite(saved.shares) ? saved.shares : Number(post.shares || 0),
      commentRows: Array.isArray(saved.commentRows) ? saved.commentRows : [
        { author: "Kamal", text: "Great signal for Indian startups." },
        { author: "ConnectHub", text: "Message them directly from Explore." }
      ]
    };
  }

  function updatePostState(id, patch) {
    const state = postStateStore();
    state[id] = { ...getPostState(id), ...patch };
    savePostStateStore(state);
    return state[id];
  }

  function renderComments(id) {
    return getPostState(id).commentRows.map(row => `<p><strong>${escapeHTML(row.author)}:</strong> ${escapeHTML(row.text)}</p>`).join("");
  }

  function linkPostTags(text = "") {
    return escapeHTML(text).replace(/#([a-z0-9_]+)/gi, `<button type="button" class="inline-tag" onclick="AppUX.openExplorePage(); AppUX.applyExploreSuggestion('$1')">#$1</button>`);
  }

  function renderReelModal() {
    return `<section id="chReelModal" class="ch-reel-modal" aria-hidden="true">
      <button class="ch-reel-close" type="button" onclick="AppUX.closeReel()" aria-label="Close">x</button>
      <button class="ch-reel-nav prev" type="button" onclick="AppUX.prevReel()" aria-label="Previous"><i data-lucide="chevron-left"></i></button>
      <div class="ch-reel-stage"><span class="ch-reel-progress"><i></i></span><div class="ch-reel-card" id="chReelCard"></div></div>
      <button class="ch-reel-nav next" type="button" onclick="AppUX.nextReel()" aria-label="Next"><i data-lucide="chevron-right"></i></button>
    </section>`;
  }

  function renderPostComposer() {
    return `<section id="chPostComposer" class="modal-overlay ch-post-composer">
      <div class="modal-content glass-panel">
        <div class="modal-header"><h3 class="modal-title">Create post</h3><button class="close-btn" onclick="AppUX.closePostComposer()">&times;</button></div>
        <textarea id="chPostText" class="form-control" rows="5" placeholder="What's on your mind?"></textarea>
        <div class="ch-post-toolbar">
          <button type="button"><i data-lucide="image"></i>Photo</button>
          <button type="button"><i data-lucide="video"></i>Video</button>
          <button type="button"><i data-lucide="hash"></i>Hashtag</button>
          <button type="button"><i data-lucide="map-pin"></i>Location</button>
        </div>
        <button class="btn btn-primary" type="button" onclick="AppUX.publishComposedPost()"><i data-lucide="send"></i>Post Now</button>
      </div>
    </section>`;
  }

  let activeReelIndex = 1;

  function openReel(id) {
    activeReelIndex = Math.max(1, CH_REELS.findIndex(reel => reel.id === id));
    renderActiveReel();
    document.getElementById("chReelModal")?.classList.add("active");
    playSound("nav");
  }

  function renderActiveReel() {
    const reel = CH_REELS[activeReelIndex] || CH_REELS[1];
    const card = document.getElementById("chReelCard");
    if (!card) return;
    card.innerHTML = `
      <div class="ch-reel-media" style="--accent:${sectorColor(reel.sector)}"><span>${escapeHTML(reel.initials)}</span></div>
      <div class="ch-reel-overlay"><strong>${escapeHTML(reel.name)}</strong><span>${escapeHTML(reel.role)} - ${escapeHTML(reel.city)}</span><p>${escapeHTML(reel.caption)}</p></div>
      <div class="ch-reel-actions">
        <button onclick="AppUX.playSound('done')"><i data-lucide="heart"></i><span>${escapeHTML(reel.views)}</span></button>
        <button><i data-lucide="message-circle"></i><span>Comment</span></button>
        <button onclick="AppUX.sharePublicProfile()"><i data-lucide="share-2"></i><span>Share</span></button>
        <button onclick="AppUX.toggleFollow(this)"><i data-lucide="user-plus"></i><span>Follow</span></button>
      </div>`;
    if (window.lucide) window.lucide.createIcons();
  }

  function closeReel() { document.getElementById("chReelModal")?.classList.remove("active"); }
  function nextReel() { activeReelIndex = activeReelIndex >= CH_REELS.length - 1 ? 1 : activeReelIndex + 1; renderActiveReel(); }
  function prevReel() { activeReelIndex = activeReelIndex <= 1 ? CH_REELS.length - 1 : activeReelIndex - 1; renderActiveReel(); }

  function sectorColor(sector = "") {
    if (/fin|invest/i.test(sector)) return "#f59e0b";
    if (/ed/i.test(sector)) return "#7c3aed";
    if (/food/i.test(sector)) return "#f97316";
    if (/log/i.test(sector)) return "#3b82f6";
    return "#0f766e";
  }

  function openPostComposer() { document.getElementById("chPostComposer")?.classList.add("active"); }
  function closePostComposer() { document.getElementById("chPostComposer")?.classList.remove("active"); }

  function publishComposedPost() {
    const text = document.getElementById("chPostText")?.value.trim();
    if (!text) return showToast("Write something first", "warning");
    closePostComposer();
    showToast("Post published to your ConnectHub feed");
    playSound("done");
  }

  function likePost(button, id) {
    const active = button.classList.toggle("active");
    const count = button.querySelector("b");
    const next = Math.max(0, Number(count?.textContent || 0) + (active ? 1 : -1));
    if (count) count.textContent = String(next);
    if (id) updatePostState(id, { liked: active, likes: next });
    burst(button, "heart");
    showToast(active ? "Post liked. The creator will be notified." : "Like removed");
  }

  function savePost(button, id) {
    const active = button.classList.toggle("active");
    const label = button.querySelector("span");
    const icon = button.querySelector("svg");
    if (label) label.textContent = active ? "Saved" : "Save";
    if (icon) icon.setAttribute("data-lucide", active ? "bookmark-check" : "bookmark");
    if (id) updatePostState(id, { saved: active });
    showToast(active ? "Saved for later" : "Removed from saved");
    if (window.lucide) window.lucide.createIcons();
  }

  function togglePostComments(id) {
    const section = document.getElementById(`comments-${id}`);
    if (!section) return;
    section.hidden = !section.hidden;
    section.classList.toggle("open", !section.hidden);
  }

  function postComment(id) {
    const input = document.getElementById(`comment-input-${id}`);
    const text = input?.value.trim();
    if (!text) return;
    const user = getCurrentUser?.() || {};
    const state = getPostState(id);
    const commentRows = [...state.commentRows, { author: user.name || "You", text }];
    updatePostState(id, { commentRows, comments: commentRows.length });
    const list = document.getElementById(`comments-list-${id}`);
    if (list) list.innerHTML = renderComments(id);
    const count = document.querySelector(`[data-post-id="${id}"] .comment-count`);
    if (count) count.textContent = String(commentRows.length);
    input.value = "";
    showToast("Comment posted");
  }

  function toggleFollow(button) {
    const following = button.classList.toggle("following");
    button.textContent = following ? "Following" : "Follow";
    showToast(following ? "Connection signal sent" : "Follow removed");
  }

  async function sharePost(id) {
    const url = `${location.origin}${location.pathname}#${id}`;
    if (navigator.share) {
      await navigator.share({ title: "ConnectHub Post", text: "Check this out on ConnectHub", url }).catch(() => {});
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    }
    const count = document.querySelector(`[data-post-id="${id}"] .share-count`);
    const next = Number(count?.textContent || 0) + 1;
    if (count) count.textContent = String(next);
    updatePostState(id, { shares: next });
    showToast("Post link copied");
  }

  function openProfileFromPost(name) {
    saveExploreRecent({ name, role: "Member", avatarInitials: initialsForName(name) });
    window.location.href = `profile.html?name=${encodeURIComponent(name)}`;
  }

  function burst(target, type = "heart") {
    const icon = type === "heart" ? "♥" : "•";
    for (let i = 0; i < 7; i += 1) {
      const particle = document.createElement("span");
      particle.className = "ch-burst";
      particle.textContent = icon;
      particle.style.setProperty("--x", `${(Math.random() - 0.5) * 90}px`);
      particle.style.setProperty("--y", `${-20 - Math.random() * 70}px`);
      target.appendChild(particle);
      setTimeout(() => particle.remove(), 720);
    }
  }

  function onView(view) {
    if (currentView && currentView !== view) historyStack.push(currentView);
    currentView = view;
    document.body.dataset.currentView = view || "";
    document.querySelectorAll(".modal-overlay.active").forEach(overlay => overlay.classList.remove("active"));
    closeMenu();
    animateContent();
    refreshPulse();
    updateBackButton();
    updateBottomNav();
    enhanceDashboardHome(view);
    playSound("nav");
  }

  function renderEditProfilePage(container) {
    const user = getCurrentUser();
    const db = getDB();
    const startup = user?.startupId ? db.startups.find(s => s.id === user.startupId) : null;
    const pct = calculateProfileCompleteness(user);
    const roleFields = user.role === "startup_admin"
      ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.7rem;">
          <div class="form-group"><label>Business Name</label><input id="editBusinessName" class="form-control" value="${startup?.name || user.companyName || ""}"></div>
          <div class="form-group"><label>Sector</label><select id="editSector" class="form-control">${STARTUP_SECTORS.map(s => `<option ${s === (startup?.sector || "") ? "selected" : ""}>${s}</option>`).join("")}</select></div>
        </div>
        <div class="form-group"><label>Funding Goal</label><input id="editFundingGoal" class="form-control" value="${startup?.target || ""}" placeholder="Rs 10 Lakh"></div>`
      : user.role === "investor"
        ? `<div class="form-group"><label>Firm / Angel Network</label><input id="editFirm" class="form-control" value="${user.firmName || ""}" placeholder="Angel network name"></div>`
        : `<div class="form-group"><label>Skill / Professional Title</label><input id="editTitle" class="form-control" value="${user.title || ""}" placeholder="Designer, developer, marketer"></div>`;

    container.innerHTML = `<div class="glass-panel edit-profile-page">
      <h3>Edit Profile</h3>
      <div class="profile-complete">
        <div style="display:flex;justify-content:space-between;gap:1rem;"><strong>Profile</strong><span>${pct}% complete</span></div>
        <div class="profile-complete-track"><span class="profile-complete-fill" style="width:${pct}%"></span></div>
      </div>
      <form onsubmit="AppUX.saveEditProfile(event)" style="margin-top:1rem;">
        <div class="profile-editor">
          <div>
            <label class="avatar-upload-preview" for="editPhoto" onpointerdown="AppUX.startAvatarLongPress(event)" onpointerup="AppUX.cancelAvatarLongPress()" onpointerleave="AppUX.cancelAvatarLongPress()" onpointercancel="AppUX.cancelAvatarLongPress()" onclick="return AppUX.avatarClickGuard(event)">${user.avatarPhoto?.dataUrl ? `<img src="${user.avatarPhoto.dataUrl}" alt="Profile photo">` : `<span>${user.avatarInitials || "CH"}</span>`}</label>
            <input id="editPhoto" type="file" accept="image/png,image/jpeg,image/webp" hidden>
          </div>
          <div>
            <div class="form-group"><label>Full Name</label><input id="editName" class="form-control" value="${user.name || ""}" required></div>
            ${user.role !== "freelancer" ? `<div class="form-group"><label>Professional Title</label><input id="editTitle" class="form-control" value="${user.title || ""}" required></div>` : ""}
          </div>
        </div>
        <div class="form-group"><label>Bio / Short Pitch</label><textarea id="editBio" class="form-control" rows="3" maxlength="200" oninput="document.getElementById('bioCount').textContent=this.value.length">${user.bio || ""}</textarea><small><span id="bioCount">${(user.bio || "").length}</span>/200</small></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.7rem;">
          <div class="form-group"><label>City</label><input id="editCity" class="form-control" value="${user.city || startup?.city || ""}"></div>
          <div class="form-group"><label>State</label><input id="editState" class="form-control" value="${user.state || startup?.state || ""}"></div>
        </div>
        ${roleFields}
        <div class="form-group"><label>WhatsApp Number</label><input id="editWhatsapp" class="form-control" value="${user.whatsapp || ""}" inputmode="tel" placeholder="9876543210"></div>
        <div class="edit-profile-actions">
          <button type="button" class="btn btn-secondary" onclick="AppUX.useCurrentLocationForProfile()"><i data-lucide="map-pin"></i>Use Current Location</button>
          <button class="btn btn-primary" type="submit"><i data-lucide="save"></i>Save Profile</button>
        </div>
      </form>
    </div>`;

    document.getElementById("editPhoto")?.addEventListener("change", event => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        document.querySelector(".avatar-upload-preview").innerHTML = `<img src="${reader.result}" alt="Profile photo preview">`;
      };
      reader.readAsDataURL(file);
    });
    if (window.lucide) window.lucide.createIcons();
  }

  function renderSettingsPage(container, options = {}) {
    const user = getCurrentUser?.() || {};
    const role = options.role || user.role || "freelancer";
    const aiHubUrl = options.aiHubUrl || `/dashboard/aihub?role=${role.includes("startup") ? "startup" : role.includes("investor") ? "investor" : "freelancer"}`;
    const theme = localStorage.getItem("connecthub_theme") || document.documentElement.dataset.theme || "light";
    const roleLabel = role.includes("startup") ? "Startup Owner" : role.includes("investor") ? "Investor" : "Freelancer";
    const language = user.preferredLanguage || localStorage.getItem("connecthub_language") || "en";
    const fontSize = user.fontSizePreference || localStorage.getItem("connecthub_font_size") || "medium";
    const languageLabel = LANGUAGE_OPTIONS.find(item => item.value === language)?.label || "English";
    const fontSizeLabel = FONT_SIZE_OPTIONS.find(item => item.value === fontSize)?.label || "Medium";
    const profileVisibility = user.profileVisibility || (user.accountPrivacy === "private" ? "private" : "public");
    const whoCanMessage = user.whoCanMessage || (user.messagingPrivacy === "network" ? "connections" : user.messagingPrivacy === "none" ? "nobody" : "everyone");
    const profileVisibilityLabel = profileVisibility === "connections" ? "Connections only" : profileVisibility === "private" ? "Private" : "Public";
    const whoCanMessageLabel = whoCanMessage === "connections" ? "Connections only" : whoCanMessage === "nobody" ? "No one" : "Everyone";
    const pref = key => user[key] !== false;
    container.innerHTML = `
      <section class="settings-shell settings-list-page">
        <div class="settings-list-header">
          <button type="button" onclick="AppUX.back()"><i data-lucide="arrow-left"></i></button>
          <h2>Settings</h2>
          <button type="button" onclick="go('${homeView}')">Done</button>
        </div>
        <div class="settings-search">
          <i data-lucide="search"></i>
          <input id="settingsSmartSearch" type="search" placeholder="Search settings..." oninput="AppUX.handleSettingsSearchInput(this.value)" autocomplete="off">
        </div>
        <div id="settingsSmartResults" class="settings-smart-results" aria-live="polite"></div>
        <div class="settings-account-card">
          ${avatarMarkup(user, "user-avatar")}
          <div>
            <strong>${escapeHTML(user.name || "ConnectHub user")}</strong>
            <span>${escapeHTML(user.title || roleLabel)}</span>
          </div>
          <span>${escapeHTML(roleLabel)}</span>
        </div>

        ${renderSettingsGroup("Your Account", [
          ["user-pen", "Edit Profile", "Name, bio, avatar, location", "AppUX.openSettingsEditProfile()"],
          ["key-round", "Change Password", "Send OTP and update passcode", "AppUX.openChangePassword()"],
          ["mail", "Manage Email & Phone", escapeHTML(user.contactEmail || user.email || "Add contact details"), "AppUX.openManageContact()"],
          ["link", "Linked Accounts", "Google, LinkedIn and portfolio links", "AppUX.openLinkedAccounts()"],
          ["sparkles", "AI Hub", "Role-specific intelligence tools", `window.location.href='${escapeAttr(aiHubUrl)}'`]
        ])}
        ${renderSettingsGroup("Privacy & Security", [
          ["eye", "Profile Visibility", profileVisibilityLabel, "AppUX.openProfileVisibilitySelector()"],
          ["message-circle", "Who can message me", whoCanMessageLabel, "AppUX.openMessagingPrivacySelector()"],
          ["users", "Who can see my connections", user.whoCanSeeConnections === false ? "Hidden" : "Visible", "AppUX.saveSettingsToggle('whoCanSeeConnections', this.checked)", user.whoCanSeeConnections !== false],
          ["shield-check", "Two-Factor Authentication", user.twoFactorAuth ? "Enabled" : "Disabled", "AppUX.saveSettingsToggle('twoFactorAuth', this.checked)", Boolean(user.twoFactorAuth)],
          ["monitor-smartphone", "Active Sessions", "This device", "AppUX.openActiveSessions()"],
          ["ban", "Block / Muted Users", "Manage list", "AppUX.openBlockMutedUsers()"]
        ])}
        ${renderSettingsGroup("Notifications", [
          ["user-plus", "Connection requests", pref("connectionRequests") ? "On" : "Off", "AppUX.saveNotificationPref('connectionRequests', this.checked)", pref("connectionRequests")],
          ["message-square", "Messages", pref("messages") ? "On" : "Off", "AppUX.saveNotificationPref('messages', this.checked)", pref("messages")],
          ["heart", "Post likes & comments", pref("postLikes") ? "On" : "Off", "AppUX.saveNotificationPref('postLikes', this.checked)", pref("postLikes")],
          ["briefcase", "Gig applications", pref("gigApplications") ? "On" : "Off", "AppUX.saveNotificationPref('gigApplications', this.checked)", pref("gigApplications")],
          ["megaphone", "Platform announcements", pref("platformAnnouncements") ? "On" : "Off", "AppUX.saveNotificationPref('platformAnnouncements', this.checked)", pref("platformAnnouncements")],
          ["mail", "Email notifications", pref("emailNotifications") ? "On" : "Off", "AppUX.saveNotificationPref('emailNotifications', this.checked)", pref("emailNotifications")],
          ["bell-ring", "Open notification panel", "Recent alerts", "AppUX.openSettingsNotifications()"]
        ])}
        <div class="settings-section-label">Appearance</div>
        <div class="settings-group">
          <div class="settings-row settings-row-tall">
            <span><i data-lucide="palette"></i><b>Theme</b></span>
            <div class="settings-segment">
              <button type="button" class="${theme === "light" ? "active" : ""}" onclick="AppUX.setThemeMode('light')"><i data-lucide="sun"></i>Light</button>
              <button type="button" class="${theme === "dark" ? "active" : ""}" onclick="AppUX.setThemeMode('dark')"><i data-lucide="moon"></i>Dark</button>
              <button type="button" class="${theme === "system" ? "active" : ""}" onclick="AppUX.setThemeMode('system')"><i data-lucide="monitor"></i>System</button>
            </div>
          </div>
          <button class="settings-row" type="button" onclick="AppUX.openLanguageSelector()"><span><i data-lucide="languages"></i><b>Language</b></span><em>${escapeHTML(languageLabel)}</em><i data-lucide="chevron-right"></i></button>
          <button class="settings-row" type="button" onclick="AppUX.openFontSizeSelector()"><span><i data-lucide="type"></i><b>Font size</b></span><em>${escapeHTML(fontSizeLabel)}</em><i data-lucide="chevron-right"></i></button>
        </div>
        ${renderSettingsGroup("Subscription & Billing", [
          ["badge-indian-rupee", "Current Plan", "Free", "AppUX.openCurrentPlan()"],
          ["rocket", "Upgrade to Pro", "Preview", "AppUX.openUpgradePro()"],
          ["receipt", "Billing history", "No invoices yet", "AppUX.openBillingHistory()"]
        ])}
        ${renderSettingsGroup("Data & Activity", [
          ["download", "Download your data", "Export profile", "AppUX.downloadUserData()"],
          ["activity", "Your activity log", "Views and actions", "AppUX.openActivityLog()"],
          ["bookmark", "Saved posts & gigs", "Open saved items", "AppUX.openSettingsSavedPosts()"],
          ["archive", "Archive", "Hidden items", "AppUX.openArchive()"]
        ])}
        ${renderSettingsGroup("Support", [
          ["help-circle", "Help Center", "Guides and support", "AppUX.openHelpCenter()"],
          ["flag", "Report a problem", "Send feedback", "AppUX.openReportProblem()"],
          ["star", "Rate the app", "★★★★★", "AppUX.openRateApp()"],
          ["file-text", "Terms of Service", "Read terms", "AppUX.openTerms()"],
          ["info", "About ConnectHub", "Version 1.0", "AppUX.openAbout()"]
        ])}
        <div class="settings-section-label">Account Actions</div>
        <div class="settings-group">
          <button class="settings-row" type="button" onclick="handleLogout()"><span><i data-lucide="log-out"></i><b>Log Out</b></span><i data-lucide="chevron-right"></i></button>
          <button class="settings-row warning" type="button" onclick="AppUX.openDeactivateAccount()"><span><i data-lucide="pause-circle"></i><b>Deactivate Account</b></span><i data-lucide="chevron-right"></i></button>
          <button class="settings-row danger" type="button" onclick="AppUX.openDeleteAccount()"><span><i data-lucide="trash-2"></i><b>Delete Account</b></span><i data-lucide="chevron-right"></i></button>
        </div>
      </section>`;
    if (window.lucide) window.lucide.createIcons();
  }

  function renderSettingsGroup(label, rows) {
    return `<div class="settings-section-label">${escapeHTML(label)}</div>
      <div class="settings-group">
        ${rows.map(([icon, title, detail, action, toggle]) => {
          if (typeof toggle === "boolean") {
            return `<div class="settings-row"><span><i data-lucide="${escapeAttr(icon)}"></i><b>${escapeHTML(title)}</b></span><em>${escapeHTML(detail || "")}</em><label class="settings-switch"><input type="checkbox" ${toggle ? "checked" : ""} onchange="${action || "AppUX.showToast('Saved locally')"}"><i></i></label></div>`;
          }
          return `<button class="settings-row" type="button" onclick="${action || "AppUX.showToast('Saved locally')"}"><span><i data-lucide="${escapeAttr(icon)}"></i><b>${escapeHTML(title)}</b></span><em>${detail || ""}</em><i data-lucide="chevron-right"></i></button>`;
        }).join("")}
      </div>`;
  }

  function localSettingsSearch(query) {
    const q = String(query || "").trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    const results = LOCAL_SETTINGS_FEATURE_MAP.map(item => {
      const haystack = [item.displayName, item.category, item.description, ...(item.keywordTokens || [])].join(" ").toLowerCase();
      const matchedTokens = (item.keywordTokens || []).filter(token => terms.some(term => token.includes(term) || term.includes(token)));
      let score = item.priority || 0;
      if (!q) score += item.priority || 0;
      if (item.displayName.toLowerCase().includes(q)) score += 60;
      score += matchedTokens.length * 24;
      terms.forEach(term => {
        if (haystack.includes(term)) score += 10;
      });
      return { ...item, score, matchedTokens, suggestion: `Open ${item.displayName} in ${item.category}` };
    })
      .filter(item => !q || item.score > item.priority)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
    return { success: true, q, intent: q ? "settings_navigation" : "popular_settings", suggestions: results.map(item => item.suggestion), results };
  }

  async function runSettingsSearch(query) {
    const panel = document.getElementById("settingsSmartResults");
    if (!panel) return;
    const q = String(query || "").trim();
    if (!q) {
      panel.innerHTML = "";
      panel.classList.remove("active");
      return;
    }
    panel.classList.add("active");
    panel.innerHTML = `<div class="settings-smart-loading"><span></span>Searching settings...</div>`;
    let data = null;
    try {
      data = await apiRequest(`/api/v1/settings/search?q=${encodeURIComponent(q)}`);
    } catch {
      data = localSettingsSearch(q);
    }
    renderSettingsSearchResults(data);
  }

  function renderSettingsSearchResults(data) {
    const panel = document.getElementById("settingsSmartResults");
    if (!panel) return;
    const results = data?.results || [];
    if (!results.length) {
      panel.innerHTML = `<div class="settings-smart-empty">No settings found. Try password, privacy, notifications, saved, or theme.</div>`;
      return;
    }
    panel.innerHTML = `
      <div class="settings-smart-head">
        <span>Intent: ${escapeHTML(data.intent || "settings")}</span>
        <small>${results.length} action${results.length === 1 ? "" : "s"}</small>
      </div>
      ${results.map(item => `<button class="settings-smart-item" type="button" onclick="AppUX.openSettingAction('${escapeAttr(item.deepLinkRoute)}', '${escapeAttr(item.key)}')">
        <i data-lucide="${escapeAttr(item.icon || "settings")}"></i>
        <span><b>${escapeHTML(item.displayName)}</b><small>${escapeHTML(item.category)} - ${escapeHTML(item.description || item.suggestion || "")}</small></span>
        <em>${Math.max(1, Math.min(99, Math.round(item.score || 1)))}%</em>
      </button>`).join("")}`;
    if (window.lucide) window.lucide.createIcons();
  }

  function handleSettingsSearchInput(query) {
    clearTimeout(settingsSearchTimer);
    settingsSearchTimer = setTimeout(() => runSettingsSearch(query), 170);
  }

  function openSettingAction(route, key = "") {
    const panel = document.getElementById("settingsSmartResults");
    if (panel) panel.classList.remove("active");
    const input = document.getElementById("settingsSmartSearch");
    if (input) input.blur();
    const targetKey = String(key || route || "").toLowerCase();
    if (targetKey.includes("password") || route.includes("/security/update")) {
      openChangePassword();
      return;
    }
    if (targetKey.includes("edit-profile") || route.includes("/account/profile")) {
      openSettingsEditProfile();
      return;
    }
    if (targetKey.includes("notification") || route.includes("/notifications")) {
      openSettingsNotifications();
      return;
    }
    if (targetKey.includes("saved") || route.includes("/activity/saved")) {
      openSettingsSavedPosts();
      return;
    }
    if (targetKey.includes("dark-mode") || route.includes("/appearance/theme")) {
      document.querySelector(".settings-segment")?.scrollIntoView({ behavior: "smooth", block: "center" });
      showToast("Theme controls opened");
      return;
    }
    if (targetKey.includes("language") || route.includes("/settings/language")) {
      openLanguageSelector();
      return;
    }
    if (targetKey.includes("font") || route.includes("/accessibility/font-size")) {
      openFontSizeSelector();
      return;
    }
    if (targetKey.includes("privacy") || route.includes("/privacy/visibility")) {
      openProfileVisibilitySelector();
      return;
    }
    if (targetKey.includes("ai-hub")) {
      window.location.href = `/dashboard/aihub?role=${getCurrentUser()?.role || "freelancer"}`;
      return;
    }
    if (targetKey.includes("help")) {
      window.location.href = "tel:6301394850";
      return;
    }
    if (targetKey.includes("logout")) {
      handleLogout();
      return;
    }
    showToast("Setting opened");
  }

  async function openSettingsSavedPosts() {
    openSettingsModal("Saved posts & gigs", `<div class="settings-smart-loading"><span></span>Loading saved items...</div>`);
    let saved = [];
    try {
      const data = await apiRequest("/api/v1/users/saved");
      saved = data.savedPosts || [];
    } catch {
      saved = (getDB().savedPostsByUser?.[getCurrentUser()?.email || getCurrentUser()?.name] || []);
    }
    const modalBody = document.querySelector("#settingsModal .settings-modal-body");
    if (!modalBody) return;
    modalBody.innerHTML = saved.length
      ? `<div class="settings-saved-list">${saved.map(item => {
          const post = item.post || item;
          return `<article class="settings-saved-card">
            <i data-lucide="bookmark"></i>
            <span><b>${escapeHTML(post.title || post.content || item.postId || "Saved item")}</b><small>${escapeHTML(post.author || post.source || "ConnectHub")} - ${escapeHTML(new Date(item.savedAt || post.createdAt || Date.now()).toLocaleDateString("en-IN"))}</small></span>
            <button class="btn btn-secondary" type="button" onclick="AppUX.showToast('Open from Feed or Explore')">Open</button>
          </article>`;
        }).join("")}</div>`
      : `<div class="settings-empty-state"><i data-lucide="bookmark"></i><b>No saved posts yet</b><span>Tap bookmark on posts, gigs, or profiles to save them here.</span></div>`;
    showToast(`Saved folder: ${saved.length} item${saved.length === 1 ? "" : "s"}`);
    if (window.lucide) window.lucide.createIcons();
  }

  function renderAdvancedSettings(role) {
    const roleName = role.includes("startup") ? "Startup" : role.includes("investor") ? "Investor" : "Freelancer";
    return `<section class="advanced-settings">
      <div class="advanced-settings-head">
        <span class="section-eyebrow">Advanced controls</span>
        <h2>Settings for ${escapeHTML(roleName)} Portal</h2>
        <p>Professional-grade controls inspired by modern networking apps. These are saved visually now and ready for backend persistence through /api/settings.</p>
      </div>
      <div class="settings-nav-grid">
        ${[
          ["user-cog", "Profile & Identity", "Photo, cover, bio, skills, portfolio, WhatsApp, LinkedIn, GitHub."],
          ["shield-check", "Privacy & Security", "Visibility, messages, contact info, password, 2FA, sessions."],
          ["bell", "Notifications", "Email and push toggles, quiet hours, sounds, digest frequency."],
          ["palette", "Appearance", "Theme, accent color, font size, compact mode, reduced motion."],
          ["briefcase", "Professional Preferences", "Availability, hiring status, ticket size, sectors, work mode."],
          ["sparkles", "AI & Recommendations", "Smart matches, profile summary, location discovery, AI writing."],
          ["credit-card", "Billing & Subscription", "Free plan, Pro preview, promo code, payment history."],
          ["languages", "Language & Region", "English, Hindi, Telugu, Tamil, Kannada, Marathi, INR and IST."],
          ["accessibility", "Accessibility", "High contrast, reduce motion, large targets, focus indicators."],
          ["link", "Connected Apps", "WhatsApp, LinkedIn, GitHub, Instagram, Calendar, Notion."],
          ["ban", "Blocked Users", "Manage blocked users and unblock profiles."],
          ["bar-chart-3", "Data & Analytics", "Views, search appearances, success rate, data export."],
          ["help-circle", "Help & Support", "FAQ, support email, call support, bug report, feature request."],
          ["log-out", "Account Actions", "Switch role, export profile PDF, sign out, deactivate, delete."]
        ].map(([icon, title, text]) => `
          <article class="settings-card advanced-card">
            <div class="settings-card-head"><i data-lucide="${icon}"></i><div><h3>${title}</h3><p>${text}</p></div></div>
            ${renderAdvancedControls(title, role)}
          </article>`).join("")}
      </div>
    </section>`;
  }

  function renderAdvancedControls(title, role) {
    if (title === "Appearance") {
      return `<div class="settings-form">
        <label>Accent color</label><div class="accent-swatches">${["#0f766e", "#7c3aed", "#2563eb", "#10b981", "#f97316", "#ec4899", "#ef4444", "#f59e0b"].map(color => `<button type="button" style="--swatch:${color}" onclick="document.documentElement.style.setProperty('--teal','${color}'); AppUX.showToast('Accent preview applied')"></button>`).join("")}</div>
        <label>Animation speed</label><select class="form-control"><option>Normal</option><option>Reduced</option><option>Off</option></select>
        <label>Card style</label><select class="form-control"><option>Rounded</option><option>Sharp</option><option>Minimal</option></select>
      </div>`;
    }
    if (title === "Notifications") {
      return `<div class="settings-toggle-list">${["Connection requests", "Messages", "Profile views", "Job matches", "Investor interest", "Post likes", "Weekly digest"].map(label => `<label><span>${label}</span><input type="checkbox" checked></label>`).join("")}</div>`;
    }
    if (title === "Professional Preferences") {
      const roleSpecific = role.includes("investor") ? "Ticket size and preferred sectors" : role.includes("startup") ? "Hiring and fundraising status" : "Availability and project budget";
      return `<div class="settings-form"><input class="form-control" placeholder="${roleSpecific}"><select class="form-control"><option>Available Now</option><option>Available Soon</option><option>Paused</option></select></div>`;
    }
    if (title === "Help & Support") {
      return `<div class="settings-actions"><a class="btn btn-secondary" href="mailto:support@connecthub.in">Email Support</a><a class="btn btn-secondary" href="tel:6301394850">Call 6301394850</a></div>`;
    }
    if (title === "Account Actions") {
      return `<div class="settings-actions"><button class="btn btn-secondary" onclick="AppUX.showToast('Role switch will be available after backend verification')">Switch Role</button><button class="btn btn-secondary danger-soft" onclick="handleLogout()">Sign Out</button></div>`;
    }
    return `<div class="settings-actions"><button class="btn btn-secondary" onclick="AppUX.showToast('${escapeAttr(title)} saved locally')">Configure</button><button class="btn btn-primary" onclick="AppUX.showToast('Saved')">Save</button></div>`;
  }

  function setThemeMode(mode) {
    const next = mode === "dark" ? "dark" : mode === "system" ? "system" : "light";
    const applied = next === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : next === "system" ? "light" : next;
    document.documentElement.dataset.theme = applied;
    document.documentElement.classList.toggle("dark", applied === "dark");
    localStorage.setItem("connecthub_theme", next);
    playSound("nav");
    const body = document.getElementById("body");
    if (body && currentView === "settings") renderSettingsPage(body);
  }

  function installAccessibilityPreferences() {
    const user = getCurrentUser?.() || {};
    applyAccessibilityPreferences({
      preferredLanguage: user.preferredLanguage || localStorage.getItem("connecthub_language") || "en",
      fontSizePreference: user.fontSizePreference || localStorage.getItem("connecthub_font_size") || "medium"
    });
  }

  function applyAccessibilityPreferences(preferences = {}) {
    const language = LANGUAGE_OPTIONS.some(item => item.value === preferences.preferredLanguage) ? preferences.preferredLanguage : "en";
    const fontSize = FONT_SIZE_OPTIONS.some(item => item.value === preferences.fontSizePreference) ? preferences.fontSizePreference : "medium";
    document.documentElement.dataset.language = language;
    document.documentElement.dataset.fontScale = fontSize;
    localStorage.setItem("connecthub_language", language);
    localStorage.setItem("connecthub_font_size", fontSize);
  }

  async function persistSettingsPreferences(patch) {
    const cleaned = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined && value !== null));
    updateCurrentProfile(cleaned);
    applyAccessibilityPreferences({
      preferredLanguage: cleaned.preferredLanguage || getCurrentUser()?.preferredLanguage || localStorage.getItem("connecthub_language") || "en",
      fontSizePreference: cleaned.fontSizePreference || getCurrentUser()?.fontSizePreference || localStorage.getItem("connecthub_font_size") || "medium"
    });
    try {
      await apiRequest("/api/v1/settings/preferences", {
        method: "PATCH",
        body: JSON.stringify(cleaned)
      });
    } catch (error) {
      console.warn("ConnectHub settings preference sync failed:", error.message);
    }
    const body = document.getElementById("body");
    if (body && currentView === "settings") renderSettingsPage(body);
  }

  function installSettingsOverlays() {
    if (window.__connectHubSettingsOverlayInstalled) return;
    window.__connectHubSettingsOverlayInstalled = true;
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      closeSettingsModal();
      closeSettingsBottomSheet();
    });
  }

  function openSettingsModal(title, bodyHTML, options = {}) {
    closeSettingsModal();
    const modal = document.createElement("div");
    modal.id = "settingsModal";
    modal.className = "settings-modal-overlay";
    modal.innerHTML = `
      <div class="settings-modal-card ${options.wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${escapeAttr(title)}" onclick="event.stopPropagation()">
        <div class="settings-modal-header">
          <div>
            <span>${escapeHTML(options.eyebrow || "ConnectHub settings")}</span>
            <h3>${escapeHTML(title)}</h3>
          </div>
          <button type="button" class="settings-icon-btn" onclick="AppUX.closeSettingsModal()" aria-label="Close"><i data-lucide="x"></i></button>
        </div>
        <div class="settings-modal-body">${bodyHTML}</div>
      </div>`;
    modal.addEventListener("click", closeSettingsModal);
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add("active"));
    if (window.lucide) window.lucide.createIcons();
    const autofocus = modal.querySelector("[autofocus]");
    if (autofocus) setTimeout(() => autofocus.focus(), 80);
    return modal;
  }

  function closeSettingsModal() {
    const modal = document.getElementById("settingsModal");
    if (!modal) return;
    modal.classList.remove("active");
    setTimeout(() => modal.remove(), 180);
  }

  function openSettingsBottomSheet(title, options, selectedValue, onSelect) {
    closeSettingsBottomSheet();
    settingsSheetSelect = onSelect;
    const sheet = document.createElement("div");
    sheet.id = "settingsBottomSheet";
    sheet.className = "settings-sheet-overlay";
    sheet.innerHTML = `
      <section class="settings-sheet-card" onclick="event.stopPropagation()" aria-label="${escapeAttr(title)}">
        <div class="settings-sheet-handle"></div>
        <div class="settings-modal-header compact">
          <div><span>Choose option</span><h3>${escapeHTML(title)}</h3></div>
          <button type="button" class="settings-icon-btn" onclick="AppUX.closeSettingsBottomSheet()" aria-label="Close"><i data-lucide="x"></i></button>
        </div>
        <div class="settings-sheet-options">
          ${options.map(option => `
            <button class="settings-option-row ${String(option.value) === String(selectedValue) ? "active" : ""}" type="button" onclick="AppUX.selectSettingsSheetOption('${escapeAttr(option.value)}')">
              <span><i data-lucide="${escapeAttr(option.icon || "circle")}"></i><b>${escapeHTML(option.label)}</b><small>${escapeHTML(option.description || "")}</small></span>
              ${String(option.value) === String(selectedValue) ? '<i data-lucide="check"></i>' : ""}
            </button>`).join("")}
        </div>
      </section>`;
    sheet.addEventListener("click", closeSettingsBottomSheet);
    document.body.appendChild(sheet);
    requestAnimationFrame(() => sheet.classList.add("active"));
    if (window.lucide) window.lucide.createIcons();
  }

  function closeSettingsBottomSheet() {
    const sheet = document.getElementById("settingsBottomSheet");
    settingsSheetSelect = null;
    if (!sheet) return;
    sheet.classList.remove("active");
    setTimeout(() => sheet.remove(), 180);
  }

  function selectSettingsSheetOption(value) {
    const callback = settingsSheetSelect;
    closeSettingsBottomSheet();
    if (callback) callback(value);
  }

  async function persistSettingsPatch(patch, message = "Settings updated") {
    await persistSettingsPreferences(patch);
    try {
      await apiRequest("/api/users/settings", {
        method: "PUT",
        body: JSON.stringify(patch)
      });
    } catch (error) {
      console.warn("ConnectHub settings sync failed:", error.message);
    }
    showToast(message);
  }

  async function saveSettingsToggle(key, value) {
    await persistSettingsPatch({ [key]: Boolean(value) }, `${key.replace(/([A-Z])/g, " $1")} ${value ? "enabled" : "disabled"}`);
  }

  async function saveNotificationPref(key, value) {
    updateCurrentProfile({ [key]: Boolean(value) });
    try {
      await apiRequest("/api/notifications", {
        method: "PUT",
        body: JSON.stringify({ [key]: Boolean(value) })
      });
    } catch (error) {
      console.warn("ConnectHub notification sync failed:", error.message);
    }
    const body = document.getElementById("body");
    if (body && currentView === "settings") renderSettingsPage(body);
    showToast(`${key.replace(/([A-Z])/g, " $1")} ${value ? "enabled" : "disabled"}`);
  }

  function openProfileVisibilitySelector() {
    const user = getCurrentUser() || {};
    const current = user.profileVisibility || (user.accountPrivacy === "private" ? "private" : "public");
    openSettingsBottomSheet("Profile visibility", [
      { value: "public", label: "Public", description: "Everyone can open your public profile.", icon: "globe" },
      { value: "connections", label: "Connections only", description: "Only your network can see full details.", icon: "users" },
      { value: "private", label: "Private", description: "Hide your profile from public discovery.", icon: "lock" }
    ], current, value => persistSettingsPatch({
      profileVisibility: value,
      accountPrivacy: value === "private" ? "private" : "public"
    }, "Profile visibility updated"));
  }

  function openMessagingPrivacySelector() {
    const user = getCurrentUser() || {};
    const current = user.whoCanMessage || (user.messagingPrivacy === "network" ? "connections" : user.messagingPrivacy === "none" ? "nobody" : "everyone");
    openSettingsBottomSheet("Who can message me", [
      { value: "everyone", label: "Everyone", description: "Any ConnectHub user can message you.", icon: "message-circle" },
      { value: "connections", label: "Connections only", description: "Only accepted connections can message you.", icon: "users" },
      { value: "nobody", label: "No one", description: "Pause new inbound messages.", icon: "ban" }
    ], current, value => persistSettingsPatch({
      whoCanMessage: value,
      messagingPrivacy: value === "connections" ? "network" : value === "nobody" ? "none" : "everyone"
    }, "Messaging privacy updated"));
  }

  function openLanguageSelector() {
    const current = getCurrentUser()?.preferredLanguage || localStorage.getItem("connecthub_language") || "en";
    openSettingsBottomSheet("Language", LANGUAGE_OPTIONS.map(option => ({
      value: option.value,
      label: option.label,
      description: option.value === "en" ? "Default app language." : "Stores your preference for translated app labels.",
      icon: "languages"
    })), current, value => {
      const option = LANGUAGE_OPTIONS.find(item => item.value === value) || LANGUAGE_OPTIONS[0];
      persistSettingsPatch({ preferredLanguage: option.value, language: option.value }, `Language set to ${option.label}`);
    });
  }

  function openFontSizeSelector() {
    const current = getCurrentUser()?.fontSizePreference || localStorage.getItem("connecthub_font_size") || "medium";
    openSettingsBottomSheet("Font size", FONT_SIZE_OPTIONS.map(option => ({
      value: option.value,
      label: option.label,
      description: option.value === "medium" ? "Recommended for most users." : "Adjust text scale across the app.",
      icon: "type"
    })), current, value => {
      const option = FONT_SIZE_OPTIONS.find(item => item.value === value) || FONT_SIZE_OPTIONS[1];
      persistSettingsPatch({ fontSizePreference: option.value, fontSize: option.value }, `Font size set to ${option.label}`);
    });
  }

  function openSettingsEditProfile() {
    const user = getCurrentUser() || {};
    const skills = Array.isArray(user.skills) ? user.skills.join(", ") : (user.skills || "");
    openSettingsModal("Edit profile", `
      <form class="settings-form-grid" onsubmit="AppUX.saveSettingsProfile(event)">
        <div class="settings-avatar-editor">
          <div id="settingsAvatarPreview">${avatarMarkup(user, "user-avatar")}</div>
          <label class="btn btn-secondary" for="settingsAvatarInput"><i data-lucide="camera"></i>Change photo</label>
          <input id="settingsAvatarInput" type="file" accept="image/jpeg,image/png,image/webp" onchange="AppUX.previewSettingsAvatar(this)" hidden>
        </div>
        <label class="settings-form-field"><span>Full Name</span><input id="settingsName" class="form-control" required minlength="2" value="${escapeAttr(user.name || "")}" autofocus></label>
        <label class="settings-form-field"><span>Professional title</span><input id="settingsTitle" class="form-control" value="${escapeAttr(user.title || "")}" placeholder="Designer, Founder, Investor"></label>
        <label class="settings-form-field full"><span>Bio / Short pitch</span><textarea id="settingsBio" class="form-control" maxlength="220" rows="4" placeholder="Tell people what you do">${escapeHTML(user.bio || "")}</textarea></label>
        <label class="settings-form-field"><span>City</span><input id="settingsCity" class="form-control" value="${escapeAttr(user.city || "")}" placeholder="Hyderabad"></label>
        <label class="settings-form-field"><span>State</span><input id="settingsState" class="form-control" value="${escapeAttr(user.state || "")}" placeholder="Telangana"></label>
        <label class="settings-form-field full"><span>Skills</span><input id="settingsSkills" class="form-control" value="${escapeAttr(skills)}" placeholder="Figma, React, Photography"></label>
        <div class="settings-modal-actions full">
          <button class="btn btn-secondary" type="button" onclick="AppUX.useSettingsLocation()"><i data-lucide="map-pin"></i>Use location</button>
          <button class="btn btn-primary" type="submit"><i data-lucide="save"></i>Save profile</button>
        </div>
      </form>`);
  }

  function previewSettingsAvatar(input) {
    const file = input?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const preview = document.getElementById("settingsAvatarPreview");
      if (preview) preview.innerHTML = `<img class="user-avatar" src="${reader.result}" alt="Profile preview">`;
    };
    reader.readAsDataURL(file);
  }

  async function saveSettingsProfile(event) {
    event.preventDefault();
    const input = document.getElementById("settingsAvatarInput");
    const patch = {
      name: document.getElementById("settingsName")?.value.trim(),
      title: document.getElementById("settingsTitle")?.value.trim(),
      bio: document.getElementById("settingsBio")?.value.trim().slice(0, 220),
      city: document.getElementById("settingsCity")?.value.trim(),
      state: document.getElementById("settingsState")?.value.trim(),
      skills: document.getElementById("settingsSkills")?.value.split(",").map(item => item.trim()).filter(Boolean)
    };
    try {
      const avatarPhoto = await fileToAvatar(input);
      if (avatarPhoto) patch.avatarPhoto = avatarPhoto;
      const data = await apiRequest("/api/users/profile", {
        method: "PUT",
        body: JSON.stringify(patch)
      });
      updateCurrentProfile(data.user || patch);
      closeSettingsModal();
      applyUserChrome();
      showToast("Profile updated successfully");
      const body = document.getElementById("body");
      if (body && currentView === "settings") renderSettingsPage(body);
    } catch (error) {
      updateCurrentProfile(patch);
      closeSettingsModal();
      showToast(error.message || "Profile saved locally", error.message ? "error" : "success");
    }
  }

  async function useSettingsLocation() {
    try {
      const location = await requestBrowserLocation();
      const city = document.getElementById("settingsCity");
      const state = document.getElementById("settingsState");
      if (city && location.city) city.value = location.city;
      if (state && location.state) state.value = location.state;
      showToast("Location added");
    } catch (error) {
      showToast(error.message || "Could not detect location", "error");
    }
  }

  function openManageContact() {
    const user = getCurrentUser() || {};
    openSettingsModal("Email & phone", `
      <form class="settings-form-grid" onsubmit="AppUX.saveSettingsContact(event)">
        <label class="settings-form-field full"><span>Sign-in email</span><input class="form-control" value="${escapeAttr(user.email || "")}" disabled><small>This email is used for login.</small></label>
        <label class="settings-form-field full"><span>Public contact email</span><input id="settingsContactEmail" class="form-control" type="email" value="${escapeAttr(user.contactEmail || user.email || "")}" placeholder="you@example.com"></label>
        <label class="settings-form-field"><span>Phone number</span><input id="settingsPhone" class="form-control" inputmode="tel" value="${escapeAttr(user.phone || "")}" placeholder="+91..."></label>
        <label class="settings-form-field"><span>WhatsApp number</span><input id="settingsWhatsapp" class="form-control" inputmode="tel" value="${escapeAttr(user.whatsapp || "")}" placeholder="+91..."></label>
        <div class="settings-modal-actions full">
          <a class="btn btn-secondary" href="tel:6301394850"><i data-lucide="phone"></i>Call support</a>
          <button class="btn btn-primary" type="submit"><i data-lucide="save"></i>Save contact</button>
        </div>
      </form>`);
  }

  async function saveSettingsContact(event) {
    event.preventDefault();
    const patch = {
      contactEmail: document.getElementById("settingsContactEmail")?.value.trim(),
      phone: document.getElementById("settingsPhone")?.value.trim(),
      whatsapp: document.getElementById("settingsWhatsapp")?.value.trim()
    };
    try {
      const data = await apiRequest("/api/users/profile", {
        method: "PUT",
        body: JSON.stringify(patch)
      });
      updateCurrentProfile(data.user || patch);
      closeSettingsModal();
      showToast("Contact details updated");
      const body = document.getElementById("body");
      if (body && currentView === "settings") renderSettingsPage(body);
    } catch (error) {
      updateCurrentProfile(patch);
      closeSettingsModal();
      showToast("Contact saved locally");
    }
  }

  function openLinkedAccounts() {
    const user = getCurrentUser() || {};
    openSettingsModal("Linked accounts", `
      <form class="settings-form-grid" onsubmit="AppUX.saveLinkedAccounts(event)">
        <label class="settings-form-field full"><span>LinkedIn profile</span><input id="settingsLinkedIn" class="form-control" type="url" value="${escapeAttr(user.linkedinUrl || "")}" placeholder="https://linkedin.com/in/..."></label>
        <label class="settings-form-field full"><span>Portfolio / website</span><input id="settingsPortfolio" class="form-control" type="url" value="${escapeAttr(user.portfolio || user.website || "")}" placeholder="https://yourportfolio.com"></label>
        <label class="settings-form-field full"><span>GitHub / work profile</span><input id="settingsGithub" class="form-control" type="url" value="${escapeAttr(user.githubUrl || "")}" placeholder="https://github.com/..."></label>
        <div class="settings-connect-list full">
          <button class="settings-connect-row" type="button" onclick="AppUX.mockConnectAccount('Google')"><i data-lucide="circle-dot"></i><span><b>Google</b><small>Use Google only after OAuth is configured.</small></span></button>
          <button class="settings-connect-row" type="button" onclick="AppUX.mockConnectAccount('LinkedIn')"><i data-lucide="briefcase"></i><span><b>LinkedIn</b><small>Paste profile link for now.</small></span></button>
        </div>
        <div class="settings-modal-actions full"><button class="btn btn-primary" type="submit"><i data-lucide="save"></i>Save links</button></div>
      </form>`);
  }

  async function saveLinkedAccounts(event) {
    event.preventDefault();
    const patch = {
      linkedinUrl: document.getElementById("settingsLinkedIn")?.value.trim(),
      portfolio: document.getElementById("settingsPortfolio")?.value.trim(),
      website: document.getElementById("settingsPortfolio")?.value.trim(),
      githubUrl: document.getElementById("settingsGithub")?.value.trim()
    };
    try {
      const data = await apiRequest("/api/users/profile", { method: "PUT", body: JSON.stringify(patch) });
      updateCurrentProfile(data.user || patch);
    } catch {
      updateCurrentProfile(patch);
    }
    closeSettingsModal();
    showToast("Linked accounts updated");
  }

  function mockConnectAccount(name) {
    showToast(`${name} linking needs OAuth setup. Profile link fields work now.`);
  }

  function openChangePassword() {
    const user = getCurrentUser() || {};
    openSettingsModal("Change password", `
      <form class="settings-form-grid" onsubmit="AppUX.submitSettingsNewPassword(event)">
        <div class="settings-info-card full"><i data-lucide="shield-check"></i><span><b>Secure OTP check</b><small>We send an OTP to ${escapeHTML(user.email || "your login email")} before changing your passcode.</small></span></div>
        <button class="btn btn-secondary full" type="button" onclick="AppUX.sendSettingsPasswordOtp()"><i data-lucide="mail"></i>Send OTP</button>
        <div id="settingsOtpHint" class="settings-demo-otp full" aria-live="polite"></div>
        <label class="settings-form-field"><span>Email OTP</span><input id="settingsPasswordOtp" class="form-control" inputmode="numeric" maxlength="6" placeholder="6 digit OTP" required></label>
        <label class="settings-form-field"><span>New password</span><input id="settingsNewPassword" class="form-control" type="password" minlength="8" placeholder="At least 8 characters" required oninput="AppUX.updatePasswordStrength(this.value)"></label>
        <div class="settings-password-meter full"><i id="settingsPasswordStrength"></i></div>
        <button class="btn btn-primary full" type="submit"><i data-lucide="key-round"></i>Update password</button>
      </form>`);
  }

  async function sendSettingsPasswordOtp() {
    try {
      const data = await apiRequest("/api/auth/send-otp", { method: "POST", body: JSON.stringify({}) });
      const hint = document.getElementById("settingsOtpHint");
      if (hint) {
        hint.textContent = data.demoOtp ? `Demo OTP for this free deployment: ${data.demoOtp}` : "OTP sent to your email.";
        hint.classList.add("active");
      }
      showToast(data.demoOtp ? "Demo OTP generated" : "OTP sent to email");
    } catch (error) {
      showToast(error.message || "Could not send OTP", "error");
    }
  }

  function updatePasswordStrength(value) {
    const meter = document.getElementById("settingsPasswordStrength");
    if (!meter) return;
    const text = String(value || "");
    const score = Math.min(100, (text.length >= 8 ? 35 : text.length * 4) + (/[A-Z]/.test(text) ? 20 : 0) + (/[0-9]/.test(text) ? 20 : 0) + (/[^A-Za-z0-9]/.test(text) ? 25 : 0));
    meter.style.width = `${score}%`;
    meter.dataset.level = score > 74 ? "strong" : score > 44 ? "medium" : "weak";
  }

  async function submitSettingsNewPassword(event) {
    event.preventDefault();
    const otp = document.getElementById("settingsPasswordOtp")?.value.trim();
    const newPassword = document.getElementById("settingsNewPassword")?.value;
    try {
      await apiRequest("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ otp, newPassword })
      });
      closeSettingsModal();
      showToast("Password changed successfully");
    } catch (error) {
      showToast(error.message || "Password update failed", "error");
    }
  }

  async function openActiveSessions() {
    openSettingsModal("Active sessions", `
      <div class="settings-session-shell">
        <div class="settings-smart-loading"><span></span>Loading sessions...</div>
        <div class="settings-session-skeleton"></div>
        <div class="settings-session-skeleton short"></div>
      </div>`, { wide: true });
    let data = { sessions: [], loginHistory: [], securityScore: 92 };
    try {
      data = await apiRequest("/api/sessions");
    } catch {
      data.sessions = [{ sessionId: "current", device: navigator.userAgent.includes("Mobile") ? "Mobile browser" : "Desktop browser", city: "Current device", lastActive: new Date().toISOString(), isCurrent: true }];
      data.loginHistory = data.sessions;
    }
    renderSettingsSessions(data);
  }

  function settingsTimeAgo(value) {
    const time = new Date(value || Date.now()).getTime();
    const diff = Math.max(0, Date.now() - time);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
    return new Date(value || Date.now()).toLocaleDateString("en-IN");
  }

  function settingsMaskIP(ip) {
    const value = String(ip || "");
    if (!value || value === "Unknown") return "Unknown";
    if (value.includes(":")) return value.split(":").slice(0, 2).join(":") + ":****";
    const parts = value.split(".");
    if (parts.length !== 4) return value;
    return `${parts[0]}.${parts[1]}.*.${parts[3]}`;
  }

  function settingsDeviceIcon(session = {}) {
    const label = `${session.deviceType || ""} ${session.device || ""}`.toLowerCase();
    if (label.includes("mobile") || label.includes("phone")) return "smartphone";
    if (label.includes("tablet") || label.includes("ipad")) return "tablet";
    return "monitor-smartphone";
  }

  function renderSettingsSecurityBanner(score = 92, sessions = []) {
    const otherCount = sessions.filter(session => !session.isCurrent).length;
    const status = score >= 85 ? "strong" : score >= 65 ? "attention" : "risk";
    const title = status === "strong" ? "Your account looks secure" : status === "attention" ? "Review your active devices" : "Security attention needed";
    const detail = otherCount ? `${otherCount} other device${otherCount > 1 ? "s" : ""} can access this account.` : "Only this device is currently active.";
    return `
      <div class="settings-security-banner ${status}">
        <i data-lucide="${status === "risk" ? "shield-alert" : "shield-check"}"></i>
        <span><b>${title}</b><small>${detail}</small></span>
        <strong>${Math.round(score)}%</strong>
      </div>`;
  }

  function renderSettingsSessionDetails(session = {}) {
    return `
      <div id="session-details-${escapeAttr(session.sessionId)}" class="settings-session-details" hidden>
        <dl>
          <div><dt>IP address</dt><dd>${escapeHTML(settingsMaskIP(session.ipAddress || session.ip))}</dd></div>
          <div><dt>Browser</dt><dd>${escapeHTML(session.browser || "Browser")}</dd></div>
          <div><dt>Operating system</dt><dd>${escapeHTML(session.os || "Unknown OS")}</dd></div>
          <div><dt>Signed in</dt><dd>${escapeHTML(new Date(session.createdAt || Date.now()).toLocaleString("en-IN"))}</dd></div>
        </dl>
        <p>${escapeHTML(String(session.userAgent || "No browser fingerprint available.").slice(0, 180))}</p>
      </div>`;
  }

  function renderSettingsSessionCard(session = {}) {
    const id = session.sessionId || session._id || "current";
    const isCurrent = Boolean(session.isCurrent || id === "current");
    return `
      <article class="settings-session-card enhanced" id="settings-session-${escapeAttr(id)}">
        <i data-lucide="${settingsDeviceIcon(session)}"></i>
        <span>
          <b>${escapeHTML(session.device || "Browser session")}</b>
          <small>${escapeHTML(session.city || session.location || "Unknown location")} - ${escapeHTML(isCurrent ? "Active now" : settingsTimeAgo(session.lastActive))}</small>
        </span>
        <div class="settings-session-actions">
          ${isCurrent ? `<em>This device</em>` : `<button class="btn btn-secondary danger-soft" type="button" onclick="AppUX.revokeSettingsSession('${escapeAttr(id)}')">Sign out</button>`}
          <button class="settings-mini-action" type="button" onclick="AppUX.toggleSettingsSessionDetails('${escapeAttr(id)}')">Details</button>
        </div>
        ${renderSettingsSessionDetails({ ...session, sessionId: id })}
      </article>`;
  }

  function renderSettingsLoginHistory(history = []) {
    if (!history.length) return "";
    return `
      <div class="settings-login-history" id="settingsLoginHistory" hidden>
        <h4>Login history</h4>
        ${history.map(session => `
          <div class="settings-history-row">
            <i data-lucide="${settingsDeviceIcon(session)}"></i>
            <span><b>${escapeHTML(session.device || "Browser session")}</b><small>${escapeHTML(session.city || session.location || "Unknown")} - ${escapeHTML(settingsTimeAgo(session.createdAt || session.lastActive))}</small></span>
          </div>`).join("")}
      </div>`;
  }

  function renderSettingsSecurityTips() {
    return `
      <div class="settings-security-tips">
        <b>Security tips</b>
        <span><i data-lucide="check-circle"></i>Sign out devices you do not recognize.</span>
        <span><i data-lucide="check-circle"></i>Use a passcode that is not used on other apps.</span>
        <span><i data-lucide="check-circle"></i>Keep your email and WhatsApp number updated for recovery.</span>
      </div>`;
  }

  function renderSettingsSessions(data = {}) {
    const sessions = data.sessions || [];
    const modalBody = document.querySelector("#settingsModal .settings-modal-body");
    if (!modalBody) return;
    const current = sessions.find(session => session.isCurrent) || sessions[0];
    const others = sessions.filter(session => session !== current && !session.isCurrent);
    modalBody.innerHTML = `
      ${renderSettingsSecurityBanner(data.securityScore || 92, sessions)}
      <section class="settings-session-section">
        <div class="settings-session-heading"><b>This device</b><small>Used for the current login</small></div>
        ${current ? renderSettingsSessionCard({ ...current, isCurrent: true }) : ""}
      </section>
      <section class="settings-session-section">
        <div class="settings-session-heading">
          <b>Other devices</b>
          <small>${others.length ? `${others.length} active` : "No other active sessions"}</small>
        </div>
        ${others.length ? others.map(renderSettingsSessionCard).join("") : `<div class="settings-empty-state compact"><b>No other devices</b><span>Your account is only active on this browser.</span></div>`}
      </section>
      <div class="settings-modal-actions spread">
        <button class="btn btn-secondary" type="button" onclick="AppUX.toggleSettingsSessionHistory()"><i data-lucide="history"></i>Login history</button>
        <button class="btn btn-secondary danger-soft" type="button" onclick="AppUX.revokeOtherSettingsSessions()" ${others.length ? "" : "disabled"}><i data-lucide="log-out"></i>Sign out others</button>
      </div>
      ${renderSettingsLoginHistory(data.loginHistory || sessions)}
      ${renderSettingsSecurityTips()}`;
    if (window.lucide) window.lucide.createIcons();
  }

  function toggleSettingsSessionDetails(id) {
    const details = document.getElementById(`session-details-${id}`);
    if (!details) return;
    details.hidden = !details.hidden;
  }

  function toggleSettingsSessionHistory() {
    const history = document.getElementById("settingsLoginHistory");
    if (!history) return;
    history.hidden = !history.hidden;
  }

  async function revokeSettingsSession(id) {
    if (!id || id === "current") return;
    if (!window.confirm("Sign out this device?")) return;
    try {
      await apiRequest(`/api/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
      showToast("Session removed");
      openActiveSessions();
    } catch (error) {
      showToast(error.message || "Could not remove session", "error");
    }
  }

  async function revokeOtherSettingsSessions() {
    if (!window.confirm("Sign out all other devices?")) return;
    try {
      await apiRequest("/api/sessions/all/others", { method: "DELETE" });
      showToast("Other sessions removed");
      openActiveSessions();
    } catch (error) {
      showToast(error.message || "Could not update sessions", "error");
    }
  }

  function openBlockMutedUsers() {
    const user = getCurrentUser() || {};
    const blocked = Array.isArray(user.blockedUsers) ? user.blockedUsers : [];
    const muted = Array.isArray(user.mutedUsers) ? user.mutedUsers : [];
    openSettingsModal("Blocked & muted users", `
      <div class="settings-form-grid">
        <label class="settings-form-field full"><span>Block a user</span><input id="settingsBlockedInput" class="form-control" placeholder="Name or @username"></label>
        <button class="btn btn-secondary full" type="button" onclick="AppUX.addSettingsListUser('blockedUsers', 'settingsBlockedInput')"><i data-lucide="ban"></i>Add to blocked</button>
        <label class="settings-form-field full"><span>Mute a user</span><input id="settingsMutedInput" class="form-control" placeholder="Name or @username"></label>
        <button class="btn btn-secondary full" type="button" onclick="AppUX.addSettingsListUser('mutedUsers', 'settingsMutedInput')"><i data-lucide="volume-x"></i>Add to muted</button>
        <div class="settings-list-chips full">
          <b>Blocked</b>
          ${blocked.length ? blocked.map(name => `<button type="button" onclick="AppUX.removeSettingsListUser('blockedUsers','${escapeAttr(name)}')">${escapeHTML(name)} <i data-lucide="x"></i></button>`).join("") : "<small>No blocked users.</small>"}
          <b>Muted</b>
          ${muted.length ? muted.map(name => `<button type="button" onclick="AppUX.removeSettingsListUser('mutedUsers','${escapeAttr(name)}')">${escapeHTML(name)} <i data-lucide="x"></i></button>`).join("") : "<small>No muted users.</small>"}
        </div>
      </div>`);
  }

  async function addSettingsListUser(key, inputId) {
    const input = document.getElementById(inputId);
    const value = input?.value.trim().replace(/^@/, "");
    if (!value) return showToast("Enter a user name", "error");
    const current = getCurrentUser() || {};
    const next = Array.from(new Set([...(current[key] || []), value])).slice(0, 50);
    await persistSettingsPatch({ [key]: next }, key === "blockedUsers" ? "User blocked" : "User muted");
    openBlockMutedUsers();
  }

  async function removeSettingsListUser(key, value) {
    const current = getCurrentUser() || {};
    const next = (current[key] || []).filter(item => item !== value);
    await persistSettingsPatch({ [key]: next }, "List updated");
    openBlockMutedUsers();
  }

  function openCurrentPlan() {
    openSettingsModal("Current plan", `
      <div class="settings-plan-card">
        <i data-lucide="badge-indian-rupee"></i>
        <h4>Free Plan</h4>
        <p>ConnectHub is running with zero-budget hosting right now. You can use profiles, posts, messages, saved items, AI Hub previews, and settings.</p>
      </div>`);
  }

  function openUpgradePro() {
    openSettingsModal("Upgrade preview", `
      <div class="settings-plan-grid">
        <article><b>Pro Freelancer</b><span>Portfolio boost, profile analytics, priority discovery.</span></article>
        <article><b>Startup Pro</b><span>Hiring board, applicant tracking, campaign analytics.</span></article>
        <article><b>Investor Pro</b><span>Deal radar, watchlists, richer startup signals.</span></article>
      </div>
      <p class="settings-help-text">Payments will stay disabled until Razorpay keys are configured safely on Render.</p>`);
  }

  function openBillingHistory() {
    openSettingsModal("Billing history", `<div class="settings-empty-state"><i data-lucide="receipt"></i><b>No invoices yet</b><span>Your current ConnectHub plan is free.</span></div>`);
  }

  function downloadUserData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      user: getCurrentUser(),
      savedPosts: getDB().savedPostsByUser || {},
      notifications: (getDB().notifications || []).filter(note => note.to === getCurrentUser()?.name)
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "connecthub-data-export.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Data export downloaded");
  }

  function openActivityLog() {
    const db = getDB();
    const userName = getCurrentUser()?.name;
    const actions = [
      `${(db.profilePosts || []).filter(post => post.author === userName || post.name === userName).length} profile posts`,
      `${(db.messages || []).filter(message => message.from === userName || message.to === userName).length} messages`,
      `${(db.notifications || []).filter(note => note.to === userName).length} notifications`,
      `${(db.savedProfiles || []).filter(item => item.user === userName || item.from === userName).length} saved profiles`
    ];
    openSettingsModal("Activity log", `<ul class="settings-activity-list">${actions.map(item => `<li><i data-lucide="activity"></i>${escapeHTML(item)}</li>`).join("")}</ul>`);
  }

  function openArchive() {
    openSettingsModal("Archive", `<div class="settings-empty-state"><i data-lucide="archive"></i><b>Archive is empty</b><span>Hidden posts and muted opportunities will appear here.</span></div>`);
  }

  function openHelpCenter() {
    openSettingsModal("Help Center", `
      <div class="settings-help-grid">
        <a class="settings-help-card" href="tel:6301394850"><i data-lucide="phone"></i><b>Call support</b><span>6301394850</span></a>
        <a class="settings-help-card" href="mailto:support@connecthub.in"><i data-lucide="mail"></i><b>Email support</b><span>support@connecthub.in</span></a>
        <button class="settings-help-card" type="button" onclick="AppUX.openReportProblem()"><i data-lucide="flag"></i><b>Report issue</b><span>Send feedback to admin</span></button>
      </div>`);
  }

  function openReportProblem() {
    openSettingsModal("Report a problem", `
      <form class="settings-form-grid" onsubmit="AppUX.submitSettingsReport(event)">
        <label class="settings-form-field full"><span>Issue type</span><select id="settingsReportType" class="form-control"><option>Login problem</option><option>Messages issue</option><option>Profile issue</option><option>Payment issue</option><option>Other</option></select></label>
        <label class="settings-form-field full"><span>What happened?</span><textarea id="settingsReportDescription" class="form-control" rows="5" maxlength="1200" placeholder="Explain the issue clearly" required></textarea></label>
        <button class="btn btn-primary full" type="submit"><i data-lucide="send"></i>Submit report</button>
      </form>`);
  }

  async function submitSettingsReport(event) {
    event.preventDefault();
    const payload = {
      type: document.getElementById("settingsReportType")?.value,
      description: document.getElementById("settingsReportDescription")?.value.trim()
    };
    try {
      await apiRequest("/api/support/report", { method: "POST", body: JSON.stringify(payload) });
      closeSettingsModal();
      showToast("Report submitted");
    } catch (error) {
      showToast(error.message || "Could not submit report", "error");
    }
  }

  function openRateApp() {
    openSettingsModal("Rate ConnectHub", `
      <div class="settings-rating-row">
        ${[1, 2, 3, 4, 5].map(score => `<button type="button" onclick="AppUX.submitSettingsRating(${score})"><i data-lucide="star"></i><span>${score}</span></button>`).join("")}
      </div>
      <p class="settings-help-text">Your rating is saved locally and helps improve the app experience.</p>`);
  }

  function submitSettingsRating(score) {
    updateCurrentProfile({ appRating: score });
    closeSettingsModal();
    showToast(`Thanks for rating ${score}/5`);
  }

  function openTerms() {
    openSettingsModal("Terms of Service", `
      <div class="settings-legal-copy">
        <p>ConnectHub India is a professional networking platform for startups, freelancers, and investors.</p>
        <p>Use respectful communication, avoid spam, protect private data, and verify deals before payments.</p>
        <p>Free-tier services can have limits, so some features may run in demo mode until production services are configured.</p>
      </div>`);
  }

  function openAbout() {
    openSettingsModal("About ConnectHub", `
      <div class="settings-plan-card">
        <i data-lucide="sparkles"></i>
        <h4>ConnectHub India</h4>
        <p>Version 1.0. Built for Indian startups, freelancers, and investors with marketplace, messaging, profiles, AI Hub, and PWA support.</p>
        <small>Support: 6301394850</small>
      </div>`);
  }

  function openDeactivateAccount() {
    openSettingsModal("Deactivate account", `
      <div class="settings-danger-panel">
        <i data-lucide="pause-circle"></i>
        <b>Temporarily hide your profile</b>
        <p>You can sign in later and turn your account back on. Your data stays saved.</p>
      </div>
      <button class="btn btn-secondary danger-soft full" type="button" onclick="AppUX.confirmDeactivateAccount()">Deactivate for now</button>`);
  }

  async function confirmDeactivateAccount() {
    await persistSettingsPatch({ deactivated: true }, "Account deactivated");
    closeSettingsModal();
  }

  function openDeleteAccount() {
    openSettingsModal("Delete account", `
      <div class="settings-danger-panel danger">
        <i data-lucide="trash-2"></i>
        <b>This permanently deletes registered account data</b>
        <p>Type DELETE to confirm. Demo users will be signed out and marked locally.</p>
      </div>
      <label class="settings-form-field full"><span>Confirmation</span><input id="settingsDeleteConfirm" class="form-control" placeholder="DELETE"></label>
      <button class="btn btn-primary full danger" type="button" onclick="AppUX.confirmDeleteAccount()"><i data-lucide="trash-2"></i>Delete account</button>`);
  }

  async function confirmDeleteAccount() {
    const value = document.getElementById("settingsDeleteConfirm")?.value.trim();
    if (value !== "DELETE") return showToast("Type DELETE to confirm", "error");
    try {
      await apiRequest("/api/users/account", { method: "DELETE" });
    } catch (error) {
      console.warn("ConnectHub account delete API failed:", error.message);
    }
    localStorage.removeItem("connecthub_current_user");
    localStorage.removeItem("connecthub_token");
    closeSettingsModal();
    showToast("Account deleted");
    setTimeout(() => { window.location.href = "index.html"; }, 650);
  }

  function cycleLanguagePreference() {
    const current = getCurrentUser()?.preferredLanguage || localStorage.getItem("connecthub_language") || "en";
    const index = LANGUAGE_OPTIONS.findIndex(item => item.value === current);
    const next = LANGUAGE_OPTIONS[(index + 1 + LANGUAGE_OPTIONS.length) % LANGUAGE_OPTIONS.length];
    persistSettingsPreferences({ preferredLanguage: next.value });
    showToast(`Language set to ${next.label}`);
  }

  function cycleFontSizePreference() {
    const current = getCurrentUser()?.fontSizePreference || localStorage.getItem("connecthub_font_size") || "medium";
    const index = FONT_SIZE_OPTIONS.findIndex(item => item.value === current);
    const next = FONT_SIZE_OPTIONS[(index + 1 + FONT_SIZE_OPTIONS.length) % FONT_SIZE_OPTIONS.length];
    persistSettingsPreferences({ fontSizePreference: next.value });
    showToast(`Font size set to ${next.label}`);
  }

  function toggleAccountPrivacy() {
    const current = getCurrentUser()?.accountPrivacy || "public";
    const next = current === "private" ? "public" : "private";
    persistSettingsPreferences({ accountPrivacy: next });
    showToast(`Profile is now ${next}`);
  }

  function cycleMessagingPrivacy() {
    const options = ["everyone", "network", "none"];
    const current = getCurrentUser()?.messagingPrivacy || "everyone";
    const next = options[(options.indexOf(current) + 1 + options.length) % options.length];
    persistSettingsPreferences({ messagingPrivacy: next });
    showToast(next === "network" ? "Messages limited to network" : next === "none" ? "Messages disabled" : "Everyone can message you");
  }

  async function openSecurityHub() {
    const panel = document.getElementById("settingsSmartResults");
    if (!panel) return;
    panel.classList.add("active");
    panel.innerHTML = `<div class="settings-smart-loading"><span></span>Loading security settings...</div>`;
    let data = null;
    try {
      data = await apiRequest("/api/v1/settings/security");
      data = data.security || data;
    } catch {
      const user = getCurrentUser() || {};
      data = {
        accountPrivacy: user.accountPrivacy || "public",
        messagingPrivacy: user.messagingPrivacy || "everyone",
        activeSessions: user.activeSessions || [{ sessionId: "current", device: navigator.userAgent.includes("Mobile") ? "Mobile browser" : "Desktop browser", lastSeenAt: new Date().toISOString(), current: true }],
        blockedUsers: user.blockedUsers || [],
        mutedUsers: user.mutedUsers || []
      };
    }
    const sessions = data.activeSessions?.length
      ? data.activeSessions.map(session => `<li><b>${escapeHTML(session.device || session.deviceType || "Browser session")}</b><span>${escapeHTML(session.ipAddress || "Current network")} - ${escapeHTML(new Date(session.lastSeenAt || session.lastActive || Date.now()).toLocaleString("en-IN"))}</span></li>`).join("")
      : "<li><b>This device</b><span>Only current session is active</span></li>";
    panel.innerHTML = `<div class="settings-security-preview">
      <strong>Privacy & Security</strong>
      <p>Profile: ${escapeHTML(data.accountPrivacy || "public")} - Messages: ${escapeHTML(data.messagingPrivacy || "everyone")}</p>
      <ul>${sessions}</ul>
      <div class="settings-actions">
        <button class="btn btn-secondary" type="button" onclick="AppUX.toggleAccountPrivacy()">Toggle privacy</button>
        <button class="btn btn-secondary danger-soft" type="button" onclick="AppUX.showToast('Session controls are ready for backend logout')">Manage sessions</button>
      </div>
    </div>`;
  }

  async function sendSettingsOtp() {
    const email = document.getElementById("settingsEmail")?.value;
    if (!email) return showToast("Enter your email first", "error");
    try {
      await requestPasswordOtp(email);
      showToast("OTP sent to your email");
    } catch (error) {
      showToast(error.message || "Could not send OTP", "error");
    }
  }

  async function updateSettingsPasscode() {
    const email = document.getElementById("settingsEmail")?.value;
    const otp = document.getElementById("settingsOtp")?.value;
    const passcode = document.getElementById("settingsPasscode")?.value;
    if (!email || !otp || !passcode) return showToast("Email, OTP and new passcode are required", "error");
    try {
      await resetPasswordWithOtp(email, otp, passcode);
      showToast("Passcode updated successfully");
      document.getElementById("settingsOtp").value = "";
      document.getElementById("settingsPasscode").value = "";
    } catch (error) {
      showToast(error.message || "Passcode update failed", "error");
    }
  }

  function openSettingsNotifications() {
    renderNotificationPanel();
    const panel = document.getElementById("notificationPanel");
    if (panel) {
      document.body.appendChild(panel);
      panel.classList.add("active");
    }
  }

  async function saveEditProfile(event) {
    event.preventDefault();
    const user = getCurrentUser();
    const db = getDB();
    let avatarPhoto = null;
    try {
      avatarPhoto = await fileToAvatar(document.getElementById("editPhoto"));
    } catch (error) {
      showToast(error.message, "error");
      return;
    }

    const patch = {
      name: document.getElementById("editName").value.trim(),
      title: document.getElementById("editTitle")?.value.trim() || user.title,
      bio: document.getElementById("editBio").value.trim().slice(0, 200),
      city: document.getElementById("editCity").value.trim(),
      state: document.getElementById("editState").value.trim(),
      whatsapp: document.getElementById("editWhatsapp").value.trim(),
      firmName: document.getElementById("editFirm")?.value.trim() || user.firmName || ""
    };
    if (avatarPhoto) patch.avatarPhoto = avatarPhoto;

    if (user.role === "startup_admin" && user.startupId) {
      const startup = db.startups.find(s => s.id === user.startupId);
      if (startup) {
        startup.name = document.getElementById("editBusinessName")?.value.trim() || startup.name;
        startup.sector = document.getElementById("editSector")?.value || startup.sector;
        startup.target = document.getElementById("editFundingGoal")?.value.trim() || startup.target;
        startup.city = patch.city;
        startup.state = patch.state;
        patch.companyName = startup.name;
      }
      saveDB(db);
    }

    const updated = updateCurrentProfile(patch);
    applyUserChrome();
    if (onProfileSaved) onProfileSaved(updated);
    showToast("Profile updated successfully");
    if (window.go && profileView) window.go(profileView);
  }

  async function useCurrentLocationForProfile() {
    try {
      const location = await requestBrowserLocation();
      const city = document.getElementById("editCity");
      const state = document.getElementById("editState");
      if (city && location.city) city.value = location.city;
      if (state && location.state) state.value = location.state;
      updateCurrentProfile({ location, city: location.city || city?.value || "", state: location.state || state?.value || "" });
      showToast("Location added to profile");
    } catch (error) {
      showToast(error.message || "Could not detect location", "error");
    }
  }

  function showToast(message, type = "success") {
    let toast = document.getElementById("appToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "appToast";
      toast.className = "app-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `app-toast active ${type}`;
    setTimeout(() => toast.classList.remove("active"), 2400);
  }

  function animateContent() {
    const body = document.getElementById("body");
    if (!body) return;
    body.classList.remove("view-enter");
    void body.offsetWidth;
    body.classList.add("view-enter");
    requestAnimationFrame(() => window.ConnectHubObserveEntrances?.(body));
  }

  function refreshPulse() {
    const bar = document.getElementById("appRefreshBar");
    if (!bar) return;
    bar.classList.remove("active");
    void bar.offsetWidth;
    bar.classList.add("active");
    setTimeout(() => bar.classList.remove("active"), 650);
  }

  function updateBackButton() {
    const backBtn = document.getElementById("viewBackBtn");
    if (!backBtn) return;
    backBtn.style.display = currentView && currentView !== homeView ? "inline-flex" : "none";
  }

  function back() {
    playSound("back");
    const next = historyStack.pop() || homeView;
    if (next && window.go) {
      const previous = currentView;
      currentView = "";
      window.go(next);
      if (previous === next && next !== homeView) window.go(homeView);
    }
  }

  function closeMenu() {
    document.querySelector(".app-container")?.classList.remove("nav-open");
  }

  return { init, onView, back, playSound, startPayment, applyUserChrome, updateUnreadBadge, markNotificationsRead, setNotificationTab, openNotification, removeNotification, reviewUser, renderMessageDockBody, sendDockMessage, sendImageMessage, sendLocationMessage, toggleVoiceRecording, renderEditProfilePage, renderSettingsPage, renderNetworkPage, setNetworkRoleFilter, handleNetworkSearchInput, runNetworkSearch, toggleSavedProfile, respondConnection, removeConnection, setThemeMode, cycleLanguagePreference, cycleFontSizePreference, toggleAccountPrivacy, cycleMessagingPrivacy, openSecurityHub, sendSettingsOtp, updateSettingsPasscode, handleSettingsSearchInput, openSettingAction, openSettingsNotifications, closeSettingsModal, closeSettingsBottomSheet, selectSettingsSheetOption, saveSettingsToggle, saveNotificationPref, openProfileVisibilitySelector, openMessagingPrivacySelector, openLanguageSelector, openFontSizeSelector, openSettingsEditProfile, previewSettingsAvatar, saveSettingsProfile, useSettingsLocation, openManageContact, saveSettingsContact, openLinkedAccounts, saveLinkedAccounts, mockConnectAccount, openChangePassword, sendSettingsPasswordOtp, updatePasswordStrength, submitSettingsNewPassword, openActiveSessions, toggleSettingsSessionDetails, toggleSettingsSessionHistory, revokeSettingsSession, revokeOtherSettingsSessions, openBlockMutedUsers, addSettingsListUser, removeSettingsListUser, openCurrentPlan, openUpgradePro, openBillingHistory, downloadUserData, openActivityLog, openArchive, openHelpCenter, openReportProblem, submitSettingsReport, openRateApp, submitSettingsRating, openTerms, openAbout, openDeactivateAccount, confirmDeactivateAccount, openDeleteAccount, confirmDeleteAccount, openCommandPalette, closeCommandPalette, renderCommandResults, runCommand, installConnectHubApp, saveEditProfile, useCurrentLocationForProfile, showToast, closeMessages, renderInbox, setMessageTab, filterMessages, handleMessageSearchKey, focusMessageSearch, openChat, openExplorePage, closeExplore, filterExplore, setExploreCategory, setExploreFilter, toggleExploreFullscreen, openExploreFilter, openExploreMediaSheet, closeExploreMediaSheet, pickExploreImage, handleExploreImageSearch, clearExploreImagePreview, startExploreVoice, applyExploreSuggestion, clearExploreRecents, useLocationForExplore, saveExploreRecent, openMessageTo, startAvatarLongPress, cancelAvatarLongPress, avatarClickGuard, openProfileShareSheet, closeProfileShareSheet, sharePublicProfile, copyPublicProfileLink, openProfileQrCode, closeProfileQrCode, generateProfileQrFallback, openPostComposer, closePostComposer, publishComposedPost, openReel, closeReel, nextReel, prevReel, likePost, savePost, togglePostComments, postComment, toggleFollow, sharePost, openProfileFromPost };
})();
window.AppUX = AppUX;
