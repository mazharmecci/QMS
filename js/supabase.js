// ../js/supabase.js
const SUPABASE_URL = "https://kkzvniasiqfoswdatjvm.supabase.co";
const SUPABASE_KEY = "sb_publishable_4t-uExEPlZ81VgcZoZp43w_NusdpCDj";

// Get createClient from the global supabase object provided by the CDN
const { createClient } = supabase;

// Create one client instance
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// Expose it globally so other scripts can use `supabase`
window.supabase = supabaseClient;
