(function () {
  let root;
  let messages;
  let input;
  let config = {};

  function init(options = {}) {
    config = options;
    root = document.getElementById("aihubChatbotRoot");
    if (!root) return;
    root.innerHTML = `
      <section class="aihub-chat-window" id="aihubChatWindow" aria-label="ConnectHub AI chat">
        <header class="aihub-chat-header">
          <strong>ConnectHub AI</strong>
          <span class="muted" style="margin-left:auto">${roleGreeting()}</span>
          <button class="ghost" id="aihubChatClose" type="button">×</button>
        </header>
        <div class="aihub-chat-messages" id="aihubChatMessages"></div>
        <form class="aihub-chat-input" id="aihubChatForm">
          <input id="aihubChatInput" placeholder="Ask AI for matches, outreach, rates..." />
          <button class="aihub-card-btn" type="submit">Send</button>
        </form>
      </section>
    `;
    messages = document.getElementById("aihubChatMessages");
    input = document.getElementById("aihubChatInput");
    addMessage("ai", firstGreeting());
    document.getElementById("aihubFab")?.addEventListener("click", toggle);
    document.getElementById("aihubChatClose")?.addEventListener("click", close);
    document.getElementById("aihubChatForm")?.addEventListener("submit", send);
  }

  function roleGreeting() {
    const role = config.role || "member";
    return role === "startup" ? "Growth helper" : role === "investor" ? "Deal helper" : "Gig helper";
  }

  function firstGreeting() {
    const role = config.role || "freelancer";
    if (role === "startup") return "I can help find nearby talent, competitors, and growth actions for your startup.";
    if (role === "investor") return "I can explain hot deals, sector momentum, and portfolio risk in Indian startup context.";
    return "Hey! I can help find nearby gigs, draft outreach, and improve your ConnectHub profile.";
  }

  function toggle() {
    document.getElementById("aihubChatWindow")?.classList.toggle("open");
  }

  function close() {
    document.getElementById("aihubChatWindow")?.classList.remove("open");
  }

  async function send(event) {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    addMessage("user", text);
    const thinking = addMessage("ai", "Thinking...");
    try {
      const location = config.getLocation?.() || {};
      const response = await fetch("/api/aihub/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, role: config.role, city: location.city })
      });
      const data = await response.json();
      thinking.textContent = data.reply || "I could not generate a response right now.";
    } catch {
      thinking.textContent = "AI is temporarily unavailable. Try again in a moment.";
    }
    messages.scrollTop = messages.scrollHeight;
  }

  function addMessage(kind, text) {
    const bubble = document.createElement("div");
    bubble.className = `aihub-msg ${kind === "user" ? "user" : "ai"}`;
    bubble.textContent = text;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  }

  window.ConnectHubAIChatbot = { init, toggle, close };
})();
