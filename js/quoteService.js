// quoteService.js

import { fetchInstruments } from "./instrumentService.js";
import {
  db,
  collection,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp
} from "./firebase.js";

/* ========================
 * Local header & context
 * =======================*/

/**
 * Get the current quote header object from localStorage.
 */
export function getQuoteHeaderRaw() {
  return JSON.parse(localStorage.getItem("quoteHeader") || "{}");
}

/**
 * Save the current quote header object to localStorage.
 * @param {object} header
 */
export function saveQuoteHeader(header) {
  localStorage.setItem("quoteHeader", JSON.stringify(header));
}

/**
 * Get instruments master list (from localStorage or Firebase).
 * Ensures each instrument has suppliedCompleteWith field.
 */
export function getInstrumentsMaster() {
  const instruments = JSON.parse(localStorage.getItem("instruments") || "[]");
  return instruments.map(inst => ({
    ...inst,
    suppliedCompleteWith:
      inst.suppliedCompleteWith || inst.suppliedWith || inst.supplied || ""
  }));
}

/**
 * Get the current quote context: instruments + lines.
 * Instruments are fetched from master, lines come from header.quoteLines.
 */
export function getQuoteContext() {
  const instruments = getInstrumentsMaster();
  const header = getQuoteHeaderRaw();
  const lines = Array.isArray(header.quoteLines) ? header.quoteLines : [];
  return { instruments, lines, header };
}

/* ========================
 * Line items & summary
 * =======================*/

/**
 * Build line items from the current quote (for on-screen summary / local history).
 */
export function buildLineItemsFromCurrentQuote() {
  const { instruments, lines } = getQuoteContext();
  const items = [];

  lines.forEach(line => {
    const inst = instruments[line.instrumentIndex] || null;
    if (inst) {
      items.push({
        name: inst.instrumentName || inst.name || "",
        code: inst.catalog || inst.instrumentCode || "",
        type: "Instrument",
        price: Number(inst.unitPrice || 0),
        supplied: inst.suppliedCompleteWith || ""
      });
    }

    (line.configItems || []).forEach(item => {
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

    (line.additionalItems || []).forEach(item => {
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

  return items;
}

/**
 * Build Firestore-friendly quote document from current quote.
 * This is what goes into quoteHistory & its revisions.
 */
export function buildQuoteObject() {
  const header = getQuoteHeaderRaw();
  const { instruments, lines } = getQuoteContext();

  let totalValueINR = 0;
  let gstValueINR = 0;

  const items = lines.map(line => {
    const inst = instruments[line.instrumentIndex] || {};
    const qty = Number(line.quantity || 1);
    const unitPrice = Number(inst.unitPrice || 0);
    const totalPrice = qty * unitPrice;
    totalValueINR += totalPrice;

    const gstPercent = Number(inst.gstPercent || 0);
    const gstAmount = totalPrice * (gstPercent / 100);
    gstValueINR += gstAmount;

    return {
      instrumentCode: inst.instrumentCode || "",
      instrumentName: inst.instrumentName || "",
      description: inst.longDescription || inst.description || "",
      quantity: qty,
      unitPrice,
      totalPrice,
      gstPercent,
      configItems: line.configItems || [],
      additionalItems: line.additionalItems || []
    };
  });

  return {
    quoteNo: header.quoteNo || "",
    quoteDate: header.quoteDate || "",
    // add ref fields so they persist to Firestore
    yourReference: header.yourReference || "",
    refDate: header.refDate || "",
    hospital: {
      name: header.hospitalName || "",
      address: header.hospitalAddress || "",
      contactPerson: header.contactPerson || "",
      email: header.contactEmail || "",
      phone: header.contactPhone || ""
    },
    status: header.status || "Submitted",
    discount: Number(header.discount || 0),
    totalValueINR,
    gstValueINR,
    items,
    salesNote: header.salesNote || "",
    termsHtml: header.termsHtml || "",
    termsText: header.termsText || "",
    createdBy: header.createdBy || "Mazhar R Mecci"
  };
}

/* ========================
 * Validation
 * =======================*/

/**
 * Validate header before finalizing quote.
 * @param {object} header
 * @returns {boolean}
 */
export function validateHeader(header) {
  const errors = [];
  if (!header.quoteNo) errors.push("Quote Number is missing");
  if (!header.quoteDate) errors.push("Quote Date is missing");
  if (!header.hospitalName) errors.push("Hospital Name is missing");
  if (!header.hospitalAddress) errors.push("Hospital Address is missing");

  if (errors.length) {
    alert("Validation errors:\n" + errors.join("\n"));
    return false;
  }
  return true;
}

/* ========================
 * Firestore persistence
 * =======================*/

/**
 * Internal: write the "active" quote document in quoteHistory.
 * If docId is provided, update that doc; otherwise create a new one.
 * Does NOT handle revisions subcollection; caller passes revision. [web:42][web:58]
 */
async function saveBaseQuoteDocToFirestore(docId, data) {
  console.log("[saveBaseQuoteDocToFirestore] docId:", docId);

  if (docId) {
    const ref = doc(db, "quoteHistory", docId);
    await updateDoc(ref, {
      ...data,
      updatedAt: serverTimestamp()
    });
    console.log("[saveBaseQuoteDocToFirestore] updated doc:", docId);
    return docId;
  }

  const colRef = collection(db, "quoteHistory");
  const newDoc = await addDoc(colRef, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  console.log("[saveBaseQuoteDocToFirestore] created new doc:", newDoc.id);
  return newDoc.id;
}

/**
 * Internal: append a snapshot into quoteHistory/{docId}/revisions.
 */
async function appendRevisionSnapshot(docId, data) {
  console.log("[appendRevisionSnapshot] for docId:", docId);
  const subCol = collection(db, "quoteHistory", docId, "revisions");
  await addDoc(subCol, {
    ...data,
    createdAt: serverTimestamp()
  });
  console.log("[appendRevisionSnapshot] snapshot written");
}

/* ========================
 * Finalization & local history
 * =======================*/

/**
 * Finalize the current quote: compute totals, local revision, and save
 * to both local history and Firestore, with Firestore revision history.
 *
 * @param {string|null} docId - existing quoteHistory document id when editing,
 *                              or null/undefined for a brand new quote.
 */
export async function finalizeQuote(docId = null) {
  console.log("[finalizeQuote] CALLED with docId:", docId, "at", new Date().toISOString());

  const header = getQuoteHeaderRaw();
  console.log("[finalizeQuote] header.quoteNo:", header.quoteNo);

  if (!validateHeader(header)) return;

  const { instruments, lines } = getQuoteContext();
  if (!lines.length) {
    alert("No instruments in this quote. Please add at least one instrument.");
    return;
  }

  // Totals for local summary
  let itemsTotal = 0;
  lines.forEach(line => {
    const inst = instruments[line.instrumentIndex] || null;
    if (inst) {
      const qty = Number(line.quantity || 1);
      itemsTotal += Number(inst.unitPrice || 0) * qty;
    }
    (line.additionalItems || []).forEach(item => {
      const qtyNum = Number(item.qty || 1);
      const unitNum = Number(item.price || item.unitPrice || 0);
      itemsTotal += qtyNum * unitNum;
    });
  });

  const gstPercent = 18;
  const discount = Number(header.discount || 0);
  const afterDisc = itemsTotal - discount;
  const gstAmount = (afterDisc * gstPercent) / 100;
  const totalValue = afterDisc + gstAmount;
  const roundedTotal = Math.round(totalValue);

  const summary = {
    itemsTotal,
    discount,
    afterDiscount: afterDisc,
    freight: "Included",
    gstPercent,
    gstAmount,
    totalValue,
    roundOff: roundedTotal - totalValue
  };

  const lineItems = buildLineItemsFromCurrentQuote();

  // Local revision history
  const existing = JSON.parse(localStorage.getItem("quotes") || "[]");
  const sameQuote = existing.filter(
    q => q.header && q.header.quoteNo === header.quoteNo
  );
  const lastRev = sameQuote.length
    ? Math.max(...sameQuote.map(q => Number(q.revision || 1)))
    : 0;
  const nextRev = lastRev + 1;

  console.log("[finalizeQuote] sameQuote.length:", sameQuote.length, "lastRev:", lastRev, "nextRev:", nextRev);

  const now = new Date();
  const quoteLocal = {
    header,
    lineItems,
    summary,
    quoteNo: header.quoteNo,
    revision: nextRev,
    status: "submitted",
    history: [
      {
        status: "submitted",
        date: now.toISOString().slice(0, 10),
        time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ]
  };

  existing.push(quoteLocal);
  localStorage.setItem("quotes", JSON.stringify(existing));
  console.log("[finalizeQuote] local history updated, total entries:", existing.length);

  // Firestore payload
  const baseQuoteDoc = buildQuoteObject();
  const firestoreData = {
    ...baseQuoteDoc,
    revision: nextRev,
    localSummary: summary
  };

  try {
    console.log("[finalizeQuote] saving base doc to Firestore...");
    const savedId = await saveBaseQuoteDocToFirestore(docId, firestoreData);
    console.log("[finalizeQuote] base doc saved with id:", savedId);

    console.log("[finalizeQuote] appending revision snapshot...");
    await appendRevisionSnapshot(savedId, firestoreData);
    console.log("[finalizeQuote] revision snapshot completed");

    alert(
      `Quote saved as ${header.quoteNo} (Rev ${nextRev}) with full revision history.`
    );
    return savedId;
  } catch (err) {
    console.error("[finalizeQuote] Error saving quote to Firestore:", err);
    alert(
      `Quote saved to local history as ${header.quoteNo} (Rev ${nextRev}), but cloud save failed.`
    );
    return null;
  }
}
