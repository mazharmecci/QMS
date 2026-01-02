import {
  auth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  db
} from "./firebase.js";
import { doc, getDoc } from "firebase/firestore";

const form = document.getElementById("loginForm");
const identifierEl = document.getElementById("identifier"); // can be email OR username
const passwordEl = document.getElementById("password");
const togglePwdBtn = document.getElementById("togglePwd");
const forgotBtn = document.getElementById("forgotPasswordBtn");
const errorEl = document.getElementById("authError");
const infoEl = document.getElementById("authInfo");

function setError(msg) {
  if (!errorEl) return;
  errorEl.textContent = msg;
  errorEl.hidden = !msg;
  if (infoEl) infoEl.hidden = true;
}

function setInfo(msg) {
  if (!infoEl) return;
  infoEl.textContent = msg;
  infoEl.hidden = !msg;
  if (errorEl) errorEl.hidden = true;
}

togglePwdBtn?.addEventListener("click", () => {
  const isPassword = passwordEl.type === "password";
  passwordEl.type = isPassword ? "text" : "password";
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setError("");
  setInfo("");

  const identifier = identifierEl.value.trim(); // username OR email
  const password = passwordEl.value;

  if (!identifier || !password) {
    setError("Enter both username/email and password.");
    return;
  }

  try {
    let email = identifier;

    // 🔑 If identifier is not an email, lookup synthetic email in Firestore
    if (!identifier.includes("@")) {
      const userDoc = await getDoc(doc(db, "users", identifier));
      if (!userDoc.exists()) {
        setError("User not found.");
        return;
      }
      email = userDoc.data().email; // synthetic email
    }

    // ✅ Authenticate with Firebase
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "index.html"; // redirect to dashboard
  } catch (err) {
    console.error(err);
    const code = err.code || "";
    if (code === "auth/user-not-found" || code === "auth/wrong-password") {
      setError("Invalid username/email or password.");
    } else {
      setError("Unable to sign in. Please try again.");
    }
  }
});

forgotBtn?.addEventListener("click", async () => {
  setError("");
  setInfo("");

  const identifier = identifierEl.value.trim();
  if (!identifier) {
    setError("Enter your username/email first to receive a reset link.");
    return;
  }

  try {
    let email = identifier;

    if (!identifier.includes("@")) {
      const userDoc = await getDoc(doc(db, "users", identifier));
      if (!userDoc.exists()) {
        setError("User not found.");
        return;
      }
      email = userDoc.data().email;
    }

    await sendPasswordResetEmail(auth, email);
    setInfo("Password reset link sent. Check your inbox.");
  } catch (err) {
    console.error(err);
    setError("Could not send password reset email.");
  }
});
