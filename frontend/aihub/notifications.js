(function () {
  let count = 0;
  let items = [];
  let panel;
  let bellCount;

  function init() {
    panel = document.getElementById("aihubNotificationPanel");
    bellCount = document.getElementById("aihubBellCount");
    document.getElementById("aihubBell")?.addEventListener("click", toggle);
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
    panel.classList.toggle("open");
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

  window.ConnectHubAINotifications = { init, push, load };
})();
