// Utility: log and return safe fallback
function handleError(context, error, fallback = null) {
  console.error(`${context} failed:`, error);
  return fallback;
}

// Create a new quote and its first version
async function createQuote(quoteNumber, customerName, quoteData) {
  try {
    // 1. Insert quote master
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .insert([{ quote_number: quoteNumber, customer_name: customerName }])
      .select()
      .single();

    if (quoteError) return handleError("Quote creation", quoteError);

    // 2. Insert version 1
    const { error: versionError } = await supabase
      .from("quote_versions")
      .insert([{ quote_id: quote.id, version_number: 1, quote_json: quoteData }]);

    if (versionError) return handleError("Version creation", versionError);

    console.log("Quote created with Version 1");
    return quote; // return the created quote object
  } catch (err) {
    return handleError("createQuote", err);
  }
}

// Revise an existing quote by adding a new version
async function reviseQuote(quoteId, updatedQuoteData) {
  try {
    // 1. Get latest version
    const { data: versions, error } = await supabase
      .from("quote_versions")
      .select("version_number")
      .eq("quote_id", quoteId)
      .order("version_number", { ascending: false })
      .limit(1);

    if (error || !versions?.length) return handleError("Fetch latest version", error);

    const nextVersion = versions[0].version_number + 1;

    // 2. Insert new version
    const { error: insertError } = await supabase
      .from("quote_versions")
      .insert([{ quote_id: quoteId, version_number: nextVersion, quote_json: updatedQuoteData }]);

    if (insertError) return handleError("Revision", insertError);

    console.log(`Quote revised to Version ${nextVersion}`);
    return nextVersion;
  } catch (err) {
    return handleError("reviseQuote", err);
  }
}

// Load all versions of a quote
async function loadQuoteVersions(quoteId) {
  try {
    const { data, error } = await supabase
      .from("quote_versions")
      .select("*")
      .eq("quote_id", quoteId)
      .order("version_number", { ascending: false });

    if (error) return handleError("Load versions", error, []);

    return data;
  } catch (err) {
    return handleError("loadQuoteVersions", err, []);
  }
}

<script>
  async function saveQuoteToSupabase(header, quote) {
    try {
     
      const { data: quoteRow, error: quoteError } = await supabase
        .from("quotes")
        .select("id")
        .eq("quote_number", header.quoteNo)
        .single();

      let quoteId;

      if (quoteRow) {
        quoteId = quoteRow.id;
      } else {
        const { data: newQuote, error: newQuoteError } = await supabase
          .from("quotes")
          .insert([{
            quote_number: header.quoteNo,
            customer_name: header.customerName || ""
          }])
          .select()
          .single();

        if (newQuoteError) throw newQuoteError;
        quoteId = newQuote.id;
      }

      
      await supabase.from("quote_versions").insert([{
        quote_id: quoteId,
        version_number: quote.rev,
        quote_json: quote
      }]);

      console.log("Saved to Supabase:", header.quoteNo, "Rev", quote.rev);
    } catch (err) {
      console.error("Supabase save failed:", err);
    }
  }

 
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof populateHeader === "function") populateHeader();
    if (typeof renderQuoteBuilder === "function") renderQuoteBuilder();
  });

  
  function goBack() {
    window.history.back();
  }
</script>

