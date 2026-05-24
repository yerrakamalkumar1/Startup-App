// Optional Supabase helper for static deployments. Configure url + anonKey in config.js.
// The current demo uses localStorage/Render state first; this helper is ready for
// future database/auth migration without adding paid services.
(function () {
  let clientPromise = null;

  function hasSupabaseConfig() {
    const cfg = window.CONNECTHUB_SUPABASE_CONFIG || {};
    return Boolean(cfg.url && cfg.anonKey && !cfg.url.includes("YOUR_"));
  }

  async function getClient() {
    if (!hasSupabaseConfig()) return null;
    if (!clientPromise) {
      clientPromise = import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
        .then(({ createClient }) => createClient(
          window.CONNECTHUB_SUPABASE_CONFIG.url,
          window.CONNECTHUB_SUPABASE_CONFIG.anonKey
        ));
    }
    return clientPromise;
  }

  async function upsert(table, row) {
    const client = await getClient();
    if (!client || !table || !row) return { skipped: true };
    return client.from(table).upsert(row).select();
  }

  async function select(table, query = builder => builder) {
    const client = await getClient();
    if (!client || !table) return { data: [], skipped: true };
    return query(client.from(table).select("*"));
  }

  window.ConnectHubSupabase = {
    enabled: hasSupabaseConfig,
    getClient,
    upsert,
    select
  };
})();
