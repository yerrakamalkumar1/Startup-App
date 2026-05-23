const express = require("express");
const webpush = require("web-push");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:support@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

function requireEnv(name) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" ? token : "";
}

async function requireUser(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing auth token." });

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: "Invalid auth token." });

    req.user = data.user;
    next();
  } catch (error) {
    res.status(500).json({ error: "Authentication failed." });
  }
}

function safeNotification(input) {
  return {
    title: String(input.title || "Connect Hub").slice(0, 80),
    body: String(input.body || "You have a new update.").slice(0, 180),
    url: String(input.url || "/").startsWith("/") ? String(input.url || "/") : "/",
    icon: "/assets/logo.png",
    badge: "/assets/logo.png",
    timestamp: Date.now()
  };
}

async function canSendPush(senderId, targetUserId) {
  if (senderId === targetUserId) return true;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", senderId)
    .single();

  if (error) return false;
  return data?.role === "admin";
}

router.get("/push/public-key", (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

router.post("/push/subscribe", requireUser, async (req, res) => {
  try {
    requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const subscription = req.body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: "Invalid push subscription." });
    }

    const { error } = await supabaseAdmin.from("push_subscriptions").upsert({
      user_id: req.user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: req.headers["user-agent"] || ""
    }, { onConflict: "endpoint" });

    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/push/unsubscribe", requireUser, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: "Endpoint is required." });

    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .eq("user_id", req.user.id)
      .eq("endpoint", endpoint);

    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/push/send", requireUser, async (req, res) => {
  try {
    requireEnv("VAPID_PUBLIC_KEY");
    requireEnv("VAPID_PRIVATE_KEY");

    const { userId, title, body, url } = req.body;
    if (!userId) return res.status(400).json({ error: "Target userId is required." });
    if (!(await canSendPush(req.user.id, userId))) {
      return res.status(403).json({ error: "You are not allowed to notify this user." });
    }

    const { data: subscriptions, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("user_id", userId);

    if (error) throw error;

    const payload = JSON.stringify(safeNotification({ title, body, url }));
    const results = await Promise.allSettled(
      subscriptions.map(row => webpush.sendNotification({
        endpoint: row.endpoint,
        keys: {
          p256dh: row.p256dh,
          auth: row.auth
        }
      }, payload))
    );

    const expiredIds = results
      .map((result, index) => ({ result, row: subscriptions[index] }))
      .filter(({ result }) => result.status === "rejected" && [404, 410].includes(result.reason?.statusCode))
      .map(({ row }) => row.id);

    if (expiredIds.length) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", expiredIds);
    }

    res.json({
      ok: true,
      sent: results.filter(result => result.status === "fulfilled").length,
      failed: results.filter(result => result.status === "rejected").length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = { pushRouter: router };
