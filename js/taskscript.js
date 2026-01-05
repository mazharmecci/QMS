// ===== Imports from firebase.js =====
import {
  auth,
  db,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
  onAuthStateChanged,
  signOut
} from './firebase.js';

// ============================
// Shared: Toast + Profile Badge
// ============================
function showToast(msg) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.style.display = "block";
  setTimeout(() => (toastEl.style.display = "none"), 3000);
}

function populateUserBadge() {
  const userBadge = document.getElementById("userBadge");
  const profileModal = document.getElementById("profileModal");
  const profileContent = document.getElementById("profileContent");
  const localUser = JSON.parse(localStorage.getItem("qmsCurrentUser") || "{}");

  if (userBadge && localUser?.username) {
    userBadge.textContent = `👤 ${localUser.username}`;
    userBadge.style.cursor = "pointer";
    userBadge.addEventListener("click", () => {
      if (profileModal && profileContent) {
        profileContent.innerHTML = `
          <p><strong>Username:</strong> ${localUser.username}</p>
          <p><strong>Role:</strong> ${localUser.role}</p>
          <p><strong>Permissions:</strong> ${localUser.permissions?.join(", ") || "None"}</p>
          <p><strong>Logged in:</strong> ${new Date(localUser.ts).toLocaleString()}</p>
        `;
        profileModal.style.display = "block";
      }
    });
  }

  const closeBtn = document.getElementById("closeProfile");
  if (closeBtn && profileModal) {
    closeBtn.addEventListener("click", () => {
      profileModal.style.display = "none";
    });
  }
}

// ============================
// AUTH + LOGOUT + Profile
// ============================
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");
  populateUserBadge();

  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("Auth state: logged in", user.uid);
    } else {
      console.log("Auth state: signed out");
      setTimeout(() => {
        if (!auth.currentUser) window.location.href = "/login.html";
      }, 1000);
    }
  });

  if (logoutBtn) {
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

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      setTimeout(() => {
        if (!auth.currentUser) window.location.href = "/login.html";
      }, 1000);
      return;
    }

    taskForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (spinner) spinner.style.display = "block";

      const role = roleSelect?.value || "employee";
      const creatorUsername = creatorSelect?.value || "";
      const assigneeName = document.getElementById("assignee")?.value || "";
      let assigneeId = null;

      try {
        const snap = await getDocs(query(collection(db, "users"), where("username", "==", assigneeName)));
        if (!snap.empty) assigneeId = snap.docs[0].id;
      } catch (err) {
        console.warn("Assignee lookup failed:", err);
      }

      const task = {
        title: document.getElementById("title")?.value.trim() || "",
        description: document.getElementById("description")?.value.trim() || "",
        priority: document.getElementById("priority")?.value || "Low",
        assignee: assigneeName,
        assigneeId: assigneeId || "",
        status: "Pending",
        createdBy: creatorUsername || user.email || "Unknown",
        createdByUid: user.uid,
        createdAt: serverTimestamp()
      };

      try {
        await addDoc(collection(db, "employeeTasks"), task);
        showToast("✅ Task saved");
        taskForm.reset();
      } catch (err) {
        console.error("Error saving task:", err);
        showToast("⚠️ Error saving task: " + err.message);
      } finally {
        if (spinner) spinner.style.display = "none";
      }
    }, { once: true });
  });
});

// ============================
// EMPLOYEE DASHBOARD (employee.html)
// ============================
document.addEventListener("DOMContentLoaded", () => {
  const table = document.querySelector("#taskTable tbody");
  const filterSelect = document.getElementById("taskFilter");
  const refreshBtn = document.getElementById("btnRefresh");

  if (!table || !document.body.classList.contains("employee-view")) return;

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
          <tr data-id="${task.id}" class="${task.status === 'Completed' ? 'task-completed' : ''}">
            <td>${task.title || "(Untitled)"}</td>
            <td>${task.description || "-"}</td>
            <td>${task.priority || "-"}</td>
            <td>${task.assignee || "-"}</td>
            <td>
              <span class="status-badge ${task.status === "Completed" ? "status-completed" : "status-pending"}">
                ${task.status || "Pending"}
              </span>
            </td>
            <td>
              <button class="btn-secondary btn-complete" ${task.status === "Completed" ? "disabled" : ""}>
                ${task.status === "Completed" ? "✔ Done" : "✔ Complete"}
              </button>
              <button class="btn-danger btn-delete">🗑 Delete</button>
            </td>
          </tr>
        `).join("");

        table.querySelectorAll(".btn-complete").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            const row = e.target.closest("tr");
            const taskId = row.dataset.id;
            try {
              await updateDoc(doc(db, "employeeTasks", taskId), { status: "Completed" });
              showToast("✅ Task marked completed");

              row.classList.add("task-completed");
              const statusCell = row.querySelector("td:nth-child(5)");
              statusCell.innerHTML = `<span class="status-badge status-completed">Completed</span>`;
              e.target.disabled = true;
              e.target.textContent = "✔ Done";
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
            table.querySelectorAll(".btn-delete").forEach((btn) => {
              btn.addEventListener("click", async (e) => {
                const row = e.target.closest("tr");
                const taskId = row.dataset.id;
                if (!confirm("Delete this task?")) return;
                try {
                  await deleteDoc(doc(db, "employeeTasks", taskId));
                  showToast("🗑 Task deleted");
    
                  // Smooth fade-out effect before removing row
                  row.style.transition = "opacity 0.5s ease";
                  row.style.opacity = "0";
                  setTimeout(() => {
                    row.remove();
                    if (!table.querySelector("tr")) {
                      table.innerHTML = `<tr><td colspan="6">No tasks found</td></tr>`;
                    }
                  }, 500);
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
