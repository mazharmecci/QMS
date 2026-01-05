import {
  auth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  db,
  collection,
  query,
  where,
  getDocs
} from "./firebase.js";

/* ========== DOM References ========== */
const form         = document.getElementById("loginForm");
const identifierEl = document.getElementById("identifier");
const passwordEl   = document.getElementById("password");
const togglePwdBtn = document.getElementById("togglePwd");
const rememberMeEl = document.getElementById("rememberMe");
const authErrorEl  = document.getElementById("authError");
const authInfoEl   = document.getElementById("authInfo");

/* ========== UI helpers ========== */
function setError(msg) {
  if (!authErrorEl || !authInfoEl) return;
  authErrorEl.textContent = msg;
  authErrorEl.hidden = false;
  authInfoEl.hidden = true;
}

function setInfo(msg) {
  if (!authErrorEl || !authInfoEl) return;
  authInfoEl.textContent = msg;
  authInfoEl.hidden = false;
  authErrorEl.hidden = true;
}

function clearMessages() {
  if (!authErrorEl || !authInfoEl) return;
  authErrorEl.hidden = true;
  authInfoEl.hidden = true;
}

/* ========== Password visibility toggle ========== */
if (togglePwdBtn && passwordEl) {
  togglePwdBtn.addEventListener("click", () => {
    const nextType = passwordEl.type === "password" ? "text" : "password";
    passwordEl.type = nextType;
    togglePwdBtn.textContent = nextType === "password" ? "👁" : "🙈";
  });
}

/* ========== Username → email lookup ========== */
async function findUserByUsername(username) {
  const q = query(collection(db, "users"), where("username", "==", username));
  const snap = await getDocs(q);

  if (snap.empty) {
    const err = new Error("auth/user-not-found");
    err.code = "auth/user-not-found";
    throw err;
  }

  const docSnap = snap.docs[0];
  const data = docSnap.data() || {};

  if (!data.email) {
    const err = new Error("auth/invalid-user");
    err.code = "auth/invalid-user";
    throw err;
  }

  return {
    uid: docSnap.id,
    email: data.email,
    username: data.username || username,
    role: data.role || "employee",
    permissions: Array.isArray(data.permissions) ? data.permissions : []
  };
}

/* ========== Auto-fill remembered username ========== */
document.addEventListener("DOMContentLoaded", () => {
  if (!identifierEl || !rememberMeEl) return;

  try {
    const rememberedRaw = localStorage.getItem("qmsRememberUser");
    if (!rememberedRaw) return;

    const remembered = JSON.parse(rememberedRaw);
    if (remembered?.username) {
      identifierEl.value = remembered.username;
      rememberMeEl.checked = !!remembered.remember;
    }
  } catch {
    localStorage.removeItem("qmsRememberUser");
  }
});

/* ========== Submit: username + password login ========== */
if (form && identifierEl && passwordEl) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessages();

    const username = identifierEl.value.trim();
    const password = passwordEl.value;

    if (!username || !password) {
      setError("Enter your username and password.");
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent || "";

    if (submitBtn) {
      submitBtn.textContent = "Signing in...";
      submitBtn.disabled = true;
    }

    try {
      const userMeta = await findUserByUsername(username);

      const persistence = rememberMeEl?.checked
        ? browserLocalPersistence
        : browserSessionPersistence;
      await setPersistence(auth, persistence);

      await signInWithEmailAndPassword(auth, userMeta.email, password);

      // Persist profile locally
      if (rememberMeEl?.checked) {
        localStorage.setItem(
          "qmsRememberUser",
          JSON.stringify({
            username: userMeta.username,
            remember: true,
            ts: Date.now()
          })
        );
      } else {
        localStorage.removeItem("qmsRememberUser");
      }

      localStorage.setItem(
        "qmsCurrentUser",
        JSON.stringify({
          username: userMeta.username,
          role: userMeta.role,
          permissions: userMeta.permissions,
          ts: Date.now()
        })
      );

      setInfo("Login successful. Redirecting...");

      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          console.log("Firebase user logged in:", user.uid);
          unsubscribe();
          window.location.replace("https://qms.istosmedical.com");
        } else {
          setError("Login failed to persist. Please try again.");
        }
      });
    } catch (error) {
      console.error("Login error:", error.code || error.message, error);
      const code = error.code || error.message;

      if (code === "auth/user-not-found") {
        setError("Username not found. Contact admin.");
      } else if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        setError("Incorrect password. Please try again.");
      } else if (code === "auth/user-disabled") {
        setError("Account disabled. Contact admin.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait a minute and try again.");
      } else if (code === "auth/network-request-failed") {
        setError("Network error. Check your internet connection.");
      } else if (code === "auth/invalid-user") {
        setError("User record is misconfigured. Contact admin.");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      if (submitBtn) {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    }
  });
}

/* ========== Global Auth state listener (optional debug) ========== */
onAuthStateChanged(auth, (user) => {
  console.log(
    user
      ? `Firebase user logged in (global listener): ${user.uid}`
      : "No Firebase user logged in (global listener)"
  );
});
