import {
  auth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "./firebase.js";

const form = document.getElementById("loginForm");
const emailEl = document.getElementById("email");
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

  const email = emailEl.value.trim();
  const password = passwordEl.value;

  if (!email || !password) {
    setError("Enter both email and password.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "index.html"; // or quotes.html dashboard
  } catch (err) {
    console.error(err);
    const code = err.code || "";
    if (code === "auth/user-not-found" || code === "auth/wrong-password") {
      setError("Invalid email or password.");
    } else {
      setError("Unable to sign in. Please try again.");
    }
  }
});

forgotBtn?.addEventListener("click", async () => {
  setError("");
  setInfo("");

  const email = emailEl.value.trim();
  if (!email) {
    setError("Enter your email first to receive a reset link.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    setInfo("Password reset link sent. Check your inbox.");
  } catch (err) {
    console.error(err);
    setError("Could not send password reset email.");
  }
});
