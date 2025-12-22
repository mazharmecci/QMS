// ../js/supabase.js
const SUPABASE_URL = "https://kkzvniasiqfoswdatjvm.supabase.co";
const SUPABASE_KEY = "sb_publishable_4t-uExEPlZ81VgcZoZp43w_NusdpCDj";

// Supabase library is exposed by CDN as window.supabase
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// Expose the client globally
window.db = supabaseClient;
