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
 * Pricing / summary helper
 * =======================*/

function computeQuoteSummary({ header, instruments, lines }) {
  const safeLines = Array.isArray(lines) ? lines : [];
  const safeInstruments = Array.isArray(instruments) ? instruments : [];

  // 1) Items total
  let itemsTotal = 0;

  safeLines.forEach(line => {
    const inst = safeInstruments[line.instrumentIndex] || null;
    const qty = Number(line.quantity || 1);

    // Instrument line
    if (inst) {
      const unitPrice = Number(inst.unitPrice || 0);
      itemsTotal += qty * unitPrice;
    }

    // Additional items
    (line.additionalItems || []).forEach(item => {
      const addQty = Number(item.qty || 1);
      const addUnit =
        item.price != null
          ? Number(item.price)
          : Number(item.unitPrice || item.upInr || item.tpInr || 0);
      itemsTotal += addQty * addUnit;
    });

    // Config items (if billable)
    (line.configItems || []).forEach(item => {
      const cfgQty = Number(item.qty || 1);
      const cfgUnit =
        item.tpInr != null ? Number(item.tpInr) : Number(item.upInr || 0);
      itemsTotal += cfgQty * cfgUnit;
    });
  });

  // 2) Discount clamp
  const rawDiscount = Number(header?.discount || 0);
  const discount = Math.max(0, Math.min(rawDiscount, itemsTotal));

  // 3) After discount
  const afterDiscount = itemsTotal - discount;

  // 4) GST
  const gstPercent =
    header?.gstPercent != null ? Number(header.gstPercent) : 18;
  const gstAmount = (afterDiscount * gstPercent) / 100;

  // 5) Total & rounding (normal rounding to nearest rupee)
  const totalValue = afterDiscount + gstAmount;
  const roundedTotal = Math.round(totalValue);
  const roundOff = roundedTotal - totalValue;

  return {
    itemsTotal,
    discount,
    afterDiscount,
    freight: "Included",
    gstPercent,
    gstAmount,
    totalValue,
    roundOff,
    grandTotal: roundedTotal
  };
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

export function getQuoteContext() {
  const instruments = getInstrumentsMaster();
  const header = getQuoteHeaderRaw();
  const lines = Array.isArray(header.quoteLines) ? header.quoteLines : [];
  return { instruments, lines, header };
}

/* ========================
 * Line items & summary
 * =======================*/

export function buildLineItemsFromCurrentQuote() {
  const { instruments, lines } = getQuoteContext();
  const items = [];

  (Array.isArray(lines) ? lines : []).forEach(line => {
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

export function buildQuoteObject(existingDoc = null) {
  const { header, instruments, lines } = getQuoteContext();

  const summary = computeQuoteSummary({ header, instruments, lines });

  const safeLines = Array.isArray(lines) ? lines : [];
  const safeInstruments = Array.isArray(instruments) ? instruments : [];

  const items = safeLines.map(line => {
    const inst = safeInstruments[line.instrumentIndex] || {};
    const qty = Number(line.quantity || 1);
    const unitPrice = Number(inst.unitPrice || 0);
    const totalPrice = qty * unitPrice;
    const gstPercent = Number(inst.gstPercent || summary.gstPercent || 0);

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
  });

  const user = auth.currentUser;
  const createdByUid = user ? user.uid : null;

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
      officePhone: header.officePhone || ""
    },
    status: header.status || "Submitted",
    // aligned totals
    discount: summary.discount,
    itemsTotal: summary.itemsTotal,
    afterDiscount: summary.afterDiscount,
    gstPercent: summary.gstPercent,
    gstAmount: summary.gstAmount,
    totalValue: summary.totalValue,
    roundOff: summary.roundOff,
    grandTotal: summary.grandTotal,
    items,
    salesNote: header.salesNote || "",
    termsHtml: header.termsHtml || "",
    termsText: header.termsText || "",
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

  let docId = typeof rawArg === "string" ? rawArg : null;

  try {
    const user = auth.currentUser;
    if (!user) {
      alert("You must be signed in to finalize quotes.");
      return null;
    }

    const header = getQuoteHeaderRaw();
    if (!validateHeader(header)) return null;

    const { instruments, lines } = getQuoteContext();
    if (!Array.isArray(lines) || !lines.length) {
      alert("No instruments in this quote. Please add at least one instrument.");
      return null;
    }

    header.status = "SUBMITTED";

    // unified summary calculation
    const summary = computeQuoteSummary({ header, instruments, lines });

    const lineItems = buildLineItemsFromCurrentQuote();

    const existing = JSON.parse(localStorage.getItem("quotes") || "[]");
    const sameQuote = existing.filter(q => q.header?.quoteNo === header.quoteNo);
    const lastRev = sameQuote.length
      ? Math.max(...sameQuote.map(q => Number(q.revision || 1)))
      : 0;
    const nextRev = lastRev + 1;

    const now = new Date();
    const quoteLocal = {
      header,
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

    const baseQuoteDoc = buildQuoteObject();
    const firestoreData = {
      ...baseQuoteDoc,
      revision: nextRev,
      localSummary: summary,
      status: "SUBMITTED",
      statusHistory: [
        ...(baseQuoteDoc.statusHistory || []),
        { status: "SUBMITTED", date: now.toISOString().slice(0, 10) }
      ],
      createdBy: baseQuoteDoc.createdBy || user.uid,
      createdByLabel: user.displayName || user.email || user.uid
    };

    const savedId = await saveBaseQuoteDocToFirestore(docId, firestoreData);
    if (!savedId) return null;

    await appendRevisionSnapshot(savedId, firestoreData);

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
    console.log("[approveQuoteRevision] Base quote marked APPROVED");

    const revRef = collection(db, "quoteHistory", docId, "revisions");
    const revSnap = await getDocs(revRef);

    let maxRev = 0;

    revSnap.forEach(d => {
      const data = d.data();
      const rev = Number(data.revision || 0);
      if (rev > maxRev) {
        maxRev = rev;
      }
    });

    const updates = [];
    revSnap.forEach(d => {
      const data = d.data();
      const rev = Number(data.revision || 0);
      const ref = d.ref;
      const newStatus = rev === maxRev ? "APPROVED" : "MINOR";
      updates.push(updateDoc(ref, { status: newStatus }));
    });

    await Promise.all(updates);
    console.log("[approveQuoteRevision] Revisions updated: APPROVED + MINOR");

    alert(`Quote ${quoteNo} (Rev ${maxRev}) marked as APPROVED. All older revisions set to MINOR.`);
  } catch (err) {
    console.error("[approveQuoteRevision] Error:", err);
    alert("Failed to update quote status. Please try again.");
  }
}
