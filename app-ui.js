const AppUX = (() => {
  let audioCtx = null;
  let homeView = "";
  let profileView = "";
  let exploreView = "";
  let adsView = "";
  let onProfileSaved = null;
  let historyStack = [];
  let currentView = "";

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
    installNotificationBell();
    installRealtime();
    installMessageDock();
    installExplorePage();
    installBottomNav();
    installMediaOptimizer();
    applyUserChrome();
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
    document.documentElement.dataset.theme = saved;
    if (document.getElementById("themeToggle")) return;
    const nav = document.querySelector(".top-navbar > div:last-child") || document.querySelector(".top-navbar");
    if (!nav) return;
    const button = document.createElement("button");
    button.id = "themeToggle";
    button.className = "btn btn-secondary btn-icon";
    button.title = "Toggle dark mode";
    button.innerHTML = '<i data-lucide="moon"></i>';
    button.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("connecthub_theme", next);
      playSound("nav");
    });
    nav.prepend(button);
    if (window.lucide) window.lucide.createIcons();
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
    const db = getDB();
    const items = (db.notifications || [])
      .filter(note => note.to === user.name || note.to === user.companyName)
      .slice()
      .reverse()
      .slice(0, 12);
    panel.innerHTML = `
      <div class="notification-panel-head">
        <strong>Notifications</strong>
        <button type="button" onclick="AppUX.markNotificationsRead()">Mark read</button>
      </div>
      <div class="notification-filter-row">
        <button type="button" class="active">All</button>
        <button type="button">Messages</button>
        <button type="button">Network</button>
      </div>
      ${items.map(note => renderNotificationItem(note)).join("") || '<p class="notification-empty">No notifications yet.</p>'}
    `;
    if (window.lucide) window.lucide.createIcons();
  }

  function notificationActorName(note) {
    const text = String(note.text || "");
    if (note.from) return note.from;
    if (text.startsWith("New message from ")) return text.replace("New message from ", "").trim();
    if (text.includes(" sent you ")) return text.split(" sent you ")[0].trim();
    if (text.includes(" expressed interest")) return text.split(" expressed interest")[0].trim();
    if (text.includes(" rated you ")) return text.split(" rated you ")[0].trim();
    return "";
  }

  function profileUrl(profile) {
    const id = userIdFor(profile || {});
    return `profile.html?id=${encodeURIComponent(id)}`;
  }

  function renderNotificationItem(note) {
    const actorName = notificationActorName(note);
    const profile = getAllProfiles().find(item => item.name === actorName) || { name: actorName || "Connect Hub", avatarInitials: initialsForName(actorName || "CH") };
    const text = escapeHTML(note.text || "New notification");
    const actor = escapeHTML(actorName || profile.name || "Connect Hub");
    const message = actorName ? text.replace(actor, "").trim() : text;
    return `<article class="notification-item ${note.read ? "" : "unread"}">
      <a class="notification-avatar-link" href="${profileUrl(profile)}" onclick="AppUX.markNotificationsRead()">${avatarMarkup(profile, "user-avatar")}</a>
      <div class="notification-copy">
        <p><a href="${profileUrl(profile)}" onclick="AppUX.markNotificationsRead()">${actor}</a> ${message}</p>
        <small>${new Date(note.createdAt || Date.now()).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small>
        <div class="notification-actions">
          <button type="button" onclick="AppUX.openNotification('${note.id}')">Open</button>
          <button type="button" onclick="AppUX.removeNotification('${note.id}')">Remove</button>
        </div>
      </div>
      <button type="button" title="Mark read" onclick="AppUX.markNotificationsRead()"><i data-lucide="check"></i></button>
    </article>`;
  }

  function installRealtime() {
    const user = getCurrentUser?.();
    if (!user || window.__connectHubSocketStarted) return;
    window.__connectHubSocketStarted = true;
    const script = document.createElement("script");
    script.src = "/socket.io/socket.io.js";
    script.onload = () => {
      if (!window.io) return;
      const socket = window.io();
      window.ConnectHubSocket = socket;
      socket.emit("user:online", user.name);
      socket.on("presence:update", names => {
        window.ConnectHubOnlineUsers = names || [];
        document.dispatchEvent(new CustomEvent("connecthub:presence"));
      });
      socket.on("message:new", message => {
        const db = getDB();
        db.messages = db.messages || [];
        if (!db.messages.some(m => m.id === message.id)) db.messages.push(message);
        saveDB(db);
        updateUnreadBadge();
        playSound("bell");
      });
    };
    script.onerror = () => {};
    document.head.appendChild(script);
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
    syncFromBackend?.().then(() => {
      if (page.classList.contains("active")) renderExploreDirectory(document.getElementById("exploreSearch")?.value || "");
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
    const allItems = exploreItems();
    const recents = recentExploreProfiles(allItems);
    const suggestions = exploreSuggestions(user);
    const items = allItems.filter(item => {
      const profile = item.avatarProfile || { name: item.personName || item.name, email: item.email };
      const id = userIdFor(profile);
      const haystack = [item.name, item.personName, id, item.type, item.role, item.title, item.sector, item.city, item.state, item.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return !q || haystack.includes(q) || suggestionMatch(item, q, user);
    });
    body.innerHTML = `
      <div class="explore-search-shell">
        <button class="btn btn-secondary btn-icon" type="button" onclick="AppUX.closeExplore()" aria-label="Back"><i data-lucide="arrow-left"></i></button>
        <div class="explore-search-input">
          <i data-lucide="search"></i>
          <input id="exploreSearch" value="${escapeHTML(query)}" placeholder="Search" oninput="AppUX.filterExplore(this.value)">
        </div>
        <button class="btn btn-secondary btn-icon" type="button" onclick="AppUX.useLocationForExplore()" title="Use current location"><i data-lucide="scan-line"></i></button>
      </div>
      ${!q ? `<section class="explore-recents">
        <div class="explore-section-title"><strong>Recent</strong><button type="button" onclick="AppUX.clearExploreRecents()">Clear all</button></div>
        <div class="explore-recent-row">${recents.map(renderExploreRecent).join("") || '<p>No recent profiles yet.</p>'}</div>
      </section>
      <section class="explore-suggestions">
        <h3>Try searching for</h3>
        ${suggestions.map(item => `<button type="button" onclick="AppUX.applyExploreSuggestion('${item.replace(/'/g, "\\'")}')"><i data-lucide="search"></i><span>${item}</span></button>`).join("")}
      </section>
      <section class="explore-news">
        <h3>Today&apos;s opportunities</h3>
        <button type="button" onclick="AppUX.applyExploreSuggestion('startups near me')"><span>Startups near me from ConnectHub profiles</span><i data-lucide="map-pin"></i></button>
      </section>` : ""}
      <div class="explore-directory">
        ${items.map(item => renderExploreCard(item)).join("") || '<div class="empty-message-state">No users found.</div>'}
      </div>
    `;
    const input = document.getElementById("exploreSearch");
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
    if (window.lucide) window.lucide.createIcons();
  }

  function filterExplore(query) {
    renderExploreDirectory(query);
  }

  function recentExploreProfiles(items) {
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
    return `<a class="explore-recent" href="profile.html?id=${id}" onclick="AppUX.saveExploreRecent('${id}')">
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

  function applyExploreSuggestion(query) {
    renderExploreDirectory(query);
  }

  function clearExploreRecents() {
    localStorage.removeItem("connecthub_explore_recents");
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
    const online = (window.ConnectHubOnlineUsers || []).includes(profile.name);
    const meta = [item.type, item.sector, item.city].filter(Boolean).join(" • ");
    return `<article class="explore-card">
      <div class="explore-card-main">
        <span class="message-avatar-wrap">${avatarMarkup(profile, "user-avatar")}<i class="${online ? "online" : ""}"></i></span>
        <div>
          <strong>${item.name || profile.name}</strong>
          <small>@${id}</small>
          <p>${meta || profile.title || "Connect Hub member"}</p>
        </div>
      </div>
      <p class="explore-card-bio">${item.description || profile.bio || "Open to networking and collaboration."}</p>
      <div class="explore-card-actions">
        <a class="btn btn-secondary" href="profile.html?id=${id}" onclick="AppUX.saveExploreRecent('${id}')">Profile</a>
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
    const baseProfiles = getAllProfiles();
    const startupContacts = (db.startups || []).map(startup => ({
      name: startup.name,
      title: `${startup.stage || "Startup"} - ${startup.sector || "Business"}`,
      role: "startup_admin",
      email: startup.id,
      avatarInitials: startup.logoInitials,
      city: startup.city,
      state: startup.state,
      bio: startup.description
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
    const user = getCurrentUser();
    const db = getDB();
    const q = String(query || "").trim().toLowerCase();
    const profiles = getMessageContacts().filter(profile => {
      if (!q) return true;
      const id = userIdFor(profile);
      const text = [
        profile.name,
        profile.title,
        profile.role,
        profile.email,
        id,
        profile.city,
        profile.state,
        profile.bio
      ].join(" ").toLowerCase();
      const last = [...(db.messages || [])].reverse().find(m =>
        (m.from === user.name && m.to === profile.name) || (m.from === profile.name && m.to === user.name)
      );
      return text.includes(q) || String(last?.text || "").toLowerCase().includes(q);
    });
    const rows = profiles.map(profile => {
      const last = [...(db.messages || [])].reverse().find(m =>
        (m.from === user.name && m.to === profile.name) || (m.from === profile.name && m.to === user.name)
      );
      const unread = (db.messages || []).filter(m => m.from === profile.name && m.to === user.name && !m.read).length;
      const online = (window.ConnectHubOnlineUsers || []).includes(profile.name);
      const safeName = profile.name.replace(/'/g, "\\'");
      const preview = messagePreview(last);
      return `<button class="message-row" onclick="AppUX.openChat('${safeName}')">
        <span class="message-avatar-wrap">${avatarMarkup(profile, "user-avatar")}<i class="${online ? "online" : ""}"></i></span>
        <span class="message-row-main">
          <strong>${profile.name}</strong>
          <small>@${(profile.email || profile.name).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}</small>
          <em>${preview}</em>
        </span>
        <span class="message-row-meta"><small>${last ? new Date(last.createdAt || Date.now()).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : ""}</small>${unread ? `<b>${unread}</b>` : ""}</span>
      </button>`;
    }).join("");

    document.getElementById("messageDockBody").innerHTML = `
      <div class="message-inbox-tools">
        <div class="message-search"><i data-lucide="search"></i><input id="messageSearch" placeholder="Search messages by name, @id or text" value="${escapeHTML(query)}" oninput="AppUX.filterMessages(this.value)" onkeydown="AppUX.handleMessageSearchKey(event)"></div>
        <button class="btn btn-secondary btn-icon" type="button" onclick="AppUX.focusMessageSearch()" title="New message"><i data-lucide="edit-3"></i></button>
      </div>
      <div class="message-filter-row">
        <button class="active" type="button">Focused</button>
        <button type="button">Jobs</button>
        <button type="button">Unread</button>
        <button type="button">Network</button>
      </div>
      <div id="messageRows" class="message-list">${rows || '<div class="empty-message-state">No matching users found. Try full name, username, role, city, or startup name.</div>'}</div>
    `;
    if (window.lucide) window.lucide.createIcons();
    const search = document.getElementById("messageSearch");
    if (search && query) {
      search.focus();
      search.setSelectionRange(search.value.length, search.value.length);
    }
  }

  function filterMessages(query) {
    renderInbox(query);
  }

  function handleMessageSearchKey(event) {
    if (event.key !== "Enter") return;
    const q = String(event.target.value || "").trim().toLowerCase();
    if (!q) return;
    const match = getMessageContacts().find(profile => {
      const id = userIdFor(profile);
      return profile.name.toLowerCase().includes(q) || id.includes(q);
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
    const db = getDB();
    const names = [user.name, user.companyName].filter(Boolean);
    db.messages.forEach(message => {
      if (names.includes(message.to)) message.read = true;
    });
    db.notifications.forEach(note => {
      if (names.includes(note.to)) note.read = true;
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
    db.notifications.forEach(note => {
      if (note.to === user.name || note.to === user.companyName) note.read = true;
    });
    saveDB(db);
    updateUnreadBadge();
    renderNotificationPanel();
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

  function onView(view) {
    if (currentView && currentView !== view) historyStack.push(currentView);
    currentView = view;
    document.body.dataset.currentView = view || "";
    closeMenu();
    animateContent();
    refreshPulse();
    updateBackButton();
    updateBottomNav();
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
            <label class="avatar-upload-preview" for="editPhoto">${user.avatarPhoto?.dataUrl ? `<img src="${user.avatarPhoto.dataUrl}" alt="Profile photo">` : `<span>${user.avatarInitials || "CH"}</span>`}</label>
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

  return { init, onView, back, playSound, startPayment, applyUserChrome, updateUnreadBadge, markNotificationsRead, openNotification, removeNotification, reviewUser, renderMessageDockBody, sendDockMessage, sendImageMessage, sendLocationMessage, toggleVoiceRecording, renderEditProfilePage, saveEditProfile, useCurrentLocationForProfile, showToast, closeMessages, renderInbox, filterMessages, handleMessageSearchKey, focusMessageSearch, openChat, openExplorePage, closeExplore, filterExplore, applyExploreSuggestion, clearExploreRecents, useLocationForExplore, saveExploreRecent, openMessageTo };
})();
