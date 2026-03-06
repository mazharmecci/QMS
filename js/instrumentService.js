// instrumentService.js
import {
  db,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs
} from "./firebase.js";

const instrumentsRef = collection(db, "instruments");

// Helpers
function parseNumber(value) {
  const cleaned = String(value ?? "").replace(/[^\d.-]/g, "");
  return Number(cleaned || 0);
}

function normalizeInstrument(raw = {}) {
  return {
    ...raw,
    unitPrice: parseNumber(raw.unitPrice),
    gstPercent: parseNumber(raw.gstPercent)
  };
}

/**
 * Internal helper: refresh instruments from Firestore into localStorage.
 */
async function refreshInstrumentCache() {
  try {
    const snapshot = await getDocs(instrumentsRef);
    const list = snapshot.docs.map(d =>
      normalizeInstrument({ id: d.id, ...d.data() })
    );
    localStorage.setItem("instruments", JSON.stringify(list));
    return list;
  } catch (err) {
    console.error("[instrumentService] Failed to refresh cache:", err);
    return [];
  }
}

/**
 * Fetch all instruments from Firestore and mirror into localStorage.
 * Use this at app init or when you need a fresh list.
 */
export async function fetchInstruments() {
  try {
    const list = await refreshInstrumentCache();
    return list;
  } catch (err) {
    // Should rarely hit, but keep a localStorage fallback.
    console.error(
      "[instrumentService] Error fetching instruments, falling back to localStorage:",
      err
    );
    const cached = JSON.parse(localStorage.getItem("instruments") || "[]");
    return cached.map(normalizeInstrument);
  }
}

/**
 * Add a new instrument and return its Firestore ID.
 */
export async function addInstrument(instrument) {
  try {
    const payload = {
      ...normalizeInstrument(instrument),
      createdAt: new Date().toISOString()
    };
    const docRef = await addDoc(instrumentsRef, payload);
    await refreshInstrumentCache();
    return docRef.id;
  } catch (err) {
    console.error("[instrumentService] Error adding instrument:", err);
    throw err;
  }
}

/**
 * Update an existing instrument by ID.
 */
export async function updateInstrument(id, instrument) {
  if (!id) {
    console.error("[instrumentService] updateInstrument called without a valid ID");
    return;
  }
  try {
    const payload = {
      ...normalizeInstrument(instrument),
      updatedAt: new Date().toISOString()
    };
    await updateDoc(doc(db, "instruments", id), payload);
    await refreshInstrumentCache();
  } catch (err) {
    console.error("[instrumentService] Error updating instrument:", err);
    throw err;
  }
}

/**
 * Delete an instrument by ID.
 */
export async function deleteInstrument(id) {
  if (!id) {
    console.error("[instrumentService] deleteInstrument called without a valid ID");
    return;
  }
  try {
    await deleteDoc(doc(db, "instruments", id));
    await refreshInstrumentCache();
  } catch (err) {
    console.error("[instrumentService] Error deleting instrument:", err);
    throw err;
  }
}
