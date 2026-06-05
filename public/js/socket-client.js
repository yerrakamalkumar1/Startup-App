(function () {
  "use strict";

  class ConnectHubSocket {
    constructor(options = {}) {
      this.options = {
        socketScript: "/socket.io/socket.io.js",
        fallbackScript: "https://cdn.socket.io/4.7.5/socket.io.min.js",
        ...options
      };
      this.socket = null;
      this.typingTimer = null;
      this.connected = false;
    }

    async init() {
      const user = this.getCurrentUser();
      if (!user || window.__connectHubStandaloneSocket) return null;
      window.__connectHubStandaloneSocket = this;
      await this.ensureSocketLibrary();
      if (!window.io) return null;
      const token = this.getToken();
      this.socket = window.io(location.protocol === "file:" ? undefined : window.location.origin, {
        auth: { token, userId: user.name, role: user.role },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionDelay: 700,
        reconnectionDelayMax: 4000
      });
      this.registerEvents();
      this.bindTypingEmitter();
      return this.socket;
    }

    getToken() {
      return localStorage.getItem("connecthub_token") ||
        localStorage.getItem("token") ||
        this.readCookie("token") ||
        "";
    }

    getCurrentUser() {
      try {
        return JSON.parse(localStorage.getItem("connecthub_user") || localStorage.getItem("currentUser") || "null");
      } catch {
        return null;
      }
    }

    readCookie(name) {
      const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
      return match ? decodeURIComponent(match[1]) : "";
    }

    currentNames() {
      const user = this.getCurrentUser();
      return [user?.name, user?.companyName].filter(Boolean);
    }

    ensureSocketLibrary() {
      if (window.io) return Promise.resolve();
      return new Promise(resolve => {
        const load = src => {
          const script = document.createElement("script");
          script.src = src;
          script.crossOrigin = "anonymous";
          script.onload = resolve;
          script.onerror = () => {
            if (src !== this.options.fallbackScript) load(this.options.fallbackScript);
            else resolve();
          };
          document.head.appendChild(script);
        };
        load(this.options.socketScript);
      });
    }

    registerEvents() {
      if (!this.socket) return;
      this.socket.on("connect", () => {
        this.connected = true;
        this.currentNames().forEach(name => this.socket.emit("user:online", name));
        this.updateConnectionBadge(true);
        document.dispatchEvent(new CustomEvent("connecthub:socket", { detail: { connected: true } }));
        this.fetchUnreadCount();
      });
      this.socket.on("disconnect", () => {
        this.connected = false;
        this.updateConnectionBadge(false);
        document.dispatchEvent(new CustomEvent("connecthub:socket", { detail: { connected: false } }));
      });
      this.socket.on("presence:update", names => {
        window.ConnectHubOnlineUsers = names || [];
        document.dispatchEvent(new CustomEvent("connecthub:presence", { detail: { names: names || [] } }));
      });
      this.socket.on("notification:new", note => this.handleNotification(note));
      this.socket.on("notifications:update", payload => {
        if (payload?.notification) this.handleNotification(payload.notification);
      });
      this.socket.on("message:new", message => this.handleMessage(message));
      this.socket.on("message:typing", payload => {
        document.dispatchEvent(new CustomEvent("connecthub:typing", { detail: payload }));
      });
      this.socket.on("feed:newPost", post => {
        this.toast("New post added to your feed");
        document.dispatchEvent(new CustomEvent("connecthub:feed-post", { detail: post }));
      });
      this.socket.on("post:updated", payload => {
        document.dispatchEvent(new CustomEvent("connecthub:post-updated", { detail: payload }));
      });
      this.socket.on("story:new", story => {
        this.toast("New story is live");
        document.dispatchEvent(new CustomEvent("connecthub:story", { detail: story }));
      });
    }

    handleNotification(note) {
      const names = this.currentNames();
      if (note?.to && names.length && !names.includes(note.to)) return;
      this.incrementBadge("notification");
      this.playBell();
      this.toast(note?.text || "New notification");
      document.dispatchEvent(new CustomEvent("connecthub:notification", { detail: note }));
    }

    handleMessage(message) {
      const names = this.currentNames();
      if (!names.includes(message?.from) && !names.includes(message?.to)) return;
      this.incrementBadge("message");
      this.playBell();
      document.dispatchEvent(new CustomEvent("connecthub:message", { detail: message }));
    }

    incrementBadge(kind) {
      const selectors = kind === "message"
        ? ["#bottomMsgBadge", "#unreadBadge", ".messages-badge"]
        : ["#notificationBellCount", "#bell-badge", ".notification-badge"];
      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(badge => {
          const next = Number(badge.textContent || "0") + 1;
          badge.textContent = String(next);
          badge.style.display = "inline-flex";
        });
      });
    }

    updateConnectionBadge(isOnline) {
      const badge = document.getElementById("connectivityBadge") || document.getElementById("online-badge");
      if (!badge) return;
      badge.classList.toggle("offline", !isOnline);
      badge.textContent = isOnline ? "Online" : "Offline";
    }

    fetchUnreadCount() {
      const token = this.getToken();
      if (!token || location.protocol === "file:") return;
      fetch("/api/notifications/unread-count", {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (!data || typeof data.count !== "number") return;
          document.querySelectorAll("#notificationBellCount,#bottomMsgBadge,#unreadBadge").forEach(badge => {
            badge.textContent = String(data.count);
            badge.style.display = data.count ? "inline-flex" : "none";
          });
        })
        .catch(() => {});
    }

    bindTypingEmitter() {
      document.addEventListener("input", event => {
        if (!this.socket || event.target?.id !== "msgText") return;
        const to = document.getElementById("msgTo")?.value;
        if (!to) return;
        clearTimeout(this.typingTimer);
        this.socket.emit("message:typing", {
          to,
          recipientId: to,
          conversationId: this.currentNames().concat(to).sort().join("__"),
          at: Date.now()
        });
        this.typingTimer = setTimeout(() => {}, 900);
      });
    }

    toast(message) {
      if (window.AppUX?.showToast) {
        window.AppUX.showToast(message);
        return;
      }
      let toast = document.getElementById("appToast");
      if (!toast) {
        toast = document.createElement("div");
        toast.id = "appToast";
        toast.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:9999;padding:12px 14px;border-radius:14px;background:#0f766e;color:#fff;font-weight:800;box-shadow:0 18px 40px rgba(15,23,42,.22)";
        document.body.appendChild(toast);
      }
      toast.textContent = message;
      toast.style.opacity = "1";
      setTimeout(() => { toast.style.opacity = "0"; }, 2400);
    }

    playBell() {
      try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 1046;
        gain.gain.value = 0.025;
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.11);
        oscillator.stop(context.currentTime + 0.14);
      } catch {}
    }
  }

  window.ConnectHubSocketClient = ConnectHubSocket;
  document.addEventListener("DOMContentLoaded", () => {
    if (document.documentElement.dataset.disableSocketClient === "true") return;
    const user = localStorage.getItem("connecthub_user") || localStorage.getItem("currentUser");
    if (user && !window.ConnectHubSocket) new ConnectHubSocket().init();
  });
})();
