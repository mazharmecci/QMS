// firebase.js

import {
  initializeApp,
  getApps
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";

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

const firebaseConfig = {
  apiKey: "AIzaSyAGuxdjp21tEUq_itkSlEpe-LqM0s28fVk",
  authDomain: "istos-qms.firebaseapp.com",
  projectId: "istos-qms",
  storageBucket: "istos-qms.appspot.com",
  messagingSenderId: "777790389934",
  appId: "1:777790389934:web:1acd36f952445a1625373f"
};

// Ensure a single app instance
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Core services
const db   = getFirestore(app);
const auth = getAuth(app);

// Unified exports for use across the app
export {
  // core instances
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
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
};
