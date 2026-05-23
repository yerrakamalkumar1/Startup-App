# Secure Profile Platform Integration

This kit adds production-ready building blocks for:

- secure email/password authentication with email verification
- user profile management
- browser geolocation saved only with user consent
- profile picture uploads
- web push notifications

Free-tier stack:

- Supabase Auth, Postgres, Row Level Security, and Storage
- your existing Node/Render backend for Web Push VAPID delivery
- browser Geolocation and Notification APIs

## 1. Install Packages

```bash
npm install @supabase/supabase-js web-push
```

## 2. Supabase Setup

Create a free Supabase project, then run `schema.sql` in the Supabase SQL editor.

Create a public storage bucket named:

```text
avatars
```

Enable email confirmation in Supabase Auth settings:

```text
Authentication > Providers > Email > Confirm email
```

## 3. Environment Variables

Frontend variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_VAPID_PUBLIC_KEY
```

Backend variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code.

## 4. Generate VAPID Keys

```bash
npx web-push generate-vapid-keys
```

Use the public key in frontend and both keys in backend.

## 5. Frontend Usage

```js
import {
  signUpWithEmail,
  signInWithEmail,
  getCurrentProfile,
  saveProfile,
  uploadProfilePicture,
  saveCurrentLocation,
  enablePushNotifications
} from "./client/profileClient.js";

await signUpWithEmail({
  email: "founder@example.com",
  password: "strong-passcode",
  fullName: "Kamal Kumar",
  role: "startup"
});

await signInWithEmail("founder@example.com", "strong-passcode");

await saveProfile({
  full_name: "Kamal Kumar",
  headline: "Founder building for Indian startups",
  role: "startup"
});

await saveCurrentLocation();
await enablePushNotifications();
```

## 6. Backend Usage

If you use Express:

```js
const express = require("express");
const { pushRouter } = require("./server/pushRoutes");

const app = express();
app.use(express.json());
app.use("/api", pushRouter);
```

Send a notification:

```js
await fetch("/api/push/send", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`
  },
  body: JSON.stringify({
    userId: "target-user-id",
    title: "New freelancer application",
    body: "A freelancer applied to your gig."
  })
});
```

## Security Notes

- Row Level Security is enabled for profile, location, avatar metadata, and push subscriptions.
- Users can only read and update their own sensitive profile data.
- Public discovery should use a separate public view when needed.
- Location is opt-in and stores approximate latitude/longitude only after browser permission.
- Avatar uploads are path-scoped to the authenticated user id.
- Push subscriptions are stored per user and can be deleted by that user.
- Backend push sending verifies the Supabase JWT before sending notifications.
