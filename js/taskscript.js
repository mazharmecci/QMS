// ===== Imports from firebase.js =====
import {
  auth,
  db,
  collection,
  addDoc,
  getDocs,       // ✅ for listing tasks
  updateDoc,     // ✅ for marking completed
  deleteDoc,     // ✅ for deleting
  doc,
  serverTimestamp,
  onAuthStateChanged,
  signOut
} from './firebase.js';

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

// ============================
// EMPLOYEE DASHBOARD (employee.html)
// ============================
document.addEventListener("DOMContentLoaded", () => {
  const table = document.querySelector("#taskTable tbody");
  const filterSelect = document.getElementById("taskFilter");
  const refreshBtn = document.getElementById("btnRefresh");
  const toastEl = document.getElementById("toast");

  if (!table || !document.body.classList.contains("employee-view")) return;

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.style.display = "block";
    setTimeout(() => (toastEl.style.display = "none"), 3000);
  }

  let currentFilter = "all";

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setTimeout(() => {
        if (!auth.currentUser) window.location.href = "/login.html";
      }, 1000);
      return;
    }

    async function loadTasks() {
      table.innerHTML = `<tr><td colspan="6">Loading...</td></tr>`;
      try {
        const snapshot = await getDocs(collection(db, "employeeTasks"));
        const allTasks = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

        let tasks = [];
        if (currentFilter === "assigned") {
          tasks = allTasks.filter((t) => t.assigneeId === user.uid);
        } else if (currentFilter === "created") {
          tasks = allTasks.filter((t) => t.createdByUid === user.uid);
        } else {
          tasks = allTasks.filter(
            (t) => t.assigneeId === user.uid || t.createdByUid === user.uid
          );
        }

        if (tasks.length === 0) {
          table.innerHTML = `<tr><td colspan="6">No tasks found</td></tr>`;
          return;
        }

        table.innerHTML = tasks.map((task) => `
          <tr data-id="${task.id}">
            <td>${task.title || "(Untitled)"}</td>
            <td>${task.description || "-"}</td>
            <td>${task.priority || "-"}</td>
            <td>${task.assignee || "-"}</td>
            <td>${task.status || "Pending"}</td>
            <td>
              <button class="btn-secondary btn-complete">✔ Complete</button>
              <button class="btn-danger btn-delete">🗑 Delete</button>
            </td>
          </tr>
        `).join("");

        // Attach action listeners
        table.querySelectorAll(".btn-complete").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            const row = e.target.closest("tr");
            const taskId = row.dataset.id;
            try {
              await updateDoc(doc(db, "employeeTasks", taskId), { status: "Completed" });
              showToast("✅ Task marked completed");
              loadTasks();
            } catch (err) {
              console.error("Error marking complete:", err);
              showToast("⚠️ Failed to update task");
            }
          });
        });

        table.querySelectorAll(".btn-delete").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            const row = e.target.closest("tr");
            const taskId = row.dataset.id;
            if (!confirm("Delete this task?")) return;
            try {
              await deleteDoc(doc(db, "employeeTasks", taskId));
              showToast("🗑 Task deleted");
              loadTasks();
            } catch (err) {
              console.error("Error deleting task:", err);
              showToast("⚠️ Failed to delete task");
            }
          });
        });
      } catch (err) {
        console.error("Error loading tasks:", err);
        showToast("⚠️ Failed to load tasks");
      }
    }

    filterSelect?.addEventListener("change", (e) => {
      currentFilter = e.target.value;
      loadTasks();
    });

    refreshBtn?.addEventListener("click", loadTasks);

    loadTasks();
  });
});
