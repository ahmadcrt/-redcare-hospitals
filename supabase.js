/* Creates the shared Supabase client (RC.db). RC.db is null when not configured. */
window.RC = window.RC || {};
(function () {
  var c = window.REDCARE_CONFIG || {};
  RC.configured = /^https:\/\/.+\.supabase\.co$/.test(c.SUPABASE_URL || "") && !!c.SUPABASE_ANON_KEY && c.SUPABASE_ANON_KEY.indexOf("YOUR_") !== 0;
  RC.db = null;
  if (RC.configured && window.supabase) {
    RC.db = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }
  RC.NOT_CONFIGURED_MSG = "The database is not connected yet. Add the Supabase anon key to js/config.js (see README).";
})();
