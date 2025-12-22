async function saveQuoteToSupabase(header, quote) {
  try {
    // 1. Insert / fetch quote master
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

    // 2. Insert version
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
