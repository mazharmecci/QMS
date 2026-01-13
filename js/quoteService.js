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

const AI_BASE_URL = "https://ai.istosmedical.com"; // production

let finalizeInProgress = false;

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

    const res = await fetch(`${AI_BASE_URL}/analyze-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error("AI service call failed");

    return await res.json();
  } catch (err) {
    console.error("[callAIService] Error:", err);
    return null;
  }
}

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
    quoteDate: header.quoteDate || "",
    yourReference: header.yourReference || "",
    refDate: header.refDate || "",
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
 * Firestore Persistence
 * =======================*/

/**
 * Save or update a quote document in Firestore.
 */
async function saveBaseQuoteDocToFirestore(docId, data) {
  try {
    if (docId) {
      const ref = doc(db, "quoteHistory", docId);
      await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
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
    console.error("[saveBaseQuoteDocToFirestore] Error:", err);
    alert("Cloud save failed. Quote saved locally, but not in Firestore.");
    return null;
  }
}

/**
 * Append a revision snapshot to the quote's revisions sub-collection.
 */
async function appendRevisionSnapshot(docId, data) {
  try {
    const subCol = collection(db, "quoteHistory", docId, "revisions");
    await addDoc(subCol, { ...data, createdAt: serverTimestamp() });
    console.log("[appendRevisionSnapshot] Snapshot written");
  } catch (err) {
    console.error("[appendRevisionSnapshot] Error:", err);
  }
}

/* ========================
 * AI Analysis
 * =======================*/

/**
 * Run AI analysis on a quote and persist results in Firestore.
 */
async function runAIAnalysis(quoteObj, docId) {
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

    const aiResult = await res.json();
    await updateDoc(doc(db, "quoteHistory", docId), {
      ai_analysis: aiResult,
      ai_status: "SUCCESS"
    });
    console.log("[runAIAnalysis] AI analysis saved successfully");
  } catch (err) {
    console.error("[runAIAnalysis] Error:", err);
    try {
      await updateDoc(doc(db, "quoteHistory", docId), {
        ai_analysis: null,
        ai_status: "FAILED"
      });
      console.warn("[runAIAnalysis] AI analysis failed, quote still finalized");
    } catch (updateErr) {
      console.error("[runAIAnalysis] Failed to mark AI status:", updateErr);
    }
  }
}

/* ========================
 * Local Revision
 * =======================*/

/**
 * Save a local revision of the quote in browser storage.
 */
function saveLocalRevision(header, enrichedLines, lineItems, summary) {
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

  return { nextRev, now };
}

/**
 * Save a revision snapshot in Firestore.
 */
async function saveFirestoreRevision(docId, baseQuoteDoc, summary, nextRev, now) {
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
  return savedId;
}

/* ========================
 * PDF Generation
 * =======================*/

/**
 * Generate and download a professional PDF of the quote.
 */
function generateAndDownloadPdf(header, nextRev, summary, lineItems, now) {
  try {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error("jsPDF not loaded. Check script tag in HTML.");
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4" });

    const {
      itemsTotal: subtotal,
      discount,
      gstPercent,
      gstAmount: gstValueINR,
      totalValue: totalValueINR
    } = summary;

    const marginLeft = 15;
    const marginTop = 20;
    const lineHeight = 6;
    const pageWidth = 210;
    const usableWidth = pageWidth - marginLeft * 2;
    const maxY = 280;
    let y = marginTop;

    const drawSeparator = y => {
      pdf.setDrawColor(180);
      pdf.line(marginLeft, y, pageWidth - marginLeft, y);
      return y + 2;
    };

    const addWrappedText = (text, x, yStart, options = {}) => {
      const maxWidth = options.maxWidth || usableWidth;
      const lines = pdf.splitTextToSize(String(text || ""), maxWidth);
      lines.forEach(line => {
        pdf.text(line, x, y);
        y += lineHeight;
      });
      return y;
    };

    const rightAlignText = (label, value, y) => {
      pdf.text(label, marginLeft, y);
      pdf.text(value, pageWidth - marginLeft - pdf.getTextWidth(value), y);
    };

    const renderItemTable = (items, startY) => {
      const colWidths = [10, 30, 110, 40];
      const headers = ["#", "Code", "Instrument", "Price"];
      const rowHeight = 8;
      let y = startY;

      pdf.setFont("helvetica", "bold");
      headers.forEach((text, i) => {
        const x = marginLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
        pdf.text(text, x, y);
      });
      y += rowHeight;

      pdf.setFont("helvetica", "normal");
      items.forEach((item, idx) => {
        if (y > maxY - rowHeight) {
          pdf.addPage();
          y = marginTop;
        }
        const row = [
          `${idx + 1}`,
          item.code || "",
          item.name || "",
          `₹${item.price.toLocaleString()}`
        ];
        row.forEach((text, i) => {
          const x = marginLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
          pdf.text(text, x, y);
        });
        y += rowHeight;
      });

      return y;
    };

    // Title
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text(`Quote: ${header.quoteNo} (Rev ${nextRev})`, marginLeft, y);
    y += lineHeight * 2;

    // Header
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Date: ${header.quoteDate || now.toISOString().slice(0, 10)}`, marginLeft, y);
    y += lineHeight;
    y = addWrappedText(`Hospital: ${header.hospitalName}`, marginLeft, y);
    y = addWrappedText(`Address: ${header.hospitalAddress || ""}`, marginLeft, y);
    y = addWrappedText(`Contact: ${header.contactPerson || ""}`, marginLeft, y);
    y = drawSeparator(y);

    // Summary (continued)
    rightAlignText("Discount:", `₹${discount.toLocaleString()}`, y); 
    y += lineHeight;

    rightAlignText(`GST (${gstPercent}%):`, `₹${gstValueINR.toLocaleString()}`, y); 
    y += lineHeight;

    pdf.setFont("helvetica", "bold");
    rightAlignText("TOTAL:", `₹${totalValueINR.toLocaleString()}`, y); 
    y += lineHeight * 2;

    y = drawSeparator(y);

    // Items
    pdf.setFontSize(12);
    pdf.text("Items", marginLeft, y);
    y += lineHeight;

    pdf.setFontSize(10);
    y = renderItemTable(lineItems, y);
    y = drawSeparator(y);

    // Sales Note
    if (header.salesNote) {
      if (y > maxY - 20) {
        pdf.addPage();
        y = marginTop;
      }
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text("Sales Note", marginLeft, y);
      y += lineHeight;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      y = addWrappedText(header.salesNote, marginLeft, y);
      y = drawSeparator(y);
    }

    // Footer
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "italic");
    pdf.text("ISTOS MEDICAL | www.istosmedical.com | +91-XXXXXXXXXX", marginLeft, 290);

    // Save
    const safeQuoteNo = (header.quoteNo || "QUOTE")
      .toString()
      .replace(/[^a-zA-Z0-9_\-]/g, "_");

    pdf.save(`${safeQuoteNo}.pdf`);
  } catch (err) {
    console.error("[generateAndDownloadPdf] Error:", err);
  }
}

/* ========================
 * Finalization
 * =======================*/

/**
 * Finalize a quote: validate, persist locally & in Firestore, run AI analysis, and generate PDF.
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

    // Save locally
    const { nextRev, now } = saveLocalRevision(header, enrichedLines, lineItems, summary);

    // Save in Firestore
    const baseQuoteDoc = buildQuoteObject();
    const savedId = await saveFirestoreRevision(docId, baseQuoteDoc, summary, nextRev, now);
    if (!savedId) return null;

    // Run AI analysis
    await runAIAnalysis(baseQuoteDoc, savedId);

    // Generate PDF
    generateAndDownloadPdf(header, nextRev, summary, lineItems, now);

    alert(`Quote saved as ${header.quoteNo} (Rev ${nextRev}) and marked as SUBMITTED.`);
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

