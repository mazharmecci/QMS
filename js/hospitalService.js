import { db } from "./firebase.js";
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs } from "firebase/firestore";

const hospitalsRef = collection(db, "hospitals");

// --- LocalStorage helpers ---
function getLocalHospitals() {
  return JSON.parse(localStorage.getItem("hospitals") || "[]");
}

function setLocalHospitals(hospitals) {
  localStorage.setItem("hospitals", JSON.stringify(hospitals));
}

// --- Firebase + LocalStorage combined ---
export async function addHospital(hospital) {
  // LocalStorage
  const hospitals = getLocalHospitals();
  hospitals.push(hospital);
  setLocalHospitals(hospitals);

  // Firebase
  try {
    await addDoc(hospitalsRef, {
      ...hospital,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log("Hospital saved to Firebase:", hospital.clientName);
  } catch (error) {
    console.error("Error saving to Firebase:", error);
  }
}

export async function updateHospital(id, hospital, index = null) {
  // LocalStorage
  const hospitals = getLocalHospitals();
  if (index !== null) {
    hospitals[index] = hospital;
    setLocalHospitals(hospitals);
  }

  // Firebase
  try {
    await updateDoc(doc(db, "hospitals", id), {
      ...hospital,
      updatedAt: new Date()
    });
    console.log("Hospital updated in Firebase:", hospital.clientName);
  } catch (error) {
    console.error("Error updating Firebase:", error);
  }
}

export async function deleteHospital(id, index = null) {
  // LocalStorage
  const hospitals = getLocalHospitals();
  if (index !== null) {
    hospitals.splice(index, 1);
    setLocalHospitals(hospitals);
  }

  // Firebase
  try {
    await deleteDoc(doc(db, "hospitals", id));
    console.log("Hospital deleted from Firebase:", id);
  } catch (error) {
    console.error("Error deleting from Firebase:", error);
  }
}

export async function fetchHospitals() {
  try {
    const snapshot = await getDocs(hospitalsRef);
    const firebaseHospitals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Sync Firebase → LocalStorage
    setLocalHospitals(firebaseHospitals);
    return firebaseHospitals;
  } catch (error) {
    console.error("Error fetching from Firebase, falling back to localStorage:", error);
    return getLocalHospitals();
  }
}
