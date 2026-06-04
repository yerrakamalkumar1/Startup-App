(function () {
  let count = 0;
  let items = [];
  let panel;
  let bellCount;
  let startY = null;

  function init() {
    panel = document.getElementById("aihubNotificationPanel");
    bellCount = document.getElementById("aihubBellCount");
    document.getElementById("aihubBell")?.addEventListener("click", event => {
      event.stopPropagation();
      toggle();
    });
    setupDismissListeners();
    load();
  }

  async function load() {
    try {
      const response = await fetch("/api/aihub/notifications");
      const data = await response.json();
      items = data.notifications || [];
      count = data.unread || 0;
      render();
    } catch {
      items = [{ text: "AI Hub notifications are temporarily unavailable.", createdAt: new Date().toISOString() }];
      count = 0;
      render();
    }
  }

  function push(text) {
    items.unshift({ text, createdAt: new Date().toISOString(), read: false, cta: "/dashboard/aihub" });
    count += 1;
    render();
    playSoftBell();
  }

  function toggle() {
    if (!panel) return;
    panel.classList.contains("open") ? close() : open();
  }

  function open() {
    if (!panel) return;
    panel.classList.remove("closing");
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
  }

  function close() {
    if (!panel || !panel.classList.contains("open")) return;
    panel.classList.add("closing");
    window.setTimeout(() => {
      panel?.classList.remove("open", "closing");
      panel?.setAttribute("aria-hidden", "true");
    }, 180);
  }

  function setupDismissListeners() {
    document.addEventListener("click", event => {
      if (!panel?.classList.contains("open")) return;
      const bell = document.getElementById("aihubBell");
      if (panel.contains(event.target) || bell?.contains(event.target)) return;
      close();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") close();
    });
    window.addEventListener("scroll", close, { passive: true });
    panel?.addEventListener("touchstart", event => {
      startY = event.touches?.[0]?.clientY ?? null;
    }, { passive: true });
    panel?.addEventListener("touchmove", event => {
      if (startY === null) return;
      const y = event.touches?.[0]?.clientY ?? startY;
      if (startY - y > 42) close();
    }, { passive: true });
  }

  function render() {
    if (bellCount) bellCount.textContent = String(count);
    if (!panel) return;
    panel.className = "aihub-notification-panel";
    panel.innerHTML = `
      <strong>AI Notifications</strong>
      <div class="aihub-list" style="margin-top:10px">
        ${items.slice(0, 10).map(item => `
          <article class="aihub-result-card">
            <p>${escapeHtml(item.text)}</p>
            <a class="aihub-card-btn ghost" href="${item.cta || "/dashboard/aihub"}">Open</a>
          </article>
        `).join("")}
      </div>
    `;
  }

  function playSoftBell() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.value = 0.03;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.12);
    } catch {}
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  window.ConnectHubAINotifications = { init, push, load, open, close };
})();
