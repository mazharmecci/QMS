// Utility: log and return safe fallback
function handleError(context, error, fallback = null) {
  console.error(`${context} failed:`, error);
  return fallback;
}

// Create a new quote and its first version
async function createQuote(quoteNumber, customerName, quoteData) {
  try {
    const { data: quote, error: quoteError } = await db
      .from("quotes")
      .insert([{ quote_number: quoteNumber, customer_name: customerName }])
      .select()
      .single();

    if (quoteError) return handleError("Quote creation", quoteError);

    const { error: versionError } = await db
      .from("quote_versions")
      .insert([
        {
          quote_id: quote.id,
          version_number: 1,
          quote_json: quoteData
        }
      ]);

    if (versionError) return handleError("Version creation", versionError);

    console.log("Quote created with Version 1");
    return quote;
  } catch (err) {
    return handleError("createQuote", err);
  }
}

// Revise an existing quote by adding a new version
async function reviseQuote(quoteId, updatedQuoteData) {
  try {
    const { data: versions, error } = await db
      .from("quote_versions")
      .select("version_number")
      .eq("quote_id", quoteId)
      .order("version_number", { ascending: false })
      .limit(1);

    if (error || !versions?.length) {
      return handleError("Fetch latest version", error);
    }

    const nextVersion = versions[0].version_number + 1;

    const { error: insertError } = await db
      .from("quote_versions")
      .insert([
        {
          quote_id: quoteId,
          version_number: nextVersion,
          quote_json: updatedQuoteData
        }
      ]);

    if (insertError) return handleError("Revision", insertError);

    console.log(`Quote revised to Version ${nextVersion}`);
    return nextVersion;
  } catch (err) {
    return handleError("reviseQuote", err);
  }
}

// Save quote (background, no UI impact)
async function saveQuoteToSupabase(header, quote) {
  try {
    const { data: quoteRow } = await db
      .from("quotes")
      .select("id")
      .eq("quote_number", header.quoteNo)
      .single();

    let quoteId = quoteRow?.id;

    if (!quoteId) {
      const { data: newQuote, error } = await db
        .from("quotes")
        .insert([
          {
            quote_number: header.quoteNo,
            customer_name: header.customerName || ""
          }
        ])
        .select()
        .single();

      if (error) throw error;
      quoteId = newQuote.id;
    }

    await db.from("quote_versions").insert([
      {
        quote_id: quoteId,
        version_number: quote.rev,
        quote_json: quote
      }
    ]);

    console.log("Saved to Supabase:", header.quoteNo, "Rev", quote.rev);
  } catch (err) {
    console.error("Supabase save failed:", err);
  }
}

// Page helpers
document.addEventListener("DOMContentLoaded", () => {
  if (typeof populateHeader === "function") populateHeader();
  if (typeof renderQuoteBuilder === "function") renderQuoteBuilder();
});

function goBack() {
  window.history.back();
}
