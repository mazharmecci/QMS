// quoteService.js

import { fetchInstruments } from "./instrumentService.js";
import {
  db,
  collection,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  auth
} from "./firebase.js";

/* ========================
 * Local header & context
 * =======================*/

export function getQuoteHeaderRaw() {
  return JSON.parse(localStorage.getItem("quoteHeader") || "{}");
}

// ✅ Refactored saveQuoteHeader: captures DOM, preserves kindAttn, saves to localStorage + Firestore
export async function saveQuoteHeader(header, docId = null) {
  if (!header || typeof header !== "object") return;

  const getEl = (id) => document.getElementById(id);

  header.quoteNo       = getEl("metaQuoteNo")?.textContent || header.quoteNo || "";
  header.quoteDate     = getEl("metaQuoteDate")?.textContent || header.quoteDate || "";
  header.yourReference = getEl("metaYourRef")?.textContent || header.yourReference || "";
  header.refDate       = getEl("metaRefDate")?.textContent || header.refDate || "";

  header.hospitalName  = getEl("toHospitalNameLine")?.textContent || header.hospitalName || "";
  header.hospitalAddress =
    (getEl("toHospitalAddressLine1")?.textContent || "") + "," +
    (getEl("toHospitalAddressLine2")?.textContent || header.hospitalAddress?.split(",")[1] || "");

  header.contactPerson = getEl("metaContactPerson")?.textContent || header.contactPerson || "";
  header.contactPhone  = getEl("metaPhone")?.textContent || header.contactPhone || "";
  header.contactEmail  = getEl("metaEmail")?.textContent || header.contactEmail || "";
  header.officePhone   = getEl("metaOffice")?.textContent || header.officePhone || "";

  // ✅ FIXED: Kind Attn is read from its own DOM field, not contactPerson
  const toAttnEl = getEl("toAttn");
  if (toAttnEl) {
    const attnText = toAttnEl.textContent?.trim();
    header.kindAttn = attnText || header.kindAttn || "";
  }

  header.salesNote = getEl("salesNoteBlock")?.textContent || header.salesNote || "";

  const termsEl = getEl("termsTextBlock");
  if (termsEl) {
    header.termsHtml = termsEl.innerHTML;
    header.termsText = termsEl.innerText;
  }

  // Save to localStorage
  localStorage.setItem("quoteHeader", JSON.stringify(header));
  console.log("[saveQuoteHeader] Header saved to localStorage:", header);

  // Save to Firestore
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in user; cannot save to Firestore.");

    const firestoreData = {
      ...header,
      updatedAt: serverTimestamp(),
      createdBy: user.uid,
      createdByLabel: user.displayName || user.email || user.uid
    };

    if (docId || typeof window.currentQuoteDocId !== "undefined") {
      const ref = doc(db, "quoteHistory", docId || window.currentQuoteDocId);
      await setDoc(ref, firestoreData, { merge: true });
      console.log("[saveQuoteHeader] Header also saved to Firestore:", docId || window.currentQuoteDocId);
    } else {
      const colRef = collection(db, "quoteHistory");
      const newDoc = await addDoc(colRef, {
        ...firestoreData,
        createdAt: serverTimestamp()
      });
      window.currentQuoteDocId = newDoc.id;
      console.log("[saveQuoteHeader] New Firestore doc created:", newDoc.id);
    }
  } catch (err) {
    console.error("[saveQuoteHeader] Error saving header to Firestore:", err);
  }
}

export function getInstrumentsMaster() {
  const instruments = JSON.parse(localStorage.getItem("instruments") || "[]");
  return instruments.map(inst => ({
    ...inst,
    suppliedCompleteWith:
      inst.suppliedCompleteWith || inst.suppliedWith || inst.supplied || ""
  }));
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

/* ========================
 * Quote object (pure)
 * =======================*/

export function buildQuoteObject() {
  const rawHeader = getQuoteHeaderRaw() || {};
  const { instruments, lines } = getQuoteContext();

  const header = {
    quoteNo: rawHeader.quoteNo || "",
    quoteDate: rawHeader.quoteDate || "",
    yourReference: rawHeader.yourReference || "",
    refDate: rawHeader.refDate || "",
    hospitalName: rawHeader.hospitalName || "",
    hospitalAddress: rawHeader.hospitalAddress || "",
    contactPerson: rawHeader.contactPerson || "",
    contactEmail: rawHeader.contactEmail || "",
    contactPhone: rawHeader.contactPhone || "",
    officePhone: rawHeader.officePhone || "",
    kindAttn: rawHeader.kindAttn || "",   // ✅ FIXED: include Kind Attn
    status: rawHeader.status || "Submitted",
    discount: Number(rawHeader.discount || 0),
    salesNote: rawHeader.salesNote || "",
    termsHtml: rawHeader.termsHtml || "",
    termsText: rawHeader.termsText || ""
  };

  let totalValueINR = 0;
  let gstValueINR = 0;

  const items = (lines || []).map(line => {
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
    quoteNo: header.quoteNo,
    quoteDate: header.quoteDate,
    yourReference: header.yourReference,
    refDate: header.refDate,
    hospital: {
      name: header.hospitalName,
      address: header.hospitalAddress,
      contactPerson: header.contactPerson,
      email: header.contactEmail,
      phone: header.contactPhone,
      officePhone: header.officePhone
    },
    kindAttn: header.kindAttn,   // ✅ FIXED: persist Kind Attn
    status: header.status,
    discount: header.discount,
    totalValueINR,
    gstValueINR,
    items,
    salesNote: header.salesNote,
    termsHtml: header.termsHtml,
    termsText: header.termsText
    // createdBy / createdByLabel injected at save time
  };
}

/* ========================
 * Validation
 * =======================*/

export function validateHeader(header) {
  const errors = [];
  if (!header.quoteNo) errors.push("Quote Number is missing");
  if (!header.quoteDate) errors.push("Quote Date is missing");
  if (!header.hospitalName) errors.push("Hospital Name is missing");
  if (!header.hospitalAddress) errors.push("Hospital Address is missing");
  if (!header.kindAttn) errors.push("Kind Attn is missing");   // ✅ ensure Kind Attn is validated

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

async function appendRevisionSnapshot(docId, data) {
  console.log("[appendRevisionSnapshot] for docId:", docId);
  const subCol = collection(db, "quoteHistory", docId, "revisions");

  const user = auth.currentUser;
  if (!user) {
    throw new Error("No signed-in user; cannot append revision.");
  }

  await addDoc(subCol, {
    ...data,
    createdBy: user.uid,
    createdByLabel: user.displayName || user.email || user.uid,
    createdAt: serverTimestamp()
  });
  console.log("[appendRevisionSnapshot] snapshot written");
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

  console.log("[finalizeQuote] CALLED with rawArg:", rawArg, "normalized docId:", docId);

  try {
    const header = getQuoteHeaderRaw();
    console.log("[finalizeQuote] header.quoteNo:", header.quoteNo);

    if (!validateHeader(header)) return;

    const { instruments, lines } = getQuoteContext();
    if (!lines.length) {
      alert("No instruments in this quote. Please add at least one instrument.");
      return;
    }

    // --- Calculate totals ---
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
    const discount   = Number(header.discount || 0);
    const afterDisc  = itemsTotal - discount;
    const gstAmount  = (afterDisc * gstPercent) / 100;
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

    // --- Local history ---
    const existing = JSON.parse(localStorage.getItem("quotes") || "[]");
    const sameQuote = existing.filter(q => q.header && q.header.quoteNo === header.quoteNo);
    const lastRev   = sameQuote.length ? Math.max(...sameQuote.map(q => Number(q.revision || 1))) : 0;
    const nextRev   = lastRev + 1;

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

    // --- Firestore persistence ---
    const baseQuoteDoc = buildQuoteObject();
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No signed-in user; cannot save to Firestore.");
    }

    const firestoreData = {
      ...baseQuoteDoc,
      revision: nextRev,
      localSummary: summary,
      createdBy: user.uid,
      createdByLabel: user.displayName || user.email || user.uid
    };

    console.log("[finalizeQuote] saving base doc to Firestore...");
    const savedId = await saveBaseQuoteDocToFirestore(docId, firestoreData);
    console.log("[finalizeQuote] base doc saved with id:", savedId);

    console.log("[finalizeQuote] appending revision snapshot...");
    await appendRevisionSnapshot(savedId, firestoreData);
    console.log("[finalizeQuote] revision snapshot completed");

    alert(`Quote saved as ${header.quoteNo} (Rev ${nextRev}) with full revision history.`);
    return savedId;
  } catch (err) {
    console.error("[finalizeQuote] Error saving quote to Firestore:", err);
    alert("Quote saved to local history, but cloud save failed. Please try again later.");
    return null;
  } finally {
    finalizeInProgress = false;
  }
}
