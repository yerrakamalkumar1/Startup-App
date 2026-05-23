const AppUX = (() => {
  let audioCtx = null;
  let homeView = "";
  let profileView = "";
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
    document.addEventListener("pointerdown", unlockAudio, { once: true });
    installShellControls();
    installProfileMenu();
    installButtonSounds();
    installRefreshBar();
    installDarkMode();
    installRealtime();
    installMessageDock();
    applyUserChrome();
  }

  function installShellControls() {
    const app = document.querySelector(".app-container");
    const nav = document.querySelector(".top-navbar");
    const pageTitle = document.querySelector(".page-title");
    const logo = document.querySelector(".sidebar-logo");
    if (!app || !nav || !pageTitle) return;

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
      nav.insertBefore(menuBtn, nav.firstChild);
    }

    if (!document.getElementById("viewBackBtn")) {
      const backBtn = document.createElement("button");
      backBtn.id = "viewBackBtn";
      backBtn.className = "btn btn-secondary btn-icon view-back-btn";
      backBtn.title = "Back";
      backBtn.innerHTML = '<i data-lucide="arrow-left"></i>';
      backBtn.addEventListener("click", back);
      pageTitle.prepend(backBtn);
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
  }

  function installDarkMode() {
    const saved = localStorage.getItem("connecthub_theme") || "light";
    document.documentElement.dataset.theme = saved;
    if (document.getElementById("themeToggle")) return;
    const nav = document.querySelector(".top-navbar > div:last-child");
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
  }

  function installMessageDock() {
    const user = getCurrentUser?.();
    if (!user || document.getElementById("messageDockBtn")) return;
    const button = document.createElement("button");
    button.id = "messageDockBtn";
    button.className = "ai-bot-toggle";
    button.title = "Messages";
    button.style.bottom = "96px";
    button.innerHTML = '<i data-lucide="message-circle"></i>';
    button.addEventListener("click", openMessageDock);
    document.body.appendChild(button);

    const modal = document.createElement("div");
    modal.id = "messageDock";
    modal.className = "modal-overlay";
    modal.innerHTML = `<div class="modal-content glass-panel">
      <div class="modal-header">
        <h3>Messages & Network</h3>
        <button class="btn btn-secondary btn-icon" type="button" onclick="document.getElementById('messageDock').classList.remove('active')"><i data-lucide="x"></i></button>
      </div>
      <div id="messageDockBody"></div>
    </div>`;
    document.body.appendChild(modal);
    if (window.lucide) window.lucide.createIcons();
  }

  function openMessageDock() {
    const user = getCurrentUser?.();
    const db = getDB();
    const profiles = getAllProfiles().filter(profile => profile.name !== user.name);
    const selected = profiles[0]?.name || "";
    document.getElementById("messageDockBody").innerHTML = renderMessageDockBody(selected);
    document.getElementById("messageDock").classList.add("active");
    markVisibleMessagesRead();
    if (window.lucide) window.lucide.createIcons();
  }

  function renderMessageDockBody(selectedName) {
    const user = getCurrentUser();
    const db = getDB();
    const profiles = getAllProfiles().filter(profile => profile.name !== user.name);
    const messages = db.messages.filter(m =>
      (m.from === user.name && m.to === selectedName) || (m.from === selectedName && m.to === user.name)
    );
    return `<div class="form-group">
      <label>Talk to</label>
      <select id="msgTo" class="form-control" onchange="document.getElementById('messageDockBody').innerHTML = AppUX.renderMessageDockBody(this.value)">
        ${profiles.map(profile => `<option ${profile.name === selectedName ? "selected" : ""}>${profile.name}</option>`).join("")}
      </select>
    </div>
    <div class="message-panel">
      ${messages.map(message => `<div class="message-bubble ${message.from === user.name ? "mine" : ""}">${message.text}</div>`).join("") || '<p style="color:#7b8794;text-align:center;padding:1rem;">No messages yet.</p>'}
    </div>
    <div style="display:flex;gap:0.5rem;margin-top:0.8rem;">
      <input id="msgText" class="form-control" placeholder="Write a message...">
      <button class="btn btn-primary" onclick="AppUX.sendDockMessage()"><i data-lucide="send"></i></button>
    </div>
    <div style="margin-top:1rem;">
      <h4 style="font-size:0.85rem;margin-bottom:0.5rem;">My Network</h4>
      ${(db.connections || []).filter(c => [c.from, c.to].includes(user.name)).map(c => `<span class="badge badge-green">${c.from === user.name ? c.to : c.from} - ${c.status}</span>`).join(" ") || '<span style="color:#7b8794;font-size:0.8rem;">No connections yet.</span>'}
    </div>`;
  }

  function sendDockMessage() {
    const to = document.getElementById("msgTo")?.value;
    const text = document.getElementById("msgText")?.value;
    if (!to || !text) return;
    sendLocalMessage(to, text);
    document.getElementById("messageDockBody").innerHTML = renderMessageDockBody(to);
    updateUnreadBadge();
    playSound("done");
    if (window.lucide) window.lucide.createIcons();
  }

  function markVisibleMessagesRead() {
    const user = getCurrentUser?.();
    if (!user) return;
    const db = getDB();
    db.messages.forEach(message => {
      if (message.to === user.name) message.read = true;
    });
    db.notifications.forEach(note => {
      if (note.to === user.name) note.read = true;
    });
    saveDB(db);
    updateUnreadBadge();
  }

  function updateUnreadBadge() {
    const badge = document.getElementById("unreadBadge");
    if (!badge) return;
    const unread = getUnreadCount?.() || 0;
    badge.textContent = unread;
    badge.style.display = unread ? "inline-flex" : "none";
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
    closeMenu();
    animateContent();
    refreshPulse();
    updateBackButton();
    playSound("nav");
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

  return { init, onView, back, playSound, startPayment, applyUserChrome, updateUnreadBadge, renderMessageDockBody, sendDockMessage };
})();
