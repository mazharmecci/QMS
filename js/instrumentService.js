// instrumentService.js
import { db, collection, addDoc, updateDoc, deleteDoc, doc, getDocs } from "./firebase.js";

const instrumentsRef = collection(db, "instruments");

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

export async function addInstrument(instrument) {
  await addDoc(instrumentsRef, { ...instrument, createdAt: new Date() });
}

export async function updateInstrument(id, instrument) {
  await updateDoc(doc(db, "instruments", id), { ...instrument, updatedAt: new Date() });
}

export async function deleteInstrument(id) {
  await deleteDoc(doc(db, "instruments", id));
}
