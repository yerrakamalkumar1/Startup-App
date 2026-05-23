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
        <div class="ai-bot-window-actions">
          <button type="button" id="aiBotMinimize" aria-label="Minimize assistant">−</button>
          <button type="button" id="aiBotClose" aria-label="Close assistant">&times;</button>
        </div>
      </div>
      <div class="ai-bot-messages" id="aiBotMessages">
        <div class="ai-msg bot">
          Hi, I can help with hiring, freelancer ads, payments, account recovery, profile setup, media posts, investor flows, and dashboard navigation.
          <br><br><strong>Tip:</strong> ask "payment help", "forgot password", "best ad format", or "how to hire".
        </div>
      </div>
      <div class="ai-bot-suggestions">
        <button class="ai-suggest-btn" data-query="How do I post a photo or reel ad?">Media ad</button>
        <button class="ai-suggest-btn" data-query="How do payments work?">Payments</button>
        <button class="ai-suggest-btn" data-query="I forgot my password">Password</button>
        <button class="ai-suggest-btn" data-query="Best workflow for startup hiring">Hiring</button>
        <button class="ai-suggest-btn" data-query="How do I improve my profile?">Profile</button>
      </div>
      <div class="ai-bot-input-area">
        <input type="text" id="aiBotInput" placeholder="Ask about ads, hiring, payments, account help...">
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
    const header = container.querySelector(".ai-bot-header");
    const closeBtn = document.getElementById("aiBotClose");
    const minimizeBtn = document.getElementById("aiBotMinimize");
    const sendBtn = document.getElementById("aiBotSend");
    const inputField = document.getElementById("aiBotInput");
    const messagesBox = document.getElementById("aiBotMessages");
    let dragState = null;

    toggleBtn.addEventListener("click", () => {
      container.classList.add("active");
      resetIfOffscreen();
      inputField.focus();
    });

    function hideAssistant() {
      container.classList.remove("active");
      toggleBtn.style.display = "flex";
    }

    closeBtn.addEventListener("click", hideAssistant);
    minimizeBtn.addEventListener("click", hideAssistant);

    header.addEventListener("mousedown", startDrag);
    document.addEventListener("mousemove", dragMove);
    document.addEventListener("mouseup", endDrag);
    header.addEventListener("touchstart", startDrag, { passive: false });
    document.addEventListener("touchmove", dragMove, { passive: false });
    document.addEventListener("touchend", endDrag);

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

    function getPoint(event) {
      const touch = event.touches?.[0] || event.changedTouches?.[0];
      return touch ? { x: touch.clientX, y: touch.clientY } : { x: event.clientX, y: event.clientY };
    }

    function startDrag(event) {
      if (event.target.closest("button")) return;
      event.preventDefault();
      const point = getPoint(event);
      const rect = container.getBoundingClientRect();
      dragState = {
        offsetX: point.x - rect.left,
        offsetY: point.y - rect.top
      };
      container.classList.add("dragging");
      container.style.right = "auto";
      container.style.bottom = "auto";
      container.style.left = `${rect.left}px`;
      container.style.top = `${rect.top}px`;
    }

    function dragMove(event) {
      if (!dragState) return;
      event.preventDefault();
      const point = getPoint(event);
      const rect = container.getBoundingClientRect();
      const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
      const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
      const left = Math.min(Math.max(8, point.x - dragState.offsetX), maxLeft);
      const top = Math.min(Math.max(8, point.y - dragState.offsetY), maxTop);
      container.style.left = `${left}px`;
      container.style.top = `${top}px`;
    }

    function endDrag() {
      if (!dragState) return;
      dragState = null;
      container.classList.remove("dragging");
    }

    function resetIfOffscreen() {
      const rect = container.getBoundingClientRect();
      const out = rect.left < 0 || rect.top < 0 || rect.left > window.innerWidth - 40 || rect.top > window.innerHeight - 40;
      if (!out) return;
      container.style.left = "";
      container.style.top = "";
      container.style.right = "24px";
      container.style.bottom = "92px";
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

    if (hasAny(q, ["payment", "pay", "razorpay", "sponsor payment", "client pay", "freelancer pay"])) {
      return "<strong>Payments:</strong><br>Startups can pay freelancers from the contact modal. Investors can sponsor startups from the investment modal. Razorpay works after the admin adds <strong>RAZORPAY_KEY_ID</strong> and <strong>RAZORPAY_KEY_SECRET</strong> in Render. Always verify payment success inside the app before delivering work.";
    }

    if (hasAny(q, ["forgot", "password", "otp", "reset", "passcode"])) {
      return "<strong>Password help:</strong><br>Tap <strong>Forgot password?</strong> on the login screen, enter your registered email, receive OTP, then set a new passcode. Email OTP works after SMTP variables are configured in Render.";
    }

    if (hasAny(q, ["profile", "edit profile", "open profile", "bio", "pitch"])) {
      return "<strong>Profile improvement:</strong><br>Use a clear title, one-line value promise, sector/category tags, and proof-of-work media. Startups should explain what they build and what talent/capital they need. Freelancers should show packages, price, delivery time, and samples.";
    }

    if (hasAny(q, ["navigation", "menu", "back", "dashboard", "three lines"])) {
      return "<strong>Navigation:</strong><br>Use the three-line menu on mobile to switch dashboard sections. Tap the back arrow to return to the previous section. Tap the Connect Hub logo to return to the main dashboard view.";
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

    return "I can help with: <br><strong>Startup:</strong> hiring, gigs, media posts, payments.<br><strong>Freelancer:</strong> service ads, applications, profile quality, payments.<br><strong>Investor:</strong> discovery, sponsorship, portfolio.<br><strong>Account:</strong> login, OTP reset, profile settings, navigation.";
  }

  function hasAny(text, words) {
    return words.some(word => text.includes(word));
  }
})();
