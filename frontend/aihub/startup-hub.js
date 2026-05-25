(function () {
  async function render(tab, target, state) {
    if (tab === 0) return talentPool(target, state);
    if (tab === 1) return marketIntel(target);
    if (tab === 2) return competitors(target);
    if (tab === 3) return ecosystem(target, state);
    return growth(target);
  }

  async function talentPool(target, state) {
    const response = await fetch("/api/aihub/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "freelancer talent near me", role: "startup", ...state.location }) });
    const data = await response.json();
    target.innerHTML = `<div id="startupTalentMap" class="aihub-map"></div><div class="aihub-list">${(data.results || []).map(row => `<article class="aihub-result-card"><h3>${row.title}</h3><p>${row.description}</p><span class="match-badge">${row.matchPercent}% Match</span></article>`).join("")}</div>`;
    drawMap("startupTalentMap", data.results || [], state.location);
  }

  async function marketIntel(target) {
    const response = await fetch("/api/aihub/market-intel");
    const data = await response.json();
    target.innerHTML = `<article class="aihub-insight-card"><h3>Sector Summary</h3><p>${data.summary}</p></article><div class="aihub-list">${(data.news || []).map(news => `<article class="aihub-result-card"><h3>${news.title}</h3><p>${news.source || ""}</p><a class="aihub-card-btn ghost" href="${news.url || "#"}">Read</a></article>`).join("")}</div>`;
  }

  function competitors(target) {
    target.innerHTML = `<form class="aihub-insight-card" id="competitorForm"><h3>Competitor Radar</h3><input name="description" placeholder="Enter your product/service description" /><button class="aihub-card-btn">Analyze</button></form><div id="competitorResult"></div>`;
    document.getElementById("competitorForm").addEventListener("submit", async event => {
      event.preventDefault();
      const query = Object.fromEntries(new FormData(event.currentTarget).entries());
      const response = await fetch(`/api/aihub/competitor-radar?description=${encodeURIComponent(query.description || "")}`);
      const data = await response.json();
      document.getElementById("competitorResult").innerHTML = `<article class="aihub-insight-card"><h3>AI Analysis</h3><p>${data.analysis}</p></article>`;
    });
  }

  async function ecosystem(target, state) {
    const response = await fetch(`/api/aihub/ecosystem-map?lat=${state.location.lat}&lng=${state.location.lng}`);
    const data = await response.json();
    target.innerHTML = `<div id="ecosystemMap" class="aihub-map"></div><div class="aihub-list">${(data.results || []).slice(0, 5).map(row => `<article class="aihub-result-card"><h3>${row.title}</h3><p>${row.description || ""}</p></article>`).join("")}</div>`;
    drawMap("ecosystemMap", data.results || [], state.location);
  }

  async function growth(target) {
    const response = await fetch("/api/aihub/growth-suggestions");
    const data = await response.json();
    target.innerHTML = `<article class="aihub-insight-card"><h3>Health Score ${data.overall_health_score}/100</h3><p>${data.market_timing || ""}</p></article><div class="aihub-list">${(data.top_3_suggestions || []).map(item => `<article class="aihub-result-card"><h3>${item.title}</h3><p>${item.reason}</p><button class="aihub-card-btn">${item.action}</button></article>`).join("")}</div>`;
  }

  function drawMap(id, rows, center) {
    if (!window.L) return;
    const map = L.map(id).setView([center.lat || 17.385, center.lng || 78.4867], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap" }).addTo(map);
    rows.filter(row => row.lat && row.lng).forEach(row => L.marker([row.lat, row.lng]).addTo(map).bindPopup(`<strong>${row.title}</strong>`));
  }

  window.ConnectHubStartupHub = { render };
})();
