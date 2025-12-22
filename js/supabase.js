// Initialize Supabase client
const supabaseUrl = 'https://kkzvniasiqfoswdatjvm.supabase.co';
const supabaseKey = '4t-uExEPlZ81VgcZoZp43w_NusdpCDj';
const supabase = Supabase.createClient(supabaseUrl, supabaseKey);

/**
 * Fetch all quotes from Supabase
 */
async function fetchQuotes() {
  try {
    const { data, error } = await supabase.from('quotes').select('*');
    if (error) {
      console.error("Supabase fetch error:", error);
      return [];
    }
    console.log("Fetched quotes:", data);
    return data;
  } catch (err) {
    console.error("Unexpected fetch error:", err);
    return [];
  }
}

/**
 * Save a quote object to Supabase
 * @param {Object} quoteObj - Full quote object
 */
async function saveQuoteToSupabase(quoteObj) {
  try {
    const { data, error } = await supabase.from('quotes').insert([quoteObj]);
    if (error) {
      console.error("Supabase insert error:", error);
      alert("Unexpected error occurred while saving to Supabase. Check console.");
      return null;
    }
    console.log("Quote saved successfully:", data);
    alert(`Quote saved successfully to Supabase as ${quoteObj.header.quoteNo} (Rev ${quoteObj.revision})`);
    return data;
  } catch (err) {
    console.error("Unexpected insert error:", err);
    alert("Unexpected error occurred while saving to Supabase. Check console.");
    return null;
  }
}
