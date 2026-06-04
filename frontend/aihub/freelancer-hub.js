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
    const location = normalizeLocation(state.location);
    const radius = Number(localStorage.getItem("ch_nearby_radius") || 10);
    const activeRole = localStorage.getItem("ch_nearby_role") || "all";
    let data = { results: [] };

    try {
      const response = await fetch(`/api/aihub/nearby-opportunities?lat=${location.lat}&lng=${location.lng}&city=${encodeURIComponent(location.city || "Hyderabad")}&radius_km=${radius}`);
      data = await response.json();
    } catch {
      let fallback = { businesses: [] };
      try {
        fallback = await fetch(`/api/nearby?lat=${location.lat || 17.385}&lng=${location.lng || 78.4867}&city=${encodeURIComponent(location.city || "Hyderabad")}&radius=${radius}`).then(res => res.json());
      } catch {
        fallback = { businesses: localNearbyRows(location) };
      }
      data = { results: fallback.businesses || localNearbyRows(location) };
    }

    const allRows = (data.results && data.results.length ? data.results : localNearbyRows(location)).map(enrichNearbyRow);
    const rows = filterNearbyRows(allRows.filter(row => Number(row.distanceKm || 0) <= radius), activeRole);
    window.ConnectHubNearbyRows = allRows;
    window.ConnectHubNearbyLocation = location;

    target.innerHTML = `
      <div class="nearby-toolbar">
        <div>
          <h3>Nearby Startups & Businesses</h3>
          <p><span id="nearbyCount">${rows.length}</span> useful leads within <strong>${radius} km</strong> of ${escapeHtml(location.city || "your city")}</p>
        </div>
        <label>Radius <input type="range" min="1" max="25" step="1" value="${radius}" oninput="window.ConnectHubFreelancerHub.setRadius(this.value)"><span>${radius} km</span></label>
      </div>
      <div id="freelancerMap" class="aihub-map enhanced-map"></div>
      <div class="nearby-sort">
        ${["all", "startup", "freelancer", "investor"].map(role => `<button class="${role === activeRole ? "active" : ""}" onclick="window.ConnectHubFreelancerHub.setNearbyRole('${role}')">${role === "all" ? "All" : role[0].toUpperCase() + role.slice(1)}s</button>`).join("")}
        <button onclick="window.ConnectHubFreelancerHub.sortNearby('distance')">By distance</button>
        <button onclick="window.ConnectHubFreelancerHub.sortNearby('sector')">By sector</button>
      </div>
      <div class="nearby-scroll-label">Swipe cards to view more nearby profiles</div>
      <div id="nearbyCards" class="nearby-card-row">${rows.map(nearbyCard).join("")}</div>
      <div id="nearbyProfileModal" class="nearby-modal"></div>
      <div id="nearbyContactModal" class="nearby-modal"></div>`;
    drawMap("freelancerMap", rows, location);
  }

  function normalizeLocation(location = {}) {
    if (location && location.source !== "default" && location.lat && location.lng) return location;
    return { lat: 17.385, lng: 78.4867, city: "Hyderabad", region: "Telangana", source: "india-fallback" };
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
    target.innerHTML = `<div class="aihub-list">${(data.items || []).map(item => `<article class="aihub-insight-card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p><button class="aihub-card-btn">Save</button></article>`).join("")}</div>`;
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
      document.getElementById("aiRateResult").innerHTML = `<article class="aihub-insight-card"><h3>Rs ${data.recommendedLow} - Rs ${data.recommendedHigh} / hour</h3><p>${escapeHtml(data.reason)}</p></article>`;
    });
  }

  function nearbyCard(row) {
    return `<article class="nearby-business-card" style="--sector:${sectorColor(row.sector)}">
      <div class="nearby-sector-icon">${escapeHtml((row.sector || "CH").slice(0, 2).toUpperCase())}</div>
      <div>
        <div class="nearby-card-head"><h3>${escapeHtml(row.title)}</h3><b>${escapeHtml(row.roleLabel || "Lead")}</b></div>
        <p><span>${escapeHtml(row.sector || "Startup")}</span> <span>${escapeHtml(row.stage || "Local")}</span></p>
        <strong>${row.distanceKm} km from you</strong>
        <small>${escapeHtml(row.description || "")}</small>
        <div><button onclick="window.ConnectHubFreelancerHub.openProfile('${row.id}')">View Profile</button><button onclick="window.ConnectHubFreelancerHub.openContact('${row.id}')">Contact</button><button title="Save">Save</button></div>
      </div>
    </article>`;
  }

  function enrichNearbyRow(row = {}) {
    const sector = String(row.sector || "");
    const title = String(row.title || row.name || "ConnectHub lead");
    const role = /invest|angel|fund/i.test(sector + title) ? "investor" : /freelance|designer|developer|creator|editor|photo/i.test(sector + title) ? "freelancer" : "startup";
    return {
      ...row,
      id: row.id || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      title,
      role,
      roleLabel: role === "investor" ? "Investor" : role === "freelancer" ? "Freelancer" : "Startup"
    };
  }

  function filterNearbyRows(rows, role) {
    if (role === "all") return rows;
    return rows.filter(row => row.role === role);
  }

  function localNearbyRows(location = {}) {
    const city = String(location.city || "Hyderabad");
    const base = [
      ["T-Hub Startup Desk", "SaaS & Technology", "Startup teams hiring product, design, and marketing support", 1.9],
      ["Urban Growth Studio", "Consumer Services", "Local services platform expanding operations", 0.8],
      ["PayLink India", "Finance & Legal", "Payments startup seeking freelance launch support", 2.1],
      ["HealthFirst Labs", "Health & Wellness", "Health startup building local partner network", 1.7],
      ["SwiftKart Logistics", "Logistics & Mobility", "Mobility and commerce team hiring creators", 3.0],
      ["EduNext Learning", "Education & Training", "EdTech team looking for media and design work", 2.4],
      ["PropBridge Ventures", "Property & Infrastructure", "Property-tech startup onboarding freelancers", 3.5],
      ["Angel Connect Circle", "Investor Network", "Local investors reviewing early startup profiles", 4.1]
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
      marker.bindTooltip(`${escapeHtml(row.title)} - ${row.distanceKm} km`, { direction: "top" });
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
      <textarea>Hi, I found your profile on ConnectHub nearby. I'd love to connect.</textarea>
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
    const activeRole = localStorage.getItem("ch_nearby_role") || "all";
    let rows = filterNearbyRows([...(window.ConnectHubNearbyRows || [])], activeRole);
    if (type === "sector") rows.sort((a, b) => String(a.sector).localeCompare(String(b.sector)));
    else if (type === "stage") rows.sort((a, b) => String(a.stage).localeCompare(String(b.stage)));
    else rows.sort((a, b) => Number(a.distanceKm) - Number(b.distanceKm));
    if (holder) holder.innerHTML = rows.map(nearbyCard).join("");
    const count = document.getElementById("nearbyCount");
    if (count) count.textContent = String(rows.length);
  }

  function setNearbyRole(role) {
    localStorage.setItem("ch_nearby_role", role);
    document.querySelectorAll(".nearby-sort button").forEach(button => {
      const text = button.textContent.toLowerCase();
      button.classList.toggle("active", text.startsWith(role === "all" ? "all" : role));
    });
    sortNearby("distance");
  }

  function useManualCity() {
    const city = document.getElementById("manualNearbyCity")?.value || "Hyderabad";
    window.location.search = `?role=freelancer&city=${encodeURIComponent(city)}`;
  }

  window.ConnectHubFreelancerHub = { render, openProfile, openContact, closeModals, sendContact, setRadius, sortNearby, setNearbyRole, useManualCity };
})();
