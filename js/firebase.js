// firebase.js
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc            // ⬅ added
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js"; // [web:117][web:127]

const firebaseConfig = {
  apiKey: "AIzaSyAGuxdjp21tEUq_itkSlEpe-LqM0s28fVk",
  authDomain: "istos-qms.firebaseapp.com",
  projectId: "istos-qms",
  storageBucket: "istos-qms.appspot.com",
  messagingSenderId: "777790389934",
  appId: "1:777790389934:web:1acd36f952445a1625373f"
};

// Only initialize once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// Export Firestore instance and helpers
export const db = getFirestore(app);
export {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc        // ⬅ exported so quotes.html can import it
};
