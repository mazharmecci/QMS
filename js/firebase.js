// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js"; 
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAGuxdjp21tEUq_itkSlEpe-LqM0s28fVk",
  authDomain: "istos-qms.firebaseapp.com",
  projectId: "istos-qms",
  storageBucket: "istos-qms.firebasestorage.app",
  messagingSenderId: "777790389934",
  appId: "1:777790389934:web:1acd36f952445a1625373f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
