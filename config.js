// For local file preview, leave this blank.
// After deploying the backend, set this to your backend URL, for example:
// window.CONNECTHUB_BACKEND_URL = "https://your-connecthub-backend.onrender.com";
window.CONNECTHUB_BACKEND_URL = "";

// Optional free-tier integrations. Replace the placeholder values after creating
// Firebase and Supabase projects. The app keeps working locally with demo storage
// until these are configured.
window.CONNECTHUB_FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

window.CONNECTHUB_SUPABASE_CONFIG = {
  url: "",
  anonKey: ""
};
