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
 * Fetch all instruments from Firestore and mirror into localStorage.
 */
export async function fetchInstruments() {
  try {
    const snapshot = await getDocs(instrumentsRef);
    const list = snapshot.docs.map(d =>
      normalizeInstrument({ id: d.id, ...d.data() })
    );
    localStorage.setItem("instruments", JSON.stringify(list));
    return list;
  } catch (err) {
    console.error("Error fetching instruments, falling back to localStorage:", err);
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
    return docRef.id;
  } catch (err) {
    console.error("Error adding instrument:", err);
    throw err;
  }
}

/**
 * Update an existing instrument by ID.
 */
export async function updateInstrument(id, instrument) {
  if (!id) {
    console.error("updateInstrument called without a valid ID");
    return;
  }
  try {
    const payload = {
      ...normalizeInstrument(instrument),
      updatedAt: new Date().toISOString()
    };
    await updateDoc(doc(db, "instruments", id), payload);
  } catch (err) {
    console.error("Error updating instrument:", err);
    throw err;
  }
}

/**
 * Delete an instrument by ID.
 */
export async function deleteInstrument(id) {
  if (!id) {
    console.error("deleteInstrument called without a valid ID");
    return;
  }
  try {
    await deleteDoc(doc(db, "instruments", id));
  } catch (err) {
    console.error("Error deleting instrument:", err);
    throw err;
  }
}
