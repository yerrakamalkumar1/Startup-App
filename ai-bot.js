// ConnectHub floating support assistant

(function() {
  document.addEventListener("DOMContentLoaded", () => {
    injectChatWidget();
    setupChatLogic();
  });

  function injectChatWidget() {
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "ai-bot-toggle";
    toggleBtn.id = "aiBotToggle";
    toggleBtn.setAttribute("aria-label", "Open ConnectHub assistant");
    toggleBtn.title = "ConnectHub Assistant";
    toggleBtn.innerHTML = '<i data-lucide="sparkles"></i>';

    const container = document.createElement("div");
    container.className = "ai-bot-container";
    container.id = "aiBotContainer";
    container.innerHTML = `
      <div class="ai-bot-header">
        <h3><i data-lucide="messages-square"></i> ConnectHub Assistant</h3>
        <button class="close-btn" id="aiBotClose" aria-label="Close assistant" style="color:white;">&times;</button>
      </div>
      <div class="ai-bot-messages" id="aiBotMessages">
        <div class="ai-msg bot">
          Hi, I can guide you through registrations, startup hiring, freelancer ads, media posts, investor discovery, and static publishing.
          <br><br><strong>Tip:</strong> ask "how to publish", "why is my ad not visible", or "best ad format".
        </div>
      </div>
      <div class="ai-bot-suggestions">
        <button class="ai-suggest-btn" data-query="How do I post a photo or reel ad?">Media ad</button>
        <button class="ai-suggest-btn" data-query="Why is my freelancer ad not visible to startups?">Visibility</button>
        <button class="ai-suggest-btn" data-query="How do I publish this app live?">Publish</button>
        <button class="ai-suggest-btn" data-query="Best workflow for startup hiring">Hiring</button>
      </div>
      <div class="ai-bot-input-area">
        <input type="text" id="aiBotInput" placeholder="Ask about setup, ads, hiring, publishing...">
        <button class="ai-bot-send-btn" id="aiBotSend" aria-label="Send"><i data-lucide="send"></i></button>
      </div>
    `;

    document.body.appendChild(toggleBtn);
    document.body.appendChild(container);
    if (window.lucide) window.lucide.createIcons();
  }

  function setupChatLogic() {
    const toggleBtn = document.getElementById("aiBotToggle");
    const container = document.getElementById("aiBotContainer");
    const closeBtn = document.getElementById("aiBotClose");
    const sendBtn = document.getElementById("aiBotSend");
    const inputField = document.getElementById("aiBotInput");
    const messagesBox = document.getElementById("aiBotMessages");

    toggleBtn.addEventListener("click", () => {
      container.classList.add("active");
      toggleBtn.style.display = "none";
      inputField.focus();
    });

    closeBtn.addEventListener("click", () => {
      container.classList.remove("active");
      toggleBtn.style.display = "flex";
    });

    sendBtn.addEventListener("click", handleUserMessage);
    inputField.addEventListener("keypress", event => {
      if (event.key === "Enter") handleUserMessage();
    });

    document.querySelectorAll(".ai-suggest-btn").forEach(btn => {
      btn.addEventListener("click", () => submitMessage(btn.dataset.query));
    });

    function handleUserMessage() {
      const text = inputField.value.trim();
      if (!text) return;
      inputField.value = "";
      submitMessage(text);
    }

    function submitMessage(text) {
      appendMessage(text, "user");
      setTimeout(() => appendMessage(generateAIResponse(text), "bot"), 350);
    }

    function appendMessage(text, sender) {
      const bubble = document.createElement("div");
      bubble.className = `ai-msg ${sender}`;
      bubble.innerHTML = text;
      messagesBox.appendChild(bubble);
      messagesBox.scrollTop = messagesBox.scrollHeight;
    }
  }

  function generateAIResponse(query) {
    const q = query.toLowerCase();
    const stats = window.getPlatformStats ? getPlatformStats() : null;
    const statLine = stats ? `<br><br><strong>Current network:</strong> ${stats.startups} startups, ${stats.freelancers} freelancers, ${stats.livePosts} live posts.` : "";

    if (hasAny(q, ["photo", "reel", "video", "media", "image", "upload", "advertisement", "ad format"])) {
      return "<strong>Posting a media ad:</strong><br>1. Open your dashboard.<br>2. Startups: click <strong>Post Media</strong>. Freelancers: open <strong>Service Ads</strong> and click <strong>New Ad</strong>.<br>3. Add a short title, clear caption, tags, and upload a small image/video under 2.5 MB.<br>4. Publish. The post is saved locally and rendered in the relevant marketplace/feed." + statLine;
    }

    if (hasAny(q, ["visible", "not visible", "chain", "sync", "marketplace", "reach startups"])) {
      return "<strong>Visibility checklist:</strong><br>Freelancer service ads appear in the Startup dashboard under <strong>Browse Freelancers</strong>. If you cannot see one: confirm you published from the freelancer account, keep the same browser/localStorage, avoid private mode, and refresh the startup dashboard. Startup media posts appear in the startup dashboard and freelancer media feed.";
    }

    if (hasAny(q, ["publish", "live", "deploy", "hosting", "domain", "netlify", "vercel", "github"])) {
      return "<strong>Publishing this app:</strong><br>This is a static app, so you can deploy the folder directly. Upload <strong>index.html</strong>, dashboards, <strong>index.css</strong>, <strong>db.js</strong>, <strong>ai-bot.js</strong>, and the <strong>assets</strong> folder to Netlify, Vercel, GitHub Pages, or any static host.<br><br><strong>Important:</strong> current data is browser-local. For real public users, connect Firebase/Supabase or your backend so registrations and posts sync across devices.";
    }

    if (hasAny(q, ["hire", "startup", "candidate", "workflow", "best workflow"])) {
      return "<strong>Startup hiring workflow:</strong><br>1. Complete Business Profile.<br>2. Browse freelancer ads for immediate service packages.<br>3. Use <strong>Post Gig</strong> for custom work that needs applications.<br>4. Add a photo/reel if the work needs visual context.<br>5. Review candidates and mark Hire/Decline in <strong>Candidates</strong>.";
    }

    if (hasAny(q, ["apply", "bid", "gig", "rate", "freelancer"])) {
      return "<strong>Freelancer workflow:</strong><br>Apply to gigs when startups define specific work. Publish service ads when you want startups to discover you first. Add a visual sample, simple package price, 3-5 searchable tags, and a clear delivery promise.";
    }

    if (hasAny(q, ["register", "registration", "stats", "count", "numbers"])) {
      return "<strong>Registrations and stats:</strong><br>Landing stats now come from local registered users plus demo users and live posts. Registering as a startup increases startup count. Registering as a freelancer increases freelancer count. Posting gigs, ads, or media increases live posts.";
    }

    if (hasAny(q, ["invest", "sponsor", "funding", "capital"])) {
      return "<strong>Investor flow:</strong><br>Use Explore Startups to review sectors, stage, pitch, target, and funding progress. Investments update portfolio records and startup raised amount in the local demo database.";
    }

    if (hasAny(q, ["contact", "support", "help", "number", "phone"])) {
      return "For human support, call <strong style='color:#0f766e;'>6301394850</strong> or email <strong>support@connecthub.com</strong>.";
    }

    return "I can help with: <br><strong>Startup:</strong> post gigs, publish media, hire freelancers.<br><strong>Freelancer:</strong> publish service ads with proof-of-work media and apply to gigs.<br><strong>Publishing:</strong> deploy as a static app now, then add a backend when you need real multi-user sync.";
  }

  function hasAny(text, words) {
    return words.some(word => text.includes(word));
  }
})();
