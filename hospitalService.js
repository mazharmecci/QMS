import { db } from "./firebase.js";
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs } from "firebase/firestore";

const hospitalsRef = collection(db, "hospitals");

export async function addHospital(hospital) {
  await addDoc(hospitalsRef, {
    ...hospital,
    createdAt: new Date(),
    updatedAt: new Date()
  });
}

export async function updateHospital(id, hospital) {
  await updateDoc(doc(db, "hospitals", id), {
    ...hospital,
    updatedAt: new Date()
  });
}

export async function deleteHospital(id) {
  await deleteDoc(doc(db, "hospitals", id));
}

export async function fetchHospitals() {
  const snapshot = await getDocs(hospitalsRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
