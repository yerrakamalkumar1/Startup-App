async function loadRequests() {
  const container = document.getElementById('requestsList');
  try {
    const res = await fetch('/api/connections/requests');
    const data = await res.json();
    if (!data.success || !data.requests.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🤝</div>
          <h3>No pending requests</h3>
          <p>When someone wants to connect with you, it'll show up here.</p>
        </div>`;
      return;
    }
    container.innerHTML = data.requests.map(r => {
      const requester = r.requester || {};
      const safeName = (requester.name || r.from || 'U').replace(/'/g, "\\'");
      const initial = (requester.name || 'U').charAt(0).toUpperCase();
      const profilePath = "/profile/" + encodeURIComponent(requester._id || r.from);
      return `
      <div class="request-card" id="req_${r._id}">
        <a href="${profilePath}" class="request-info">
          ${requester.profilePhoto
            ? `<img src="${requester.profilePhoto}" class="request-avatar" />`
            : `<div class="avatar-circle">${initial}</div>`
          }
          <div>
            <strong>${escHtml(requester.name || r.from)}</strong>
            <p>${escHtml(requester.headline || requester.role || 'Wants to connect')}</p>
          </div>
        </a>
        <div class="request-actions">
          <button class="btn-accept" onclick="acceptRequest('${r._id}')">Accept</button>
          <button class="btn-reject" onclick="rejectRequest('${r._id}')">Ignore</button>
        </div>
      </div>`;
    }).join('');
  } catch {
    container.innerHTML = '<div class="empty-state"><p>Failed to load requests. Make sure you are signed in.</p></div>';
  }
}

async function acceptRequest(connectionId) {
  const card = document.getElementById('req_' + connectionId);
  if (!card) return;
  card.style.opacity = '0.5';
  try {
    const res = await fetch(`/api/connections/accept/${connectionId}`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      card.style.animation = 'fadeOutSlide 0.3s ease forwards';
      setTimeout(() => { card.remove(); checkEmptyState(); }, 300);
      if (window.ConnectHub && ConnectHub.showToast) ConnectHub.showToast({ type: 'success', message: 'Connection accepted!' });
    }
  } catch {
    card.style.opacity = '1';
  }
}

async function rejectRequest(connectionId) {
  const card = document.getElementById('req_' + connectionId);
  if (!card) return;
  card.style.opacity = '0.5';
  try {
    await fetch(`/api/connections/reject/${connectionId}`, { method: 'POST' });
    card.style.animation = 'fadeOutSlide 0.3s ease forwards';
    setTimeout(() => { card.remove(); checkEmptyState(); }, 300);
  } catch {
    card.style.opacity = '1';
  }
}

function checkEmptyState() {
  const container = document.getElementById('requestsList');
  if (!container || container.children.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🤝</div>
        <h3>No pending requests</h3>
        <p>When someone wants to connect with you, it'll show up here.</p>
      </div>`;
  }
}

loadRequests();
