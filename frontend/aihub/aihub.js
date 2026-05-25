(function () {
  const state = {
    role: detectRole(),
    location: { lat: 17.385, lng: 78.4867, city: "Hyderabad", source: "default" },
    activeTab: 0,
    filters: "All",
    socket: null
  };

  const roleModules = {
    freelancer: window.ConnectHubFreelancerHub,
    startup: window.ConnectHubStartupHub,
    investor: window.ConnectHubInvestorHub
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    document.querySelector(".aihub-shell").dataset.role = state.role;
    document.getElementById("aihubRolePill").textContent = labelRole(state.role);
    setupFilters();
    setupTabs();
    setupLocationFlow();
    setupSearch();
    setupSocket();
    window.ConnectHubAIChatbot?.init({ role: state.role, getLocation: () => state.location });
    window.ConnectHubAINotifications?.init();
    renderActiveTab();
  }

  function detectRole() {
    const stored = JSON.parse(localStorage.getItem("connecthub_profile") || localStorage.getItem("ch_user") || "{}");
    const raw = new URLSearchParams(location.search).get("role") || stored.role || "";
    if (/startup/i.test(raw)) return "startup";
    if (/investor|sponsor/i.test(raw)) return "investor";
    return "freelancer";
  }

  function labelRole(role) {
    return role === "startup" ? "Startup Owner" : role === "investor" ? "Investor/Sponsor" : "Freelancer";
  }

  function setupLocationFlow() {
    const consent = localStorage.getItem("ch_location_consent");
    const modal = document.getElementById("aihubLocationModal");
    if (consent === "true") {
      requestGps();
    } else if (consent === "false") {
      useIpFallback();
    } else {
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
    }
    document.getElementById("aihubEnableLocation").addEventListener("click", () => {
      localStorage.setItem("ch_location_consent", "true");
      closeLocationModal();
      requestGps();
    });
    document.getElementById("aihubSkipLocation").addEventListener("click", () => {
      localStorage.setItem("ch_location_consent", "false");
      closeLocationModal();
      useIpFallback();
    });
  }

  function closeLocationModal() {
    const modal = document.getElementById("aihubLocationModal");
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  function requestGps() {
    if (!navigator.geolocation) return useIpFallback();
    navigator.geolocation.getCurrentPosition(
      position => saveLocation({ lat: position.coords.latitude, lng: position.coords.longitude, source: "gps" }),
      useIpFallback,
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function useIpFallback() {
    await saveLocation({ source: "ip" });
  }

  async function saveLocation(payload) {
    try {
      const response = await fetch("/api/aihub/locate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, role: state.role })
      });
      const data = await response.json();
      state.location = data.location || state.location;
      document.getElementById("aihubLocationBadge").textContent = data.badge || "Using city-level location";
    } catch {
      document.getElementById("aihubLocationBadge").textContent = "Using approximate location. Enable GPS for better results.";
    }
    renderActiveTab();
  }

  function setupFilters() {
    const byRole = {
      freelancer: ["All", "Nearby < 5km", "Remote", "Hot This Week", "New Today", "High Pay"],
      startup: ["Find Freelancers", "Market Research", "Competitor Intel", "Funding News", "Nearby Talent"],
      investor: ["All", "Seed Stage", "Series A", "Near Me", "Hot Sector", "Low Risk", "High Growth"]
    };
    const row = document.getElementById("aihubQuickFilters");
    row.innerHTML = "";
    byRole[state.role].forEach((label, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.className = index === 0 ? "active" : "";
      button.addEventListener("click", () => {
        state.filters = label;
        row.querySelectorAll("button").forEach(item => item.classList.remove("active"));
        button.classList.add("active");
      });
      row.appendChild(button);
    });
  }

  function setupTabs() {
    const tabsByRole = {
      freelancer: ["Nearby Opportunities", "Skill Demand", "AI Suggestions", "Local Radar", "AI Rate"],
      startup: ["Talent Pool", "Market Intel", "Competitors", "Ecosystem", "Growth AI"],
      investor: ["Deal Flow", "Sector Intel", "Deal News", "Portfolio Risk", "Geo Map"]
    };
    const tabs = document.getElementById("aihubTabs");
    tabs.innerHTML = "";
    tabsByRole[state.role].forEach((label, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.className = index === 0 ? "active" : "";
      button.addEventListener("click", () => {
        state.activeTab = index;
        tabs.querySelectorAll("button").forEach(item => item.classList.remove("active"));
        button.classList.add("active");
        renderActiveTab();
      });
      tabs.appendChild(button);
    });
    document.getElementById("aihubRefresh").addEventListener("click", renderActiveTab);
  }

  function setupSearch() {
    document.getElementById("aihubSearchForm").addEventListener("submit", async event => {
      event.preventDefault();
      const query = document.getElementById("aihubSearchInput").value.trim();
      if (!query) return;
      const results = document.getElementById("aihubSearchResults");
      results.innerHTML = "<div class='skeleton'></div><div class='skeleton'></div>";
      try {
        const response = await fetch("/api/aihub/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, role: state.role, filters: { quick: state.filters }, ...state.location })
        });
        const data = await response.json();
        document.getElementById("aihubIntent").textContent = data.intent || "Semantic";
        document.getElementById("aihubSearchSummary").textContent = data.summary || "";
        renderResults(data.results || []);
      } catch {
        results.innerHTML = "<div class='aihub-empty'>AI data temporarily unavailable. Retry -></div>";
      }
    });
  }

  function renderResults(rows) {
    const target = document.getElementById("aihubSearchResults");
    if (!rows.length) {
      target.innerHTML = "<div class='aihub-empty'>No AI results found. Try a skill, sector, city, or company name.</div>";
      return;
    }
    target.innerHTML = rows.map((row, index) => `
      <article class="aihub-result-card fade-in" style="animation-delay:${index * 60}ms">
        <div class="aihub-result-top">
          <span class="source-badge">${escapeHtml(row.source || "ConnectHub")}</span>
          <span class="match-badge">${Number(row.matchPercent || 70)}% Match</span>
        </div>
        <h3>${escapeHtml(row.title || "AI result")}</h3>
        <p>${escapeHtml(row.description || "")}</p>
        <p class="muted">${row.distanceKm ? `${row.distanceKm} km away · ` : ""}${escapeHtml(row.city || row.location || "")}</p>
        <button class="aihub-card-btn" type="button" data-why="${escapeHtml(row.why || "This matched your role, skills, sector, and location.")}">Why this?</button>
        <a class="aihub-card-btn ghost" href="${escapeAttr(row.url || "#")}">Open</a>
      </article>
    `).join("");
    target.querySelectorAll("[data-why]").forEach(button => {
      button.addEventListener("click", () => alert(button.dataset.why));
    });
  }

  async function renderActiveTab() {
    const module = roleModules[state.role];
    const content = document.getElementById("aihubTabContent");
    if (!module) return;
    content.classList.remove("fade-in");
    content.innerHTML = "<div class='skeleton'></div><div class='skeleton'></div>";
    await new Promise(resolve => setTimeout(resolve, 80));
    await module.render(state.activeTab, content, { ...state });
    content.classList.add("fade-in");
  }

  function setupSocket() {
    const connect = () => {
      if (!window.io || state.socket) return;
      state.socket = window.io();
      state.socket.emit("aihub:join", { role: state.role, city: state.location.city });
      state.socket.on("live_feed_update", data => window.ConnectHubAINotifications?.push(data.insight?.title || "New AI Hub update"));
      state.socket.on("live_market_update", data => window.ConnectHubAINotifications?.push(data.insight?.title || "New market update"));
      state.socket.on("live_deal_update", data => window.ConnectHubAINotifications?.push(data.insight?.title || "New deal update"));
      state.socket.on("notification:new", item => window.ConnectHubAINotifications?.push(item.text || "New notification"));
    };
    if (window.io) return connect();
    if (document.querySelector("script[data-connecthub-socket-client]")) return;
    const script = document.createElement("script");
    script.dataset.connecthubSocketClient = "true";
    script.src = "https://cdn.socket.io/4.7.5/socket.io.min.js";
    script.crossOrigin = "anonymous";
    script.onload = connect;
    script.onerror = () => {};
    document.head.appendChild(script);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, "&quot;");
  }

  window.ConnectHubAIHub = { state, renderActiveTab };
})();
