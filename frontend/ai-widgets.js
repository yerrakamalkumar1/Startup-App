(function () {
  const teal = "#0f766e";

  function api(path, payload) {
    return fetch(path, {
      method: payload ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(localStorage.getItem("connecthub_token") ? { Authorization: `Bearer ${localStorage.getItem("connecthub_token")}` } : {})
      },
      body: payload ? JSON.stringify(payload) : undefined
    }).then(res => res.json());
  }

  function currentUser() {
    try { return JSON.parse(localStorage.getItem("connecthub_user") || "null"); } catch { return null; }
  }

  function mountRoot(id, html) {
    let node = document.getElementById(id);
    if (!node) {
      node = document.createElement("section");
      node.id = id;
      node.className = "ai-widget";
      const body = document.getElementById("body") || document.querySelector("main") || document.body;
      body.appendChild(node);
    }
    node.innerHTML = html;
    return node;
  }

  async function renderProfileAssistant() {
    const user = currentUser();
    if (!user) return;
    const node = mountRoot("aiProfileAssistant", '<div class="ai-card"><strong>AI Profile Assistant</strong><p>Analyzing profile...</p></div>');
    try {
      const data = await api("/api/ai/enhance-profile", { profile: user });
      node.innerHTML = `<div class="ai-card">
        <div class="ai-card-head"><strong>AI Profile Assistant</strong><span>${data.profileScore || 0}%</span></div>
        <p>${data.bio || "Add a clearer bio to improve matches."}</p>
        <div class="ai-chip-row">${(data.skills || []).slice(0, 6).map(skill => `<span>${skill}</span>`).join("")}</div>
        <ul>${(data.tips || []).map(tip => `<li>${tip}</li>`).join("")}</ul>
      </div>`;
    } catch {
      node.hidden = true;
    }
  }

  async function renderMatchCards() {
    const user = currentUser();
    if (!user) return;
    const role = user.role === "investor" ? "match-startups" : "match-freelancers";
    const node = mountRoot("aiSmartMatches", '<div class="ai-card"><strong>AI Smart Matches</strong><p>Finding relevant matches...</p></div>');
    try {
      const payload = user.role === "investor" ? { investor: user } : { startup: user };
      const data = await api(`/api/ai/${role}`, payload);
      const matches = data.matches || [];
      node.innerHTML = `<div class="ai-card">
        <div class="ai-card-head"><strong>AI Smart Matches</strong><span>${matches.length}</span></div>
        <div class="ai-match-list">${matches.map(match => `<article>
          <b>${match.name || "ConnectHub profile"}</b>
          <span style="background:${teal}">${match.score || 0}% Match</span>
          <small title="${(match.reasons || []).join(" | ")}">Why this match?</small>
        </article>`).join("") || "<p>No AI matches yet.</p>"}</div>
      </div>`;
    } catch {
      node.hidden = true;
    }
  }

  function installChatbot() {
    if (document.getElementById("aiNetworkingAssistant")) return;
    const wrap = document.createElement("div");
    wrap.id = "aiNetworkingAssistant";
    wrap.className = "ai-chatbot";
    wrap.innerHTML = `<button type="button" class="ai-chat-toggle">AI</button>
      <div class="ai-chat-panel" hidden>
        <header><strong>AI Networking Assistant</strong><button type="button">×</button></header>
        <div class="ai-chat-body"><p>Ask about matches, outreach, investors, or what to do next.</p></div>
        <form><input placeholder="Ask ConnectHub AI..."><button>Send</button></form>
      </div>`;
    document.body.appendChild(wrap);
    const panel = wrap.querySelector(".ai-chat-panel");
    wrap.querySelector(".ai-chat-toggle").onclick = () => panel.hidden = !panel.hidden;
    wrap.querySelector("header button").onclick = () => panel.hidden = true;
    wrap.querySelector("form").onsubmit = event => {
      event.preventDefault();
      const input = wrap.querySelector("input");
      const body = wrap.querySelector(".ai-chat-body");
      const text = input.value.trim();
      if (!text) return;
      body.insertAdjacentHTML("beforeend", `<p><b>You:</b> ${text}</p><p><b>AI:</b> I can help draft outreach, explain matches, and suggest next actions based on your role.</p>`);
      input.value = "";
    };
  }

  async function renderAdGenerator() {
    if (!document.body.dataset.currentView?.toLowerCase().includes("ad")) return;
    const node = mountRoot("aiAdGenerator", `<div class="ai-card"><strong>AI Media Ad Generator</strong><button id="aiGenerateAdBtn">AI Generate Ad</button><div id="aiAdResults"></div></div>`);
    node.querySelector("#aiGenerateAdBtn").onclick = async () => {
      const productName = prompt("Product or service name") || "ConnectHub service";
      const targetAudience = prompt("Target audience") || "Indian startups";
      const tone = prompt("Tone: professional / friendly / bold", "professional") || "professional";
      const resultBox = node.querySelector("#aiAdResults");
      resultBox.textContent = "Generating...";
      const data = await api("/api/ai/generate-ad", { productName, targetAudience, tone });
      resultBox.innerHTML = (data.variants || []).map(item => `<article><b>${item.headline}</b><p>${item.body}</p><button>${item.cta}</button></article>`).join("");
    };
  }

  function installLanguageToggle() {
    if (document.getElementById("aiLanguageToggle")) return;
    const nav = document.querySelector(".top-navbar > div:last-child") || document.querySelector(".top-navbar");
    if (!nav) return;
    const button = document.createElement("button");
    button.id = "aiLanguageToggle";
    button.className = "btn btn-secondary";
    button.type = "button";
    button.textContent = localStorage.getItem("connecthub_language") === "hi" ? "हिंदी" : "EN";
    button.onclick = () => {
      const next = localStorage.getItem("connecthub_language") === "hi" ? "en" : "hi";
      localStorage.setItem("connecthub_language", next);
      button.textContent = next === "hi" ? "हिंदी" : "EN";
    };
    nav.prepend(button);
  }

  function boot() {
    installChatbot();
    installLanguageToggle();
    renderProfileAssistant();
    renderMatchCards();
    renderAdGenerator();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
