// ===== Imports from firebase.js =====
import {
  auth,
  db,
  collection,
  addDoc,
  serverTimestamp,
  onAuthStateChanged,
  signOut
} from './firebase.js';   // ✅ firebase.js is in QMS/js/

// ============================
// AUTH + LOGOUT PILL
// ============================
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    // Watch auth state
    onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("Task-manager auth state: logged in", user.uid);
      } else {
        console.log("Task-manager auth state: signed out");
        // Grace period before redirect
        setTimeout(() => {
          if (!auth.currentUser) {
            window.location.href = "/login.html"; // ✅ unified QMS login
          }
        }, 1000);
      }
    });

    logoutBtn.addEventListener("click", async () => {
      const originalText = logoutBtn.textContent;
      logoutBtn.disabled = true;
      logoutBtn.textContent = "Signing out...";

      try {
        await signOut(auth);
        localStorage.removeItem("qmsCurrentUser");
        window.location.href = "/login.html";
      } catch (err) {
        console.error("Failed to sign out", err);
        alert("Could not log out. Please try again.");
        logoutBtn.textContent = originalText;
        logoutBtn.disabled = false;
      }
    });
  }
});

// ============================
// TASK FORM (task-form.html)
// ============================
document.addEventListener("DOMContentLoaded", () => {
  const taskForm = document.getElementById("taskForm");
  if (!taskForm) return;

  const spinner = document.getElementById("spinner");
  const roleSelect = document.getElementById("roleSelect");
  const creatorSelect = document.getElementById("creatorSelect");
  const toastEl = document.getElementById("toast");

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.style.display = "block";
    setTimeout(() => (toastEl.style.display = "none"), 3000);
  }

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      console.warn("No Firebase user logged in for task form");
      setTimeout(() => {
        if (!auth.currentUser) {
          window.location.href = "/login.html";
        }
      }, 1000);
      return;
    }

    // Attach submit handler once
    taskForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (spinner) spinner.style.display = "block";

      const role = roleSelect?.value || "employee";
      const creatorUsername = creatorSelect?.value || "";

      const task = {
        title: document.getElementById("title")?.value.trim() || "",
        description: document.getElementById("description")?.value.trim() || "",
        priority: document.getElementById("priority")?.value || "Low",
        assignee: document.getElementById("assignee")?.value || "",
        status: "Pending",
        createdBy: creatorUsername || user.email || "Unknown",
        createdByUid: user.uid,
        createdAt: serverTimestamp()
      };

      console.log("📝 Creating task:", task);

      try {
        await addDoc(collection(db, "employeeTasks"), task);
        showToast("✅ Task saved");
        taskForm.reset();
      } catch (err) {
        console.error("❌ Error saving task:", err);
        showToast("⚠️ Error saving task: " + err.message);
      } finally {
        if (spinner) spinner.style.display = "none";
      }
    }, { once: true }); // ensure only one listener
  });
});
