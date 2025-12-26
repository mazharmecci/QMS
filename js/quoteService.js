// quoteService.js

import {
  db,
  collection,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  auth,
  getDoc,
  getDocs,
  query,
  where
} from "./firebase.js";   // ✅ adjust path if needed

import { fetchInstruments } from "./instrumentService.js";
;

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

export function buildQuoteObject(existingDoc = null) {
  const { header, instruments, lines } = getQuoteContext();

  let totalValueINR = 0;
  let gstValueINR = 0;

  const items = Array.isArray(lines)
    ? lines.map(line => {
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
      })
    : [];

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
    discount: Number(header.discount || 0),
    totalValueINR,
    gstValueINR,
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

    // ✅ Always mark status as SUBMITTED on finalize
    header.status = "SUBMITTED";

    // Build summary + lineItems (same as before)
    const summary = buildSummaryFromLines(header, instruments, lines);
    const lineItems = buildLineItemsFromCurrentQuote();

    // Determine next revision
    const existing = JSON.parse(localStorage.getItem("quotes") || "[]");
    const sameQuote = existing.filter(q => q.header?.quoteNo === header.quoteNo);
    const lastRev = sameQuote.length ? Math.max(...sameQuote.map(q => Number(q.revision || 1))) : 0;
    const nextRev = lastRev + 1;

    // ✅ Duplicate guard    
    
    /**
     * Check if a quote with the same quoteNo and revision already exists in Firestore.
     * @param {string} quoteNo
     * @param {number} revision
     * @returns {Promise<boolean>} true if duplicate exists
     */
    async function doesQuoteExist(quoteNo, revision) {
      const colRef = collection(db, "quoteHistory");
      const q = query(colRef, where("quoteNo", "==", quoteNo), where("revision", "==", revision));
      const snap = await getDocs(q);
      return !snap.empty;
    }

    // Local history update
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

    // Firestore payload
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
