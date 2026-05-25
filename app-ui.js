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
  let exploreFilters = { role: "", location: "", skills: "", company: "" };
  let currentMessageTab = "focused";
  let currentNotificationTab = "all";
  let visibleNotificationIds = [];

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
    body.innerHTML = `
      <div class="explore-search-shell">
        <button class="explore-round-action" type="button" onclick="AppUX.closeExplore()" aria-label="Back"><i data-lucide="arrow-left"></i></button>
        <div class="explore-search-input google-style ${q ? "has-value" : ""}">
          <div class="explore-search-main">
            <i data-lucide="search"></i>
            <input id="exploreSearch" value="${escapeHTML(query)}" placeholder="Ask ConnectHub" oninput="AppUX.filterExplore(this.value)" dir="auto">
          </div>
          <div class="explore-search-actions">
            <button type="button" onclick="AppUX.openExploreMediaSheet()" aria-label="Add image or attachment"><i data-lucide="plus"></i></button>
            <button type="button" onclick="AppUX.startExploreVoice()" aria-label="Voice search"><i data-lucide="mic"></i></button>
            <button type="button" onclick="AppUX.pickExploreImage('camera')" aria-label="Scan profile QR code"><i data-lucide="scan-line"></i></button>
          </div>
        </div>
        <button class="explore-round-action" type="button" onclick="AppUX.useLocationForExplore()" title="Use current location"><i data-lucide="map-pin"></i></button>
      </div>
      <div class="explore-filter-row">
        ${["role", "location", "skills", "company"].map(key => `<button type="button" class="${exploreFilters[key] ? "active" : ""}" onclick="AppUX.openExploreFilter('${key}')">${key[0].toUpperCase() + key.slice(1)}${exploreFilters[key] ? `: ${escapeHTML(exploreFilters[key])}` : ""}</button>`).join("")}
      </div>
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
      <div id="exploreResultsSummary" class="explore-results-summary"></div>
      <div id="exploreResults" class="explore-directory">
        ${skeletonLoader(4)}
      </div>
    `;
    const input = document.getElementById("exploreSearch");
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
    if (window.lucide) window.lucide.createIcons();
    loadExplorePeopleResults(query);
  }

  function filterExplore(query) {
    renderExploreDirectory(query);
  }

  async function loadExplorePeopleResults(query = "") {
    const requestId = ++exploreSearchRequestId;
    const user = getCurrentUser?.() || {};
    const holder = document.getElementById("exploreResults");
    const summary = document.getElementById("exploreResultsSummary");
    if (!holder) return;
    const localResults = localPeopleSearch(query);
    if (summary) summary.textContent = query ? `${localResults.length} people found for "${query}"` : "People you may want to connect with";
    holder.innerHTML = localResults.map(renderPeopleSearchCard).join("") ||
      `<div class="empty-message-state">No people found for '${escapeHTML(query || "your filters")}' yet. Checking live profiles...</div>`;
    if (window.lucide) window.lucide.createIcons();
    try {
      const params = new URLSearchParams({
        q: query || "",
        current: user.name || "",
        role: exploreFilters.role || "",
        location: exploreFilters.location || "",
        skills: exploreFilters.skills || "",
        company: exploreFilters.company || ""
      });
      const data = await apiRequest(`/api/people/search?${params.toString()}`);
      if (requestId !== exploreSearchRequestId) return;
      const results = mergePeopleResults(data.results || [], localResults);
      if (summary) summary.textContent = query ? `${results.length} people found for "${query}"` : "People you may want to connect with";
      holder.innerHTML = results.map(renderPeopleSearchCard).join("") ||
        `<div class="empty-message-state">No people found for '${escapeHTML(query || "your filters")}'. Try a name, @username, role, city, skill, or company.</div>`;
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
      const haystack = [profile.name, id, role, location, skills.join(" "), companyName, profile.bio, profile.searchText].join(" ").toLowerCase();
      const score = !q ? 1 :
        String(profile.name || "").toLowerCase() === q ? 100 :
        String(profile.name || "").toLowerCase().startsWith(q) ? 90 :
        id === q ? 95 :
        fuzzyWordsMatch(profile.name, q) ? 86 :
        role.toLowerCase().includes(q) ? 70 :
        location.toLowerCase().includes(q) ? 55 :
        skills.join(" ").toLowerCase().includes(q) ? 50 :
        haystack.includes(q) ? 20 : -1;
      return { ...profile, id, handle: id, role, location, companyName, skills, mutualConnections: currentConnections.has(profile.name) ? 1 : 0, profileUrl: profileUrl(profile), score };
    }).filter(profile => {
      if (profile.score < 0) return false;
      if (exploreFilters.role && !String(profile.role || profile.roleType || "").toLowerCase().includes(exploreFilters.role.toLowerCase())) return false;
      if (exploreFilters.location && !String(profile.location || "").toLowerCase().includes(exploreFilters.location.toLowerCase())) return false;
      if (exploreFilters.skills && !String(profile.skills || "").toLowerCase().includes(exploreFilters.skills.toLowerCase())) return false;
      if (exploreFilters.company && !String(profile.companyName || "").toLowerCase().includes(exploreFilters.company.toLowerCase())) return false;
      return true;
    });
    return people.sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name)));
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

  function renderPeopleSearchCard(person) {
    const safeName = String(person.name || "").replace(/'/g, "\\'");
    const profile = { ...person, email: person.email || person.handle, title: person.role };
    return `<article class="explore-card people-search-card">
      <div class="explore-card-main">
        <a href="${person.profileUrl || profileUrl(profile)}" onclick="AppUX.saveExploreRecent('${person.id || person.handle}')">${avatarMarkup(profile, "user-avatar")}</a>
        <div>
          <strong>${escapeHTML(person.name || "ConnectHub member")}</strong>
          <small>@${escapeHTML(person.handle || person.id || userIdFor(profile))}</small>
          <p>${escapeHTML(person.role || "Member")}</p>
        </div>
      </div>
      <p class="explore-card-bio"><i data-lucide="map-pin"></i> ${escapeHTML(person.location || "India")} · ${Number(person.mutualConnections || 0)} mutual connections</p>
      <div class="profile-tag-row">${[...(person.skills || []), person.companyName].filter(Boolean).slice(0, 4).map(tag => `<span>${escapeHTML(tag)}</span>`).join("")}</div>
      <div class="explore-card-actions">
        <a class="btn btn-secondary" href="${person.profileUrl || profileUrl(profile)}" onclick="AppUX.saveExploreRecent('${person.id || person.handle}')">Profile</a>
        <button class="btn btn-primary" onclick="AppUX.openMessageTo('${safeName}')">Message</button>
      </div>
    </article>`;
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

  function applyExploreSuggestion(query) {
    renderExploreDirectory(query);
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
        <a class="btn btn-secondary" href="profile/${encodeURIComponent(id)}" onclick="AppUX.saveExploreRecent('${id}')">Profile</a>
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
      if (q && !text.includes(q)) return false;
      if (tab === "jobs") return row.roleType === "startup" || row.roleType === "recruiter" || jobWords.test(row.lastText);
      if (tab === "unread") return row.unread > 0;
      if (tab === "network") return row.connected && row.roleType !== "startup";
      return true;
    }).sort((a, b) => new Date(b.recentAt || 0) - new Date(a.recentAt || 0) || a.name.localeCompare(b.name));
  }

  function renderMessageRow(row) {
    const online = (window.ConnectHubOnlineUsers || []).includes(row.name);
    const safeName = String(row.name || "").replace(/'/g, "\\'");
    return `<button class="message-row" onclick="AppUX.openChat('${safeName}')">
      <span class="message-avatar-wrap">${avatarMarkup(row, "user-avatar")}<i class="${online ? "online" : ""}"></i></span>
      <span class="message-row-main">
        <strong>${escapeHTML(row.name)}</strong>
        <small>@${escapeHTML(row.handle || userIdFor(row))} · ${escapeHTML(row.role || "Member")}</small>
        <em>${escapeHTML(messagePreview(row.lastMessage || { text: row.lastText }))}</em>
      </span>
      <span class="message-row-meta"><small>${row.recentAt ? relativeTime(row.recentAt) : ""}</small>${row.unread ? `<b>${row.unread}</b>` : ""}</span>
    </button>`;
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

  return { init, onView, back, playSound, startPayment, applyUserChrome, updateUnreadBadge, markNotificationsRead, setNotificationTab, openNotification, removeNotification, reviewUser, renderMessageDockBody, sendDockMessage, sendImageMessage, sendLocationMessage, toggleVoiceRecording, renderEditProfilePage, saveEditProfile, useCurrentLocationForProfile, showToast, closeMessages, renderInbox, setMessageTab, filterMessages, handleMessageSearchKey, focusMessageSearch, openChat, openExplorePage, closeExplore, filterExplore, openExploreFilter, openExploreMediaSheet, closeExploreMediaSheet, pickExploreImage, handleExploreImageSearch, clearExploreImagePreview, startExploreVoice, applyExploreSuggestion, clearExploreRecents, useLocationForExplore, saveExploreRecent, openMessageTo, startAvatarLongPress, cancelAvatarLongPress, avatarClickGuard, openProfileShareSheet, closeProfileShareSheet, sharePublicProfile, copyPublicProfileLink, openProfileQrCode, closeProfileQrCode, generateProfileQrFallback };
})();
