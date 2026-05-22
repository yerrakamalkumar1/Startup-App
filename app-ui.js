const AppUX = (() => {
  let audioCtx = null;
  let homeView = "";
  let profileView = "";
  let historyStack = [];
  let currentView = "";

  function unlockAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  function playSound(type = "tap") {
    try {
      unlockAudio();
      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const tones = {
        tap: [420, 0.035, 0.018],
        nav: [540, 0.045, 0.02],
        done: [780, 0.08, 0.025],
        back: [300, 0.04, 0.018],
        bell: [1046, 0.11, 0.028]
      };
      const [frequency, duration, volume] = tones[type] || tones.tap;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.value = volume;
      oscillator.connect(gain);
      gain.connect(audioCtx.destination);
      oscillator.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      oscillator.stop(audioCtx.currentTime + duration + 0.02);
    } catch {
      // Browsers can block audio before the first user gesture.
    }
  }

  function init(options = {}) {
    homeView = options.homeView || homeView;
    profileView = options.profileView || homeView;
    document.addEventListener("pointerdown", unlockAudio, { once: true });
    installShellControls();
    installProfileMenu();
    installButtonSounds();
    installRefreshBar();
  }

  function installShellControls() {
    const app = document.querySelector(".app-container");
    const nav = document.querySelector(".top-navbar");
    const pageTitle = document.querySelector(".page-title");
    const logo = document.querySelector(".sidebar-logo");
    if (!app || !nav || !pageTitle) return;

    if (!document.querySelector(".mobile-nav-backdrop")) {
      const backdrop = document.createElement("button");
      backdrop.className = "mobile-nav-backdrop";
      backdrop.setAttribute("aria-label", "Close navigation");
      backdrop.addEventListener("click", closeMenu);
      document.body.appendChild(backdrop);
    }

    if (!document.getElementById("mobileMenuBtn")) {
      const menuBtn = document.createElement("button");
      menuBtn.id = "mobileMenuBtn";
      menuBtn.className = "btn btn-secondary btn-icon mobile-menu-btn";
      menuBtn.title = "Menu";
      menuBtn.innerHTML = '<i data-lucide="menu"></i>';
      menuBtn.addEventListener("click", () => {
        playSound("nav");
        app.classList.add("nav-open");
      });
      nav.insertBefore(menuBtn, nav.firstChild);
    }

    if (!document.getElementById("viewBackBtn")) {
      const backBtn = document.createElement("button");
      backBtn.id = "viewBackBtn";
      backBtn.className = "btn btn-secondary btn-icon view-back-btn";
      backBtn.title = "Back";
      backBtn.innerHTML = '<i data-lucide="arrow-left"></i>';
      backBtn.addEventListener("click", back);
      pageTitle.prepend(backBtn);
    }

    if (logo) {
      logo.setAttribute("role", "button");
      logo.setAttribute("tabindex", "0");
      logo.title = "Go to dashboard";
      logo.addEventListener("click", () => {
        playSound("nav");
        if (window.go && homeView) window.go(homeView);
        closeMenu();
      });
    }

    if (window.lucide) window.lucide.createIcons();
  }

  function installProfileMenu() {
    const badge = document.querySelector(".user-profile-badge");
    if (!badge || document.getElementById("profileMenu")) return;

    badge.classList.add("profile-trigger");
    const logoutButton = badge.querySelector("button");
    if (logoutButton) logoutButton.remove();

    const menu = document.createElement("div");
    menu.id = "profileMenu";
    menu.className = "profile-menu";
    menu.innerHTML = `
      <button type="button" data-profile-action="open"><i data-lucide="user"></i><span>Open profile</span></button>
      <button type="button" data-profile-action="edit"><i data-lucide="settings"></i><span>Edit profile</span></button>
      <button type="button" data-profile-action="logout"><i data-lucide="log-out"></i><span>Logout</span></button>
    `;
    badge.appendChild(menu);

    badge.addEventListener("click", event => {
      event.stopPropagation();
      playSound("tap");
      menu.classList.toggle("active");
    });

    menu.addEventListener("click", event => {
      event.stopPropagation();
      const button = event.target.closest("button");
      if (!button) return;
      const action = button.dataset.profileAction;
      menu.classList.remove("active");
      playSound(action === "logout" ? "back" : "nav");
      if (action === "logout") handleLogout();
      else if (window.go && profileView) {
        window.go(profileView);
        closeMenu();
      }
    });

    document.addEventListener("click", () => menu.classList.remove("active"));
    if (window.lucide) window.lucide.createIcons();
  }

  function installButtonSounds() {
    document.addEventListener("click", event => {
      if (event.target.closest("button, .sidebar-item, .auth-tab, .role-chip")) {
        playSound("tap");
      }
    });
  }

  function installRefreshBar() {
    if (document.getElementById("appRefreshBar")) return;
    const bar = document.createElement("div");
    bar.id = "appRefreshBar";
    bar.className = "app-refresh-bar";
    document.body.appendChild(bar);
  }

  function loadRazorpayCheckout() {
    return new Promise((resolve, reject) => {
      if (window.Razorpay) return resolve();
      const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existing) {
        existing.addEventListener("load", resolve);
        existing.addEventListener("error", reject);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Could not load Razorpay Checkout."));
      document.head.appendChild(script);
    });
  }

  async function startPayment({ amount, purpose, payeeName }) {
    const rupees = Number(amount || prompt("Enter amount in INR"));
    if (!Number.isFinite(rupees) || rupees < 1) {
      alert("Enter a valid payment amount.");
      return;
    }
    try {
      await loadRazorpayCheckout();
      const data = await createRazorpayOrder(rupees, purpose, { payeeName });
      const user = getCurrentUser() || {};
      const options = {
        key: data.keyId,
        amount: data.order.amount,
        currency: data.order.currency,
        name: "Connect Hub",
        description: purpose || "Connect Hub payment",
        order_id: data.order.id,
        prefill: { name: user.name || "", email: "" },
        theme: { color: "#0f766e" },
        handler: async response => {
          try {
            await verifyRazorpayPayment(response);
            playSound("done");
            alert("Payment verified successfully.");
          } catch (error) {
            alert(error.message);
          }
        }
      };
      new window.Razorpay(options).open();
    } catch (error) {
      alert(error.message);
    }
  }

  function onView(view) {
    if (currentView && currentView !== view) historyStack.push(currentView);
    currentView = view;
    closeMenu();
    animateContent();
    refreshPulse();
    updateBackButton();
    playSound("nav");
  }

  function animateContent() {
    const body = document.getElementById("body");
    if (!body) return;
    body.classList.remove("view-enter");
    void body.offsetWidth;
    body.classList.add("view-enter");
  }

  function refreshPulse() {
    const bar = document.getElementById("appRefreshBar");
    if (!bar) return;
    bar.classList.remove("active");
    void bar.offsetWidth;
    bar.classList.add("active");
    setTimeout(() => bar.classList.remove("active"), 650);
  }

  function updateBackButton() {
    const backBtn = document.getElementById("viewBackBtn");
    if (!backBtn) return;
    backBtn.style.display = currentView && currentView !== homeView ? "inline-flex" : "none";
  }

  function back() {
    playSound("back");
    const next = historyStack.pop() || homeView;
    if (next && window.go) {
      const previous = currentView;
      currentView = "";
      window.go(next);
      if (previous === next && next !== homeView) window.go(homeView);
    }
  }

  function closeMenu() {
    document.querySelector(".app-container")?.classList.remove("nav-open");
  }

  return { init, onView, back, playSound, startPayment };
})();
