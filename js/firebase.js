// firebase.js

import { initializeApp, getApps, getApp } 
  from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";

import { 
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

import { 
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// ===== Firebase Config =====
const firebaseConfig = {
  apiKey: "AIzaSyAGuxdjp21tEUq_itkSlEpe-LqM0s28fVk",
  authDomain: "istos-qms.firebaseapp.com",
  projectId: "istos-qms",
  storageBucket: "istos-qms.appspot.com",
  messagingSenderId: "777790389934",
  appId: "1:777790389934:web:1acd36f952445a1625373f"
};

// ===== Ensure a single app instance =====
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ===== Core services =====
const db   = getFirestore(app);
const auth = getAuth(app);

// ===== Unified exports =====
export {
  // Core instances
  db,
  auth,

  // Firestore helpers
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  setDoc,
  serverTimestamp,

  // Auth helpers
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
};
