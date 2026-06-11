(function () {
  if (window.ConnectHub && window.ConnectHub.__coreReady) return;

  const root = window.ConnectHub || {};
  const state = root.state || {};

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function getStoredUser() {
    return readJson("connecthub_user", readJson("currentUser", null));
  }

  function refreshState() {
    const user = getStoredUser();
    state.currentUser = user;
    state.currentUserId = window.CURRENT_USER_ID || user?.id || user?._id || user?.email || user?.name || null;
    state.currentUserName = user?.name || user?.companyName || null;
    state.currentChatUserId = window.CURRENT_CHAT_USER_ID || "";
    state.onlineUsers = state.onlineUsers || new Set();
    state.seenEventKeys = state.seenEventKeys || new Set();
    state.notifQueue = state.notifQueue || [];
    state.isShowingNotif = Boolean(state.isShowingNotif);
    return state;
  }

  function rememberEvent(key, ttlMs) {
    if (!key) return true;
    const safeKey = String(key);
    if (state.seenEventKeys.has(safeKey)) return false;
    state.seenEventKeys.add(safeKey);
    setTimeout(() => state.seenEventKeys.delete(safeKey), ttlMs || 30000);
    return true;
  }

  function escHtml(value) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(String(value || "")));
    return div.innerHTML;
  }

  function fmtTime(date) {
    return new Date(date || Date.now()).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  }

  function fmtTimeAgo(date) {
    const diff = (Date.now() - new Date(date || Date.now()).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
    return new Date(date || Date.now()).toLocaleDateString("en-IN");
  }

  function bindSocket(socket, eventName, handler) {
    if (!socket || !eventName || typeof handler !== "function") return;
    if (typeof socket.off === "function") socket.off(eventName);
    socket.on(eventName, handler);
  }

  function incrementBellBadge() {
    const badge = document.getElementById("notifBadge") || document.querySelector("[data-notification-badge]");
    if (!badge) return;
    const current = parseInt(badge.textContent, 10) || 0;
    badge.textContent = current + 1 > 99 ? "99+" : String(current + 1);
    badge.classList.remove("hidden", "is-hidden");
    badge.hidden = false;
  }

  function showToast({ message, type, link } = {}) {
    const text = String(message || "New update");
    document.getElementById("chToast")?.remove();
    const toast = document.createElement("div");
    toast.id = "chToast";
    toast.className = "ch-toast ch-toast--" + (type || "info");
    toast.innerHTML = `
      <span class="ch-toast__msg">${escHtml(text)}</span>
      <button class="ch-toast__close" type="button" aria-label="Close">&times;</button>
    `;
    toast.querySelector(".ch-toast__close")?.addEventListener("click", event => {
      event.stopPropagation();
      toast.remove();
    });
    if (link) {
      toast.classList.add("ch-toast--link");
      toast.addEventListener("click", event => {
        if (!event.target.closest(".ch-toast__close")) window.location.href = link;
      });
    }
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("ch-toast--visible"));
    setTimeout(() => {
      toast.classList.remove("ch-toast--visible");
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  function enqueueNotif(data) {
    const key = data?.id || data?._id || `${data?.type || "notif"}:${data?.message || data?.text || ""}`;
    if (!rememberEvent("notif:" + key, 30000)) return;
    state.notifQueue.push(data || {});
    incrementBellBadge();
    if (!state.isShowingNotif) processNotifQueue();
  }

  function processNotifQueue() {
    if (!state.notifQueue.length) {
      state.isShowingNotif = false;
      return;
    }
    state.isShowingNotif = true;
    const item = state.notifQueue.shift();
    showToast({
      type: item.type || "info",
      message: item.message || item.text || "New ConnectHub update",
      link: item.link || item.targetUrl || ""
    });
    setTimeout(processNotifQueue, 4200);
  }

  function playTone() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Browsers can block audio before a user gesture.
    }
  }

  root.__coreReady = true;
  root.state = state;
  root.refreshState = refreshState;
  root.rememberEvent = rememberEvent;
  root.escHtml = escHtml;
  root.fmtTime = fmtTime;
  root.fmtTimeAgo = fmtTimeAgo;
  root.bindSocket = bindSocket;
  root.incrementBellBadge = incrementBellBadge;
  root.enqueueNotif = enqueueNotif;
  root.showToast = showToast;
  root.playMsgTone = playTone;

  refreshState();
  window.ConnectHub = root;
})();
