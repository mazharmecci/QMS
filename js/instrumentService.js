// instrumentService.js
import { db, collection, addDoc, updateDoc, deleteDoc, doc, getDocs } from "./firebase.js";

const instrumentsRef = collection(db, "instruments");

// Fetch all instruments
export async function fetchInstruments() {
  try {
    const snapshot = await getDocs(instrumentsRef);
    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    localStorage.setItem("instruments", JSON.stringify(list));
    return list;
  } catch (err) {
    console.error("Error fetching instruments, falling back to localStorage:", err);
    return JSON.parse(localStorage.getItem("instruments") || "[]");
  }
}

// Add a new instrument and return its Firestore ID
export async function addInstrument(instrument) {
  try {
    const docRef = await addDoc(instrumentsRef, { ...instrument, createdAt: new Date() });
    return docRef.id; // return the new document ID
  } catch (err) {
    console.error("Error adding instrument:", err);
    throw err;
  }
}

// Update an existing instrument by ID
export async function updateInstrument(id, instrument) {
  if (!id) {
    console.error("updateInstrument called without a valid ID");
    return;
  }
  try {
    await updateDoc(doc(db, "instruments", id), { ...instrument, updatedAt: new Date() });
  } catch (err) {
    console.error("Error updating instrument:", err);
    throw err;
  }
}

// Delete an instrument by ID
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
