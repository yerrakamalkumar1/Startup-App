(function () {
  async function render(tab, target, state) {
    if (tab === 0) return nearby(target, state);
    if (tab === 1) return skillDemand(target);
    if (tab === 2) return suggestions(target);
    if (tab === 3) return localRadar(target);
    return rateEstimator(target);
  }

  async function nearby(target, state) {
    const response = await fetch(`/api/aihub/nearby-opportunities?lat=${state.location.lat}&lng=${state.location.lng}&city=${encodeURIComponent(state.location.city || "Hyderabad")}`);
    const data = await response.json();
    const rows = data.results || [];
    target.innerHTML = `<div id="freelancerMap" class="aihub-map"></div><div class="aihub-list">${rows.slice(0, 5).map(card).join("")}</div>`;
    drawMap("freelancerMap", rows, state.location);
  }

  async function skillDemand(target) {
    const response = await fetch("/api/aihub/skill-demand");
    const data = await response.json();
    target.innerHTML = `<div class="chart-box"><canvas id="skillDemandChart"></canvas></div><div class="aihub-insight-card"><h3>Your skills vs demand</h3><p>Keep your top skills updated. ConnectHub ranks complete profiles higher in AI matching.</p></div>`;
    const ctx = document.getElementById("skillDemandChart");
    new Chart(ctx, {
      type: "bar",
      data: { labels: (data.skills || []).map(row => row.skill), datasets: [{ label: "Demand", data: (data.skills || []).map(row => row.score), backgroundColor: "#0f766e" }] },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
  }

  async function suggestions(target) {
    const response = await fetch("/api/aihub/feed");
    const data = await response.json();
    target.innerHTML = `<div class="aihub-list">${(data.items || []).map(item => `<article class="aihub-insight-card"><h3>${item.title}</h3><p>${item.body}</p><button class="aihub-card-btn">Save</button></article>`).join("")}</div>`;
  }

  function localRadar(target) {
    target.innerHTML = `<div class="chart-box"><canvas id="localRadarChart"></canvas></div><div class="aihub-insight-card"><h3>Your Local Market Score: 74/100</h3><p>Opportunities are high, but competition is also rising. Focus on niche skills and visible proof of work.</p></div>`;
    new Chart(document.getElementById("localRadarChart"), {
      type: "radar",
      data: { labels: ["Opportunities", "Pay Rate", "Competition", "Growth", "Stability"], datasets: [{ label: "Local market", data: [82, 68, 71, 76, 73], borderColor: "#0f766e", backgroundColor: "rgba(15,118,110,.18)" }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  function rateEstimator(target) {
    target.innerHTML = `
      <form class="aihub-insight-card" id="aiRateForm">
        <h3>AI Rate Estimator</h3>
        <input name="skill" placeholder="Skill, e.g. video editing" />
        <input name="experience" type="number" min="0" step="1" placeholder="Experience years" />
        <input name="city" placeholder="City" />
        <button class="aihub-card-btn" type="submit">Estimate Rate</button>
      </form>
      <div id="aiRateResult"></div>`;
    document.getElementById("aiRateForm").addEventListener("submit", async event => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
      const response = await fetch("/api/aihub/rate-estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      document.getElementById("aiRateResult").innerHTML = `<article class="aihub-insight-card"><h3>Rs ${data.recommendedLow} - Rs ${data.recommendedHigh} / hour</h3><p>${data.reason}</p></article>`;
    });
  }

  function card(row) {
    return `<article class="aihub-result-card"><div class="aihub-result-top"><span class="source-badge">${row.source || "ConnectHub"}</span><span class="match-badge">${row.matchPercent || 70}%</span></div><h3>${row.title}</h3><p>${row.description || ""}</p><p class="muted">${row.distanceKm ? `${row.distanceKm} km away` : ""}</p></article>`;
  }

  function drawMap(id, rows, center) {
    if (!window.L) return;
    const map = L.map(id).setView([center.lat || 17.385, center.lng || 78.4867], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap" }).addTo(map);
    rows.filter(row => row.lat && row.lng).forEach(row => L.marker([row.lat, row.lng]).addTo(map).bindPopup(`<strong>${row.title}</strong><br>${row.distanceKm || ""} km away`));
  }

  window.ConnectHubFreelancerHub = { render };
})();
