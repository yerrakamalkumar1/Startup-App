import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

const VALID_ROLES = new Set(["startup", "freelancer", "investor", "client", "admin"]);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function assertPassword(password) {
  if (String(password || "").length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
}

function assertRole(role) {
  if (!VALID_ROLES.has(role)) throw new Error("Invalid profile role.");
}

function cleanText(value, maxLength = 180) {
  return String(value || "").trim().slice(0, maxLength);
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

export async function signUpWithEmail({ email, password, fullName, role }) {
  const safeEmail = normalizeEmail(email);
  assertPassword(password);
  assertRole(role);

  const { data, error } = await supabase.auth.signUp({
    email: safeEmail,
    password,
    options: {
      data: {
        full_name: cleanText(fullName, 80),
        role
      },
      emailRedirectTo: `${window.location.origin}/auth/callback`
    }
  });

  if (error) throw error;

  if (data.user) {
    await supabase.from("profiles").upsert({
      id: data.user.id,
      email: safeEmail,
      full_name: cleanText(fullName, 80),
      role
    });
  }

  return data;
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(email),
    password
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resendVerificationEmail(email) {
  const { data, error } = await supabase.auth.resend({
    type: "signup",
    email: normalizeEmail(email),
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
  });
  if (error) throw error;
  return data;
}

export async function sendPasswordReset(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
    redirectTo: `${window.location.origin}/auth/reset-password`
  });
  if (error) throw error;
  return data;
}

export async function getSessionUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function getCurrentProfile() {
  const user = await getSessionUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,headline,bio,avatar_url,city,region,country,created_at,updated_at")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  return data;
}

export async function saveProfile(profile) {
  const user = await getSessionUser();
  if (!user) throw new Error("You must be signed in.");
  assertRole(profile.role);

  const payload = {
    id: user.id,
    email: normalizeEmail(user.email),
    full_name: cleanText(profile.full_name, 80),
    role: profile.role,
    headline: cleanText(profile.headline, 120),
    bio: cleanText(profile.bio, 900),
    city: cleanText(profile.city, 80),
    region: cleanText(profile.region, 80),
    country: cleanText(profile.country || "India", 80)
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function uploadProfilePicture(file) {
  const user = await getSessionUser();
  if (!user) throw new Error("You must be signed in.");
  if (!file) throw new Error("Choose a profile picture.");
  if (!AVATAR_TYPES.has(file.type)) throw new Error("Use JPG, PNG, or WebP.");
  if (file.size > MAX_AVATAR_BYTES) throw new Error("Profile picture must be under 5 MB.");

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const storagePath = `${user.id}/avatar-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type
    });
  if (uploadError) throw uploadError;

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from("avatars")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
  if (signedUrlError) throw signedUrlError;

  await supabase.from("avatar_uploads").insert({
    user_id: user.id,
    storage_path: storagePath,
    mime_type: file.type,
    size_bytes: file.size
  });

  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_url: signedUrlData.signedUrl })
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function getBrowserLocation(options = {}) {
  if (!("geolocation" in navigator)) {
    return Promise.reject(new Error("Geolocation is not supported on this device."));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 5 * 60 * 1000,
      ...options
    });
  });
}

export async function saveCurrentLocation() {
  const user = await getSessionUser();
  if (!user) throw new Error("You must be signed in.");

  const position = await getBrowserLocation();
  const payload = {
    user_id: user.id,
    latitude: Number(position.coords.latitude.toFixed(6)),
    longitude: Number(position.coords.longitude.toFixed(6)),
    accuracy_meters: position.coords.accuracy ?? null,
    captured_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("profile_locations")
    .upsert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function enablePushNotifications() {
  const user = await getSessionUser();
  if (!user) throw new Error("You must be signed in.");
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push notifications are not supported on this browser.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const registration = await navigator.serviceWorker.register("/push-sw.js");
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  });

  const json = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: navigator.userAgent
  }, { onConflict: "endpoint" });

  if (error) throw error;

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ""}`
    },
    body: JSON.stringify(json)
  });

  return subscription;
}

