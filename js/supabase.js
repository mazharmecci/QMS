if (!window.supabaseClient) {
  window.supabaseClient = supabase.createClient(
    'https://kkzvniasiqfoswdatjvm.supabase.co', // Replace with your Supabase URL
    '4t-uExEPlZ81VgcZoZp43w_NusdpCDj'     // Replace with your Supabase anon/public key
  );
}

// Export supabase for other scripts
const supabaseClient = window.supabaseClient;

/**
 * Save a quote object to Supabase 'quotes' table
 * @param {Object} quote - The quote object to save
 * @returns {Promise<Object>} - Returns { data, error }
 */
async function saveQuoteToSupabase(quote) {
  try {
    const { data, error } = await supabaseClient
      .from('quotes')
      .insert([quote]); // insert expects an array
    if (error) {
      console.error('Supabase save failed:', error);
      return { data: null, error };
    }
    console.log('Quote saved successfully to Supabase:', data);
    return { data, error: null };
  } catch (err) {
    console.error('Unexpected error saving quote to Supabase:', err);
    return { data: null, error: err };
  }
}

/**
 * Fetch all quotes from Supabase 'quotes' table
 * @returns {Promise<Object>} - Returns { data, error }
 */
async function fetchQuotesFromSupabase() {
  try {
    const { data, error } = await supabaseClient
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Supabase fetch failed:', error);
      return { data: null, error };
    }
    console.log('Fetched quotes from Supabase:', data);
    return { data, error: null };
  } catch (err) {
    console.error('Unexpected error fetching quotes from Supabase:', err);
    return { data: null, error: err };
  }
}
