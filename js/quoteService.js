
// quoteService.js

import { fetchInstruments } from "./instrumentService.js";
import {
  db,
  collection,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  auth,
  getDoc,
  getDocs
} from "./firebase.js";

/* ========================
 * Local header & context
 * =======================*/

export function getQuoteHeaderRaw() {
  try {
    return JSON.parse(localStorage.getItem("quoteHeader") || "{}");
  } catch (err) {
    console.error("[getQuoteHeaderRaw] Failed to parse quoteHeader:", err);
    return {};
  }
}

export function saveQuoteHeader(header) {
  try {
    localStorage.setItem("quoteHeader", JSON.stringify(header));
    console.log("[saveQuoteHeader] Header saved locally.");
  } catch (err) {
    console.error("[saveQuoteHeader] Failed to save header:", err);
  }
}

export function getInstrumentsMaster() {
  try {
    const instruments = JSON.parse(localStorage.getItem("instruments") || "[]");
    return instruments.map((inst) => ({
      ...inst,
      suppliedCompleteWith:
        inst.suppliedCompleteWith || inst.suppliedWith || inst.supplied || ""
    }));
  } catch (err) {
    console.error("[getInstrumentsMaster] Failed to parse instruments:", err);
    return [];
  }
}

export function getQuoteContext() {
  const instruments = getInstrumentsMaster();
  const header = getQuoteHeaderRaw();
  const lines = Array.isArray(header.quoteLines) ? header.quoteLines : [];
  return { instruments, lines, header };
}

/* ========================
 * Line items (flattened view)
 * =======================*/

export function buildLineItemsFromCurrentQuote() {
  const { instruments, lines } = getQuoteContext();
  const items = [];

  (Array.isArray(lines) ? lines : []).forEach((line) => {
    const inst = instruments[line.instrumentIndex] || null;
    if (inst) {
      const price = Number(line.unitPriceOverride ?? inst.unitPrice ?? 0);

      items.push({
        name: inst.instrumentName || inst.name || "",
        code: inst.catalog || inst.instrumentCode || "",
        type: "Instrument",
        price,
        supplied: inst.suppliedCompleteWith || ""
      });
    }

    (line.configItems || []).forEach((item) => {
      const price =
        item.tpInr != null ? Number(item.tpInr) : Number(item.upInr || 0);
      items.push({
        name: item.name || item.itemName || "",
        code: item.code || item.catalog || "",
        type: "Configuration",
        price,
        supplied:
          item.suppliedCompleteWith ||
          item.suppliedWith ||
          item.supplied ||
          ""
      });
    });

    (line.additionalItems || []).forEach((item) => {
      const unitNum = Number(
        item.price || item.unitPrice || item.upInr || item.tpInr || 0
      );
      items.push({
        name: item.name || item.itemName || "",
        code: item.code || item.catalog || "",
        type: "Additional",
        price: unitNum,
        supplied:
          item.suppliedCompleteWith ||
          item.suppliedWith ||
          item.supplied ||
          ""
      });
    });
  });

  console.log("[buildLineItemsFromCurrentQuote] Built", items.length, "items.");
  return items;
}

/* ========================
 * Quote totals + Firestore object
 * =======================*/

function computeTotalsFromQuoteLines() {
  const { instruments, lines, header } = getQuoteContext();

  let subtotal = 0;

  const enrichedLines = (Array.isArray(lines) ? lines : []).map((line) => {
    if (line.lineType && line.lineType !== "instrument") {
      return line;
    }

    const inst = instruments[line.instrumentIndex] || {};
    const qty = Number(line.quantity || 1);
    const basePrice = Number(inst.unitPrice || 0);
    const unitPrice =
      line.unitPriceOverride != null
        ? Number(line.unitPriceOverride)
        : basePrice;

    const lineTotal = qty * unitPrice;
    subtotal += lineTotal;

    return {
      ...line,
      lineType: "instrument",
      instrumentName: inst.instrumentName || inst.name || line.instrumentName || "",
      instrumentCode: inst.catalog || inst.instrumentCode || line.instrumentCode || "",
      description: inst.longDescription || inst.description || line.description || "",
      unitPrice,
      totalPrice: lineTotal,
      gstPercent: Number(inst.gstPercent || line.gstPercent || header.gstPercent || 0),
      configItems: Array.isArray(line.configItems) ? line.configItems : [],
      additionalItems: Array.isArray(line.additionalItems) ? line.additionalItems : []
    };
  });

  const discount = Number(header.discount || 0);
  const afterDiscount = subtotal - discount;
  const gstPercent = Number(header.gstPercent || 18);
  const gstValueINR = Math.round((afterDiscount * gstPercent) / 100);
  const totalValueINR = afterDiscount + gstValueINR;

  return {
    header,
    enrichedLines,
    discount,
    subtotal,
    afterDiscount,
    gstPercent,
    gstValueINR,
    totalValueINR
  };
}

export function buildQuoteObject(existingDoc = null) {
  const {
    header,
    enrichedLines,
    discount,
    subtotal,
    afterDiscount,
    gstPercent,
    gstValueINR,
    totalValueINR
  } = computeTotalsFromQuoteLines();

  const user = auth.currentUser;
  const createdByUid = user ? user.uid : null;

  const items = enrichedLines.map((line) => ({
    instrumentCode: line.instrumentCode || "",
    instrumentName: line.instrumentName || "",
    description: line.description || "",
    quantity: Number(line.quantity || 1),
    unitPrice: Number(line.unitPrice || 0),
    totalPrice: Number(line.totalPrice || 0),
    gstPercent: Number(line.gstPercent || gstPercent || 0),
    unitPriceOverride:
      line.unitPriceOverride != null ? Number(line.unitPriceOverride) : null,
    configItems: Array.isArray(line.configItems) ? line.configItems : [],
    additionalItems: Array.isArray(line.additionalItems) ? line.additionalItems : []
  }));

  return {
    quoteNo: header.quoteNo || "",
    legacyQuoteNo: header.legacyQuoteNo || existingDoc?.legacyQuoteNo || "",
    quoteDate: header.quoteDate || "",
    yourReference: header.yourReference || "",
    refDate: header.refDate || "",
    hospitalName: header.hospitalName || "",
    hospital: {
      name: header.hospitalName || "",
      address: header.hospitalAddress || "",
      contactPerson: header.contactPerson || "",
      email: header.contactEmail || "",
      phone: header.contactPhone || "",
      officePhone: header.officePhone || "",
      kindAttn: header.kindAttn || ""
    },
    status: header.status || "SUBMITTED",
    discount,
    subtotalINR: subtotal,
    afterDiscountINR: afterDiscount,
    gstPercent,
    gstValueINR,
    totalValueINR,
    quoteLines: enrichedLines,
    items,
    salesNote: header.salesNote || "",
    termsHtml: header.termsHtml || "",
    termsText: header.termsText || "",
    createdBy: existingDoc?.createdBy || createdByUid,
    createdByLabel:
      existingDoc?.createdByLabel ||
      (user && (user.displayName || user.email || user.uid)) ||
      ""
  };
}

/* ========================
 * Validation
 * =======================*/

export function validateHeader(header) {
  const errors = [];

  if (!header || typeof header !== "object") {
    errors.push("Header object is missing or invalid");
  } else {
    if (!header.quoteNo) errors.push("Quote Number is missing");
    if (!header.quoteDate) errors.push("Quote Date is missing");
    if (!header.hospitalName) errors.push("Hospital Name is missing");
    if (!header.hospitalAddress) errors.push("Hospital Address is missing");

    if (header.discount != null && isNaN(Number(header.discount))) {
      errors.push("Discount must be a number");
    }
  }

  if (errors.length) {
    alert("Validation errors:\n" + errors.join("\n"));
    return false;
  }
  return true;
}

/* ========================
 * Firestore persistence
 * =======================*/

async function saveBaseQuoteDocToFirestore(docId, data) {
  try {
    if (docId) {
      const ref = doc(db, "quoteHistory", docId);
      await updateDoc(ref, {
        ...data,
        updatedAt: serverTimestamp()
      });
      return docId;
    }

    const colRef = collection(db, "quoteHistory");
    const newDoc = await addDoc(colRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return newDoc.id;
  } catch (err) {
    console.error("[saveBaseQuoteDocToFirestore] Error writing to Firestore:", err);
    alert("Cloud save failed. Quote saved locally, but not in Firestore.");
    return null;
  }
}

async function appendRevisionSnapshot(docId, data) {
  try {
    const subCol = collection(db, "quoteHistory", docId, "revisions");
    await addDoc(subCol, {
      ...data,
      createdAt: serverTimestamp()
    });
    console.log("[appendRevisionSnapshot] snapshot written");
  } catch (err) {
    console.error("[appendRevisionSnapshot] Error writing revision snapshot:", err);
  }
}

/* ========================
 * Finalization & local history
 * =======================*/

let finalizeInProgress = false;

/**
 * Safely call the AI service for quote analysis.
 */
async function callAIService(quoteObj) {
  try {
    const payload = {
      quote: {
        deal_value: quoteObj.totalValueINR,
        hospital: quoteObj.hospital.name,
        instrument_category: "Histopathology",
        configuration_complexity: "Medium",
        items: quoteObj.items.map(item => ({
          item_id: item.code,
          quantity: item.quantity,
          unit_price: item.unitPrice
        }))
      },
      historical_context: {
        avg_winning_price: 100000,
        similar_quotes_won: 12,
        similar_quotes_lost: 3
      }
    };

    const res = await fetch("http://127.0.0.1:8001/analyze-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error("AI service call failed");
    return await res.json();
  } catch (err) {
    console.error("[callAIService] Error:", err);
    return null; // safeguard: do not throw
  }
}

/**
 * Finalize a quote: validate, persist locally & in Firestore, run AI analysis, and trigger print dialog.
 */
export async function finalizeQuote(rawArg = null) {
  if (finalizeInProgress) {
    console.warn("[finalizeQuote] blocked: already in progress.");
    return;
  }
  finalizeInProgress = true;

  const docId = typeof rawArg === "string" ? rawArg : null;

  try {
    const user = auth.currentUser;
    if (!user) {
      alert("You must be signed in to finalize quotes.");
      return null;
    }

    const header = getQuoteHeaderRaw();
    if (!validateHeader(header)) return null;

    const { lines } = getQuoteContext();
    if (!Array.isArray(lines) || !lines.length) {
      alert("No instruments in this quote. Please add at least one instrument.");
      return null;
    }

    header.status = "SUBMITTED";
    saveQuoteHeader(header);

    const {
      enrichedLines,
      discount,
      subtotal,
      afterDiscount,
      gstPercent,
      gstValueINR,
      totalValueINR
    } = computeTotalsFromQuoteLines();

    const summary = {
      itemsTotal: subtotal,
      discount,
      afterDiscount,
      freight: "Included",
      gstPercent,
      gstAmount: gstValueINR,
      totalValue: totalValueINR,
      roundOff: Math.round(totalValueINR) - totalValueINR
    };

    const lineItems = buildLineItemsFromCurrentQuote();

    // Local revision
    const existing = JSON.parse(localStorage.getItem("quotes") || "[]");
    const sameQuote = existing.filter(q => q.header?.quoteNo === header.quoteNo);
    const lastRev = sameQuote.length
      ? Math.max(...sameQuote.map(q => Number(q.revision || 1)))
      : 0;
    const nextRev = lastRev + 1;

    const now = new Date();
    const quoteLocal = {
      header: { ...header, quoteLines: enrichedLines },
      lineItems,
      summary,
      quoteNo: header.quoteNo,
      revision: nextRev,
      status: "SUBMITTED",
      history: [
        {
          status: "SUBMITTED",
          date: now.toISOString().slice(0, 10),
          time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]
    };

    existing.push(quoteLocal);
    localStorage.setItem("quotes", JSON.stringify(existing));

    // Firestore persistence
    const baseQuoteDoc = buildQuoteObject();
    const firestoreData = {
      ...baseQuoteDoc,
      revision: nextRev,
      localSummary: summary,
      status: "SUBMITTED",
      statusHistory: [
        ...(baseQuoteDoc.statusHistory || []),
        { status: "SUBMITTED", date: now.toISOString().slice(0, 10) }
      ]
    };

    const savedId = await saveBaseQuoteDocToFirestore(docId, firestoreData);
    if (!savedId) return null;

    await appendRevisionSnapshot(savedId, firestoreData);

    // AI analysis (non-blocking for print UX)
    try {
      const aiResult = await callAIService(baseQuoteDoc);
      const aiRef = doc(db, "quoteHistory", savedId);

      if (aiResult) {
        await updateDoc(aiRef, { ai_analysis: aiResult, ai_status: "SUCCESS" });
        console.log("[finalizeQuote] AI analysis saved successfully");
      } else {
        await updateDoc(aiRef, { ai_analysis: null, ai_status: "FAILED" });
        console.warn("[finalizeQuote] AI analysis failed, quote still finalized");
      }
    } catch (aiErr) {
      console.error("[finalizeQuote] Unexpected AI error:", aiErr);
    }

    // Notify user
    alert(`Quote saved as ${header.quoteNo} (Rev ${nextRev}) and marked as SUBMITTED.`);
    
    // Sanitize quote number for filename
    const safeQuoteNo = (header.quoteNo || "Quote").replace(/[\/\\]/g, "-");
    
    // Copy to clipboard with visual toast
    try {
      await navigator.clipboard.writeText(safeQuoteNo);
    
      const toast = document.createElement("div");
      toast.className = "quote-toast";
      toast.textContent = `Quote number ${safeQuoteNo} copied to clipboard`;
      toast.style.position = "fixed";
      toast.style.bottom = "20px";
      toast.style.right = "20px";
      toast.style.background = "#4caf50";
      toast.style.color = "#fff";
      toast.style.padding = "10px 16px";
      toast.style.borderRadius = "4px";
      toast.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
      toast.style.zIndex = "9999";
      document.body.appendChild(toast);
    
      // Remove toast after 3 seconds or on print
      const removeToast = () => toast.remove();
      setTimeout(removeToast, 3000);
      window.addEventListener("beforeprint", removeToast);
    } catch (clipErr) {
      console.warn("[finalizeQuote] Clipboard copy failed:", clipErr);
    }
    
    // Trigger print dialog
    document.title = safeQuoteNo;
    setTimeout(() => window.print(), 200);

    return savedId;
  } catch (err) {
    console.error("[finalizeQuote] Error:", err);
    alert("Quote saved locally, but cloud save failed.");
    return null;
  } finally {
    finalizeInProgress = false;
  }
}

/* ========================
 * Approve revision
 * =======================*/

export async function approveQuoteRevision(docId) {
  if (!docId) {
    console.warn("[approveQuoteRevision] Missing docId");
    return;
  }

  try {
    const baseRef = doc(db, "quoteHistory", docId);
    const baseSnap = await getDoc(baseRef);
    if (!baseSnap.exists()) {
      alert("Quote not found in Firestore.");
      return;
    }

    const baseData = baseSnap.data();
    const quoteNo = baseData.quoteNo || "UNKNOWN";

    await updateDoc(baseRef, {
      status: "APPROVED",
      statusHistory: [
        ...(baseData.statusHistory || []),
        { status: "APPROVED", date: new Date().toISOString().slice(0, 10) }
      ]
    });

    const revRef = collection(db, "quoteHistory", docId, "revisions");
    const revSnap = await getDocs(revRef);

    let maxRev = 0;
    revSnap.forEach((d) => {
      const data = d.data();
      const rev = Number(data.revision || 0);
      if (rev > maxRev) maxRev = rev;
    });

    const updates = [];
    revSnap.forEach((d) => {
      const data = d.data();
      const rev = Number(data.revision || 0);
      const ref = d.ref;
      const newStatus = rev === maxRev ? "APPROVED" : "MINOR";
      updates.push(updateDoc(ref, { status: newStatus }));
    });

    await Promise.all(updates);
    alert(`Quote ${quoteNo} (Rev ${maxRev}) marked as APPROVED. All older revisions set to MINOR.`);
  } catch (err) {
    console.error("[approveQuoteRevision] Error:", err);
    alert("Failed to update quote status. Please try again.");
  }
}
