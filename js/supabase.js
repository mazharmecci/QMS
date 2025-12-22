<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/supabase.min.js"></script>
<script>
  // Initialize Supabase client
  const supabase = supabase.createClient(
    'https://kkzvniasiqfoswdatjvm.supabase.co', 
    'sb_publishable_4t-uExEPlZ81VgcZoZp43w_NusdpCDj'
  );

  // Example: fetch quotes from your 'quotes' table
  async function fetchQuotes() {
    const { data, error } = await supabase.from('quotes').select('*');
    if (error) console.error("Supabase error:", error);
    else console.log("Quotes data:", data);
  }

  fetchQuotes();
</script>
