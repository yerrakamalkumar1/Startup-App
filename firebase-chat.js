// Optional Firebase Firestore real-time messaging for the static Render app.
// If Firebase keys are not added in config.js, ConnectHub falls back to local demo messages.
(function () {
  let app = null;
  let db = null;
  let modulesPromise = null;
  const unsubscribers = {};

  function hasFirebaseConfig() {
    const cfg = window.CONNECTHUB_FIREBASE_CONFIG || {};
    return Boolean(cfg.apiKey && cfg.projectId && !cfg.apiKey.includes("YOUR_"));
  }

  async function loadModules() {
    if (!hasFirebaseConfig()) return null;
    if (!modulesPromise) {
      modulesPromise = Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js")
      ]);
    }
    const [appModule, firestoreModule] = await modulesPromise;
    if (!app) app = appModule.initializeApp(window.CONNECTHUB_FIREBASE_CONFIG);
    if (!db) db = firestoreModule.getFirestore(app);
    return { firestoreModule, db };
  }

  function threadIdFor(a, b) {
    return [a, b].map(name => String(name || "").trim().toLowerCase()).sort().join("__");
  }

  async function sendMessage(message) {
    const loaded = await loadModules();
    if (!loaded || !message?.from || !message?.to) return false;
    const { firestoreModule, db: firestore } = loaded;
    const threadId = threadIdFor(message.from, message.to);
    await firestoreModule.setDoc(
      firestoreModule.doc(firestore, "connecthub_threads", threadId, "messages", message.id),
      { ...message, threadId, syncedAt: firestoreModule.serverTimestamp() },
      { merge: true }
    );
    await firestoreModule.setDoc(
      firestoreModule.doc(firestore, "connecthub_threads", threadId),
      {
        participants: [message.from, message.to],
        lastText: message.text || message.kind || "Message",
        updatedAt: firestoreModule.serverTimestamp()
      },
      { merge: true }
    );
    return true;
  }

  async function subscribeToThread(peerName, onMessage) {
    const user = getCurrentUser?.();
    const loaded = await loadModules();
    if (!loaded || !user || !peerName) return null;
    const { firestoreModule, db: firestore } = loaded;
    const threadId = threadIdFor(user.name, peerName);
    if (unsubscribers[threadId]) unsubscribers[threadId]();
    const q = firestoreModule.query(
      firestoreModule.collection(firestore, "connecthub_threads", threadId, "messages"),
      firestoreModule.orderBy("createdAt", "asc")
    );
    unsubscribers[threadId] = firestoreModule.onSnapshot(q, snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === "added" || change.type === "modified") onMessage(change.doc.data());
      });
    });
    return unsubscribers[threadId];
  }

  window.ConnectHubFirebaseChat = {
    enabled: hasFirebaseConfig,
    sendMessage,
    subscribeToThread
  };
})();
