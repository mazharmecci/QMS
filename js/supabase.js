<!-- Include Supabase JS library from CDN -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/supabase.min.js"></script>

<script>
  // Replace these with your actual Supabase project URL and public anon key
  const SUPABASE_URL = "https://kkzvniasiqfoswdatjvm.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_4t-uExEPlZ81VgcZoZp43w_NusdpCDj";

  // Initialize Supabase client
  const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Example: Test connection by fetching something
  async function testSupabase() {
    const { data, error } = await supabase.from('quotes').select('*');
    if (error) {
      console.error("Supabase error:", error);
    } else {
      console.log("Supabase data:", data);
    }
  }

  // Run test
  testSupabase();
</script>
