// quoteService.js

import { fetchInstruments } from "./instrumentService.js";
import {
  db,
  collection,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  auth   // ✅ use the initialized auth instance
} from "./firebase.js";

/* ========================
 * Local header & context
 * =======================*/

/**
 * Get the current quote header object from localStorage.
 */
export function getQuoteHeaderRaw() {
  try {
    return JSON.parse(localStorage.getItem("quoteHeader") || "{}");
  } catch (err) {
    console.error("[getQuoteHeaderRaw] Failed to parse quoteHeader:", err);
    return {};
  }
}

/**
 * Save the current quote header object to localStorage.
 * @param {object} header
 */
export function saveQuoteHeader(header) {
  try {
    localStorage.setItem("quoteHeader", JSON.stringify(header));
    console.log("[saveQuoteHeader] Header saved locally.");
  } catch (err) {
    console.error("[saveQuoteHeader] Failed to save header:", err);
  }
}

/**
 * Get instruments master list (from localStorage or Firebase).
 * Ensures each instrument has suppliedCompleteWith field.
 */
export function getInstrumentsMaster() {
  try {
    const instruments = JSON.parse(localStorage.getItem("instruments") || "[]");
    return instruments.map(inst => ({
      ...inst,
      suppliedCompleteWith:
        inst.suppliedCompleteWith || inst.suppliedWith || inst.supplied || ""
    }));
  } catch (err) {
    console.error("[getInstrumentsMaster] Failed to parse instruments:", err);
    return [];
  }
}

/**
 * Get the current quote context: instruments + lines + header.
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

  console.log("[buildLineItemsFromCurrentQuote] Built", items.length, "items.");
  return items;
}

/* ========================
 * Firestore-friendly object
 * =======================*/

/**
 * Build Firestore-friendly quote document from current quote.
 * This is what goes into quoteHistory & its revisions.
 */
export function buildQuoteObject(existingDoc = null) {
  const { header, instruments, lines } = getQuoteContext();

  let totalValueINR = 0;
  let gstValueINR = 0;

  const items = Array.isArray(lines) ? lines.map(line => {
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
      configItems: Array.isArray(line.configItems) ? line.configItems : [],
      additionalItems: Array.isArray(line.additionalItems) ? line.additionalItems : []
    };
  }) : [];

  const user = auth.currentUser;
  const createdByUid = user ? user.uid : null;

  return {
    // identifiers
    quoteNo: header.quoteNo || "",
    quoteDate: header.quoteDate || "",

    // reference fields
    yourReference: header.yourReference || "",
    refDate: header.refDate || "",

    // hospital details
    hospital: {
      name: header.hospitalName || "",
      address: header.hospitalAddress || "",
      contactPerson: header.contactPerson || "",
      email: header.contactEmail || "",
      phone: header.contactPhone || "",
      officePhone: header.officePhone || ""
    },

    // status and financials
    status: header.status || "Submitted",
    discount: Number(header.discount || 0),
    totalValueINR,
    gstValueINR,

    // line items (always present, even if empty)
    items,

    // notes and terms
    salesNote: header.salesNote || "",
    termsHtml: header.termsHtml || "",
    termsText: header.termsText || "",

    // Firestore audit fields
    createdBy: existingDoc?.createdBy || createdByUid
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

    // Optional: validate numeric fields
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
    console.log("[saveBaseQuoteDocToFirestore] docId:", docId);
    console.log("[saveBaseQuoteDocToFirestore] payload.createdBy:", data.createdBy);

    if (!data.createdBy) {
      console.warn(
        "[saveBaseQuoteDocToFirestore] createdBy is missing; Firestore rules may reject this."
      );
    }

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
  } catch (err) {
    console.error("[saveBaseQuoteDocToFirestore] Error writing to Firestore:", err);
    alert("Cloud save failed. Quote saved locally, but not in Firestore.");
    return null;
  }
}

async function appendRevisionSnapshot(docId, data) {
  try {
    console.log("[appendRevisionSnapshot] for docId:", docId);
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

export async function finalizeQuote(rawArg = null) {
  if (finalizeInProgress) {
    console.warn("[finalizeQuote] blocked: already in progress.");
    return;
  }
  finalizeInProgress = true;

  let docId = null;
  if (typeof rawArg === "string") {
    docId = rawArg;
  } else if (rawArg && typeof rawArg === "object" && rawArg.target) {
    console.warn("[finalizeQuote] called with PointerEvent; treating as new quote (docId = null).");
  }

  console.log("[finalizeQuote] CALLED with rawArg:", rawArg, "normalized docId:", docId, "at", new Date().toISOString());

  try {
    const user = auth.currentUser;
    console.log("[finalizeQuote] auth.currentUser:", user);

    if (!user) {
      alert("You must be signed in to finalize quotes.");
      return null;
    }

    const header = getQuoteHeaderRaw();
    console.log("[finalizeQuote] header.quoteNo:", header.quoteNo);

    // Validate header before proceeding
    if (!validateHeader(header)) {
      return null;
    }

    const { instruments, lines } = getQuoteContext();
    if (!Array.isArray(lines) || !lines.length) {
      alert("No instruments in this quote. Please add at least one instrument.");
      return null;
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
    const sameQuote = existing.filter(q => q.header && q.header.quoteNo === header.quoteNo);
    const lastRev = sameQuote.length ? Math.max(...sameQuote.map(q => Number(q.revision || 1))) : 0;
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
      localSummary: summary,
      createdBy: baseQuoteDoc.createdBy || user.uid,
      createdByLabel: user.displayName || user.email || user.uid
    };

    console.log("[finalizeQuote] firestoreData.createdBy:", firestoreData.createdBy);

    const savedId = await saveBaseQuoteDocToFirestore(docId, firestoreData);
    console.log("[finalizeQuote] base doc saved with id:", savedId);

    if (savedId) {
      console.log("[finalizeQuote] appending revision snapshot...");
      await appendRevisionSnapshot(savedId, firestoreData);
      console.log("[finalizeQuote] revision snapshot completed");

      alert(`Quote saved as ${header.quoteNo} (Rev ${nextRev}) with full revision history.`);
      return savedId;
    } else {
      alert("Quote saved to local history, but cloud save failed. Please try again later.");
      return null;
    }
  } catch (err) {
    console.error("[finalizeQuote] Error saving quote to Firestore:", err);
    alert("Quote saved to local history, but cloud save failed. Please try again later.");
    return null;
  } finally {
    finalizeInProgress = false;
  }
}
