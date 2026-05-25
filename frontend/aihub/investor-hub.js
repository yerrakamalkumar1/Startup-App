(function () {
  async function render(tab, target, state) {
    if (tab === 0) return dealFlow(target, state);
    if (tab === 1) return sectorIntel(target);
    if (tab === 2) return dealNews(target);
    if (tab === 3) return portfolioRisk(target);
    return geoMap(target);
  }

  async function dealFlow(target, state) {
    const response = await fetch("/api/aihub/deal-flow");
    const data = await response.json();
    target.innerHTML = `<div id="dealFlowMap" class="aihub-map"></div><div class="aihub-list">${(data.results || []).map(row => `<article class="aihub-result-card"><h3>${row.title}</h3><p>${row.description}</p><span class="match-badge">${row.matchPercent}% Attractive</span></article>`).join("")}</div>`;
    drawMap("dealFlowMap", data.results || [], state.location);
  }

  async function sectorIntel(target) {
    const sectors = ["SaaS", "Commerce", "Health", "Finance", "Education", "Logistics"];
    target.innerHTML = `<div class="chart-box"><canvas id="sectorMatrix"></canvas></div><div class="aihub-insight-card"><h3>Sector Intelligence</h3><p>Clicking deep sector drilldowns can be connected to the same AI endpoint as your investor dataset grows.</p></div>`;
    new Chart(document.getElementById("sectorMatrix"), {
      type: "bar",
      data: { labels: sectors, datasets: [{ label: "Opportunity", data: [88, 72, 78, 66, 61, 69], backgroundColor: "#0f766e" }, { label: "Risk", data: [35, 48, 42, 51, 46, 50], backgroundColor: "#f59e0b" }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  async function dealNews(target) {
    const response = await fetch("/api/aihub/deal-news");
    const data = await response.json();
    target.innerHTML = `<div class="aihub-list">${(data.news || []).map(news => `<article class="aihub-result-card"><h3>${news.title}</h3><p>${news.source || ""}</p><button class="aihub-card-btn">Save Deal</button></article>`).join("")}</div>`;
  }

  function portfolioRisk(target) {
    target.innerHTML = `<form class="aihub-insight-card" id="portfolioForm"><h3>Portfolio Risk Analyzer</h3><textarea name="startups" placeholder="Enter startup sectors, one per line"></textarea><button class="aihub-card-btn">Analyze</button></form><div id="portfolioResult"></div>`;
    document.getElementById("portfolioForm").addEventListener("submit", async event => {
      event.preventDefault();
      const sectors = new FormData(event.currentTarget).get("startups").split("\n").filter(Boolean).map(sector => ({ sector }));
      const response = await fetch("/api/aihub/portfolio-risk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startups: sectors }) });
      const data = await response.json();
      document.getElementById("portfolioResult").innerHTML = `<article class="aihub-insight-card"><h3>Risk ${data.overallRiskScore}/100</h3><p>${data.recommendation}</p></article>`;
    });
  }

  async function geoMap(target) {
    const response = await fetch("/api/aihub/geo-investment-map");
    const data = await response.json();
    target.innerHTML = `<div id="indiaMap" class="aihub-map"></div><div class="aihub-list">${(data.states || []).map(row => `<article class="aihub-result-card"><h3>${row.state}</h3><p>Startup density ${row.startupDensity}/100 · Investor activity ${row.investorActivity}/100</p></article>`).join("")}</div>`;
    drawMap("indiaMap", [], { lat: 22.9734, lng: 78.6569 });
  }

  function drawMap(id, rows, center) {
    if (!window.L) return;
    const map = L.map(id).setView([center.lat || 22.9734, center.lng || 78.6569], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap" }).addTo(map);
    rows.filter(row => row.lat && row.lng).forEach(row => L.marker([row.lat, row.lng]).addTo(map).bindPopup(`<strong>${row.title}</strong>`));
  }

  window.ConnectHubInvestorHub = { render };
})();
