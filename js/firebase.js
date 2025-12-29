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
  serverTimestamp,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

import { 
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";

// ===== Firebase Config =====
const firebaseConfig = {
  apiKey: "AIzaSyAGuxdjp21tEUq_itkSlEpe-LqM0s28fVk",
  authDomain: "istos-qms.firebaseapp.com",
  projectId: "istos-qms",
  storageBucket: "istos-qms.firebasestorage.app",
  messagingSenderId: "777790389934",
  appId: "1:777790389934:web:1acd36f952445a1625373f"
};

// ===== Ensure a single app instance =====
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ===== Core services =====
const db      = getFirestore(app);
const auth    = getAuth(app);
const storage = getStorage(app);

// ===== Unified exports =====
export {
  // Core instances
  db,
  auth,
  storage,

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
  query,
  where,
  orderBy,

  // Auth helpers
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,

  // Storage helpers
  ref,
  uploadBytes,
  getDownloadURL
};
