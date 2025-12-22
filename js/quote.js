async function createQuote(quoteNumber, customerName, quoteData) {
  // 1. Insert quote master
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert([
      {
        quote_number: quoteNumber,
        customer_name: customerName
      }
    ])
    .select()
    .single();

  if (quoteError) {
    console.error("Quote creation failed:", quoteError);
    return;
  }

  // 2. Insert version 1
  const { error: versionError } = await supabase
    .from("quote_versions")
    .insert([
      {
        quote_id: quote.id,
        version_number: 1,
        quote_json: quoteData
      }
    ]);

  if (versionError) {
    console.error("Version creation failed:", versionError);
  } else {
    console.log("Quote created with Version 1");
  }
}


async function reviseQuote(quoteId, updatedQuoteData) {
  // 1. Get latest version
  const { data: versions, error } = await supabase
    .from("quote_versions")
    .select("version_number")
    .eq("quote_id", quoteId)
    .order("version_number", { ascending: false })
    .limit(1);

  if (error || versions.length === 0) {
    console.error("Failed to fetch version:", error);
    return;
  }

  const nextVersion = versions[0].version_number + 1;

  // 2. Insert new version
  const { error: insertError } = await supabase
    .from("quote_versions")
    .insert([
      {
        quote_id: quoteId,
        version_number: nextVersion,
        quote_json: updatedQuoteData
      }
    ]);

  if (insertError) {
    console.error("Revision failed:", insertError);
  } else {
    console.log(`Quote revised to Version ${nextVersion}`);
  }
}


async function loadQuoteVersions(quoteId) {
  const { data, error } = await supabase
    .from("quote_versions")
    .select("*")
    .eq("quote_id", quoteId)
    .order("version_number", { ascending: false });

  if (error) {
    console.error("Failed to load versions:", error);
    return [];
  }

  return data;
}
