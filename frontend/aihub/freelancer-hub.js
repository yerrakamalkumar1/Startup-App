(function () {
  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  async function render(tab, target, state) {
    if (tab === 0) return nearby(target, state);
    if (tab === 1) return skillDemand(target);
    if (tab === 2) return suggestions(target);
    if (tab === 3) return localRadar(target);
    return rateEstimator(target);
  }

  async function nearby(target, state) {
    if (!state.location || state.location.source === "default") {
      target.innerHTML = `
        <section class="nearby-access-card">
          <div class="nearby-pin">📍</div>
          <h2>Discover What's Around You</h2>
          <p>Find startups, freelancers, investors, and businesses near your current location.</p>
          <button class="aihub-card-btn" onclick="document.getElementById('aihubEnableLocation')?.click()">Allow Location Access</button>
          <div class="manual-city"><input id="manualNearbyCity" placeholder="Or enter your city"><button onclick="window.ConnectHubFreelancerHub.useManualCity()">Search city</button></div>
        </section>`;
      return;
    }
    const radius = Number(localStorage.getItem("ch_nearby_radius") || 10);
    let data = { results: [] };
    try {
      const response = await fetch(`/api/aihub/nearby-opportunities?lat=${state.location.lat}&lng=${state.location.lng}&city=${encodeURIComponent(state.location.city || "Hyderabad")}&radius_km=${radius}`);
      data = await response.json();
    } catch (error) {
      let fallback = { businesses: [] };
      try {
        fallback = await fetch(`/api/nearby?lat=${state.location.lat || 17.385}&lng=${state.location.lng || 78.4867}&city=${encodeURIComponent(state.location.city || "Hyderabad")}&radius=${radius}`).then(res => res.json());
      } catch {
        fallback = { businesses: localNearbyRows(state.location) };
      }
      data = { results: fallback.businesses || localNearbyRows(state.location) };
    }
    const rows = (data.results || []).filter(row => Number(row.distanceKm || 0) <= radius);
    window.ConnectHubNearbyRows = data.results || [];
    window.ConnectHubNearbyLocation = state.location;
    target.innerHTML = `
      <div class="nearby-toolbar">
        <div><h3>Nearby Startups & Businesses</h3><p>Showing <strong>${rows.length}</strong> businesses within <strong>${radius} km</strong></p></div>
        <label>Radius <input type="range" min="1" max="25" step="1" value="${radius}" oninput="window.ConnectHubFreelancerHub.setRadius(this.value)"><span>${radius} km</span></label>
      </div>
      <div id="freelancerMap" class="aihub-map enhanced-map"></div>
      <div class="nearby-sort"><button onclick="window.ConnectHubFreelancerHub.sortNearby('distance')">By distance</button><button onclick="window.ConnectHubFreelancerHub.sortNearby('sector')">By sector</button><button onclick="window.ConnectHubFreelancerHub.sortNearby('stage')">By stage</button></div>
      <div id="nearbyCards" class="nearby-card-row">${rows.map(nearbyCard).join("")}</div>
      <div id="nearbyProfileModal" class="nearby-modal"></div>
      <div id="nearbyContactModal" class="nearby-modal"></div>`;
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

  function nearbyCard(row) {
    return `<article class="nearby-business-card" style="--sector:${sectorColor(row.sector)}">
      <div class="nearby-sector-icon">${(row.sector || "CH").slice(0, 2).toUpperCase()}</div>
      <div>
        <h3>${escapeHtml(row.title)}</h3>
        <p><span>${escapeHtml(row.sector || "Startup")}</span> <span>${escapeHtml(row.stage || "Local")}</span></p>
        <strong>${row.distanceKm} km from you</strong>
        <small>${escapeHtml(row.description || "")}</small>
        <div><button onclick="window.ConnectHubFreelancerHub.openProfile('${row.id}')">View Profile</button><button onclick="window.ConnectHubFreelancerHub.openContact('${row.id}')">Contact</button><button title="Save">🔖</button></div>
      </div>
    </article>`;
  }

  function localNearbyRows(location = {}) {
    const city = String(location.city || "Hyderabad");
    const base = [
      ["Zomato Partner Kitchen", "FoodTech", "Cloud kitchen, hiring delivery ops", 0.8],
      ["UrbanCompany Hyderabad", "Consumer Services", "Home services platform, expanding", 0.5],
      ["T-Hub Startup", "SaaS", "Gov-backed startup hub, 300+ startups", 1.9],
      ["PayU India", "FinTech", "Fintech payments, Series B", 2.1],
      ["HealthKart Hub", "HealthTech", "Health supplements, hiring marketing", 1.7],
      ["Swiggy Dark Store", "Logistics", "Quick commerce hub, hiring", 3.0],
      ["GITAM Innovation Center", "EdTech", "EdTech incubator, looking for mentors", 2.4],
      ["Dhruva Space", "Manufacturing", "Space tech startup, Seed stage", 3.5]
    ];
    const lat = Number(location.lat || 17.385);
    const lng = Number(location.lng || 78.4867);
    return base.map((row, index) => ({
      id: row[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      title: city === "Hyderabad" ? row[0] : `${city} ${row[1]} Hub`,
      name: city === "Hyderabad" ? row[0] : `${city} ${row[1]} Hub`,
      sector: row[1],
      stage: index % 3 === 0 ? "Growth" : index % 3 === 1 ? "Seed" : "Hiring",
      description: row[2],
      city,
      distanceKm: row[3],
      lat: lat + (index + 1) * 0.0025,
      lng: lng + (index % 2 ? -1 : 1) * (index + 1) * 0.002,
      matchPercent: Math.max(78, 96 - index * 3)
    }));
  }

  function drawMap(id, rows, center) {
    if (!window.L) return;
    const map = L.map(id).setView([center.lat || 17.385, center.lng || 78.4867], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap" }).addTo(map);
    L.circleMarker([center.lat || 17.385, center.lng || 78.4867], { radius: 9, color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.75 }).addTo(map).bindPopup("You are here");
    rows.filter(row => row.lat && row.lng).forEach(row => {
      const marker = L.marker([row.lat, row.lng], { icon: pinIcon(row.sector) }).addTo(map);
      marker.bindTooltip(`${row.title} - ${row.distanceKm} km`, { direction: "top" });
      marker.bindPopup(`<div class="map-popup"><strong>${escapeHtml(row.title)}</strong><span>${escapeHtml(row.sector || "")}</span><p>${row.distanceKm} km away</p><p>${escapeHtml(row.description || "")}</p><button onclick="window.ConnectHubFreelancerHub.openProfile('${row.id}')">View Profile</button><button onclick="window.ConnectHubFreelancerHub.openContact('${row.id}')">Contact</button></div>`);
    });
  }

  function pinIcon(sector) {
    const color = sectorColor(sector);
    return L.divIcon({ className: "sector-pin", html: `<svg width="34" height="42" viewBox="0 0 34 42"><path fill="${color}" d="M17 0C7.6 0 0 7.6 0 17c0 12.8 17 25 17 25s17-12.2 17-25C34 7.6 26.4 0 17 0z"/><circle cx="17" cy="17" r="7" fill="white"/></svg>`, iconSize: [34, 42], iconAnchor: [17, 42], popupAnchor: [0, -38] });
  }

  function sectorColor(sector = "") {
    if (/saas|tech/i.test(sector)) return "#0f766e";
    if (/fin/i.test(sector)) return "#f59e0b";
    if (/ed/i.test(sector)) return "#7c3aed";
    if (/food/i.test(sector)) return "#f97316";
    if (/health/i.test(sector)) return "#ef4444";
    if (/log/i.test(sector)) return "#3b82f6";
    if (/consumer/i.test(sector)) return "#ec4899";
    if (/property/i.test(sector)) return "#10b981";
    if (/investor/i.test(sector)) return "#eab308";
    return "#6b7280";
  }

  function rowById(id) {
    return (window.ConnectHubNearbyRows || []).find(row => row.id === id);
  }

  function openProfile(id) {
    const row = rowById(id);
    const modal = document.getElementById("nearbyProfileModal");
    if (!row || !modal) return;
    modal.innerHTML = `<button class="nearby-modal-scrim" onclick="window.ConnectHubFreelancerHub.closeModals()"></button><article class="nearby-modal-card">
      <button class="nearby-close" onclick="window.ConnectHubFreelancerHub.closeModals()">x</button>
      <div class="nearby-cover" style="--sector:${sectorColor(row.sector)}"><span>${escapeHtml((row.name || row.title).slice(0, 2).toUpperCase())}</span></div>
      <h2>${escapeHtml(row.title)}</h2><p>${escapeHtml(row.sector)} - ${escapeHtml(row.city)} - ${escapeHtml(row.stage || "Local")}</p>
      <div class="nearby-profile-stats"><span>Funding: Rs 80L</span><span>Team: 18</span><span>${row.distanceKm} km away</span></div>
      <p>${escapeHtml(row.description)} ConnectHub detected this as a useful nearby professional networking lead.</p>
      <h3>Open roles</h3><p>Growth, operations, design, engineering, partnerships.</p>
      <div class="nearby-modal-actions"><button onclick="window.ConnectHubFreelancerHub.openContact('${row.id}')">Send Message</button><button>Share</button><button>Save</button></div>
    </article>`;
    modal.classList.add("active");
  }

  function openContact(id) {
    const row = rowById(id);
    const modal = document.getElementById("nearbyContactModal");
    if (!row || !modal) return;
    modal.innerHTML = `<button class="nearby-modal-scrim" onclick="window.ConnectHubFreelancerHub.closeModals()"></button><article class="nearby-modal-card contact">
      <button class="nearby-close" onclick="window.ConnectHubFreelancerHub.closeModals()">x</button>
      <h2>Contact ${escapeHtml(row.title)}</h2>
      <textarea>Hi, I found your company on ConnectHub nearby. I'd love to connect!</textarea>
      <div class="nearby-modal-actions"><button onclick="window.ConnectHubFreelancerHub.sendContact()">Send Message</button><button onclick="window.ConnectHubFreelancerHub.closeModals()">Cancel</button><a href="https://wa.me/916301394850" target="_blank">WhatsApp</a></div>
    </article>`;
    modal.classList.add("active");
  }

  function closeModals() {
    document.querySelectorAll(".nearby-modal").forEach(modal => modal.classList.remove("active"));
  }

  function sendContact() {
    closeModals();
    alert("Message saved in ConnectHub demo inbox.");
  }

  function setRadius(value) {
    localStorage.setItem("ch_nearby_radius", value);
    document.getElementById("aihubRefresh")?.click();
  }

  function sortNearby(type) {
    const holder = document.getElementById("nearbyCards");
    let rows = [...(window.ConnectHubNearbyRows || [])];
    if (type === "sector") rows.sort((a, b) => String(a.sector).localeCompare(String(b.sector)));
    else if (type === "stage") rows.sort((a, b) => String(a.stage).localeCompare(String(b.stage)));
    else rows.sort((a, b) => Number(a.distanceKm) - Number(b.distanceKm));
    if (holder) holder.innerHTML = rows.map(nearbyCard).join("");
  }

  function useManualCity() {
    const city = document.getElementById("manualNearbyCity")?.value || "Hyderabad";
    window.location.search = `?role=freelancer&city=${encodeURIComponent(city)}`;
  }

  window.ConnectHubFreelancerHub = { render, openProfile, openContact, closeModals, sendContact, setRadius, sortNearby, useManualCity };
})();
