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
} from "./firebase.js";

/* ============================
   Shared Utilities
   ============================ */
function showToast(msg) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.style.display = "block";
  setTimeout(() => {
    toastEl.style.display = "none";
  }, 3000);
}

function populateUserBadge() {
  const userBadge = document.getElementById("userBadge");
  const profileModal = document.getElementById("profileModal");
  const profileContent = document.getElementById("profileContent");
  const closeBtn = document.getElementById("closeProfile");

  // Parse local user safely
  let localUser = {};
  try {
    localUser = JSON.parse(localStorage.getItem("qmsCurrentUser") || "{}");
  } catch {
    console.warn("⚠️ Failed to parse qmsCurrentUser from localStorage");
  }

  // Populate badge if user exists
  if (userBadge && localUser.username) {
    userBadge.textContent = `👤 ${localUser.username}`;
    userBadge.style.cursor = "pointer";

    // Ensure we don't attach multiple listeners
    userBadge.onclick = () => {
      if (profileModal && profileContent) {
        profileContent.innerHTML = `
          <p><strong>Username:</strong> ${localUser.username}</p>
          <p><strong>Role:</strong> ${localUser.role || "N/A"}</p>
          <p><strong>Permissions:</strong> ${Array.isArray(localUser.permissions) ? localUser.permissions.join(", ") : "None"}</p>
          <p><strong>Logged in:</strong> ${localUser.ts ? new Date(localUser.ts).toLocaleString() : "Unknown"}</p>
        `;
        profileModal.style.display = "block";
      }
    };
  }

  // Close modal handler
  if (closeBtn && profileModal) {
    closeBtn.onclick = () => {
      profileModal.style.display = "none";
    };
  }

  // Optional: close modal when clicking outside
  if (profileModal) {
    window.addEventListener("click", (e) => {
      if (e.target === profileModal) {
        profileModal.style.display = "none";
      }
    });
  }
}

/* ============================
   Auth + Logout
   ============================ */
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");
  populateUserBadge();

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      console.log("Auth state: signed out");
      setTimeout(() => {
        if (!auth.currentUser) window.location.href = "/login.html";
      }, 1000);
    } else {
      console.log("Auth state: logged in", user.uid);
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      logoutBtn.disabled = true;
      logoutBtn.textContent = "Signing out...";
      try {
        await signOut(auth);
        localStorage.removeItem("qmsCurrentUser");
        window.location.href = "/login.html";
      } catch (err) {
        console.error("Logout failed:", err);
        alert("Could not log out. Please try again.");
        logoutBtn.textContent = "Logout";
        logoutBtn.disabled = false;
      }
    });
  }
});

/* ============================
   Task Form Logic
   ============================ */
document.addEventListener("DOMContentLoaded", () => {
  const taskForm = document.getElementById("taskForm");
  if (!taskForm) return;

  const spinner = document.getElementById("spinner");
  const roleSelect = document.getElementById("roleSelect");
  const roleOption = document.getElementById("roleOption"); // single option inside roleSelect
  const creatorSelect = document.getElementById("creatorSelect");
  const creatorOption = document.getElementById("creatorOption"); // single option inside creatorSelect

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      setTimeout(() => {
        if (!auth.currentUser) window.location.href = "/login.html";
      }, 1000);
      return;
    }

    // 🔑 Get local user metadata
    let localUser = {};
    try {
      localUser = JSON.parse(localStorage.getItem("qmsCurrentUser") || "{}");
    } catch {
      console.warn("⚠️ Failed to parse qmsCurrentUser");
    }

    // 🧩 Auto-fill Role
    if (roleSelect && roleOption && localUser?.role) {
      roleOption.textContent = capitalize(localUser.role);
      roleOption.value = localUser.role;
      roleSelect.disabled = true;
    }

    // 🧩 Auto-fill Creator
    if (creatorSelect && creatorOption && localUser?.username) {
      creatorOption.textContent = localUser.username;
      creatorOption.value = localUser.username;
      creatorSelect.disabled = true;
    }

    // 📝 Handle form submission
    taskForm.addEventListener(
      "submit",
      async (e) => {
        e.preventDefault();
        if (spinner) spinner.style.display = "block";

        const role = roleOption?.value || "employee";
        const creatorUsername = creatorOption?.value || user.email || "Unknown";
        const assigneeName = document.getElementById("assignee")?.value || "";
        let assigneeId = "";

        try {
          const snap = await getDocs(
            query(collection(db, "users"), where("username", "==", assigneeName))
          );
          if (!snap.empty) {
            const data = snap.docs[0].data();
            assigneeId = data.uid || snap.docs[0].id; // ✅ use UID if available
          }
        } catch (err) {
          console.warn("Assignee lookup failed:", err);
        }

        const task = {
          title: document.getElementById("title")?.value.trim() || "",
          description: document.getElementById("description")?.value.trim() || "",
          priority: document.getElementById("priority")?.value || "Low",
          assignee: assigneeName,
          assigneeId,
          status: "Pending",
          createdBy: creatorUsername,
          createdByUid: user.uid,
          role,
          createdAt: serverTimestamp()
        };

        try {
          await addDoc(collection(db, "employeeTasks"), task);
          showToast("✅ Task saved");
          taskForm.reset();
        } catch (err) {
          console.error("Error saving task:", err);
          showToast("⚠️ Error saving task: " + (err.message || "Unknown error"));
        } finally {
          if (spinner) spinner.style.display = "none";
        }
      },
      { once: true }
    );
  });

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
});

/* ============================
   Employee Dashboard Logic
   ============================ */
document.addEventListener("DOMContentLoaded", () => {
  const table = document.querySelector("#taskTable tbody");
  const filterSelect = document.getElementById("taskFilter");
  const refreshBtn = document.getElementById("btnRefresh");

  if (!table || !document.body.classList.contains("employee-view")) return;

  let currentFilter = "all";

  onAuthStateChanged(auth, (user) => {
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

        const tasks = allTasks.filter((t) => {
          if (currentFilter === "assigned") return t.assigneeId === user.uid;
          if (currentFilter === "created") return t.createdByUid === user.uid;
          return t.assigneeId === user.uid || t.createdByUid === user.uid;
        });

        if (!tasks.length) {
          table.innerHTML = `<tr><td colspan="6">No tasks found</td></tr>`;
          return;
        }

        table.innerHTML = tasks
          .map(
            (task) => `
          <tr data-id="${task.id}" class="${
              task.status === "Completed" ? "task-completed" : ""
            }">
            <td>${task.title || "(Untitled)"}</td>
            <td>${task.description || "-"}</td>
            <td>${task.priority || "-"}</td>
            <td>${task.assignee || "-"}</td>
            <td>
              <span class="status-badge ${
                task.status === "Completed"
                  ? "status-completed"
                  : "status-pending"
              }">
                ${task.status || "Pending"}
              </span>
            </td>
            <td>
              <button class="btn-secondary btn-complete" ${
                task.status === "Completed" ? "disabled" : ""
              }>
                ${task.status === "Completed" ? "✔ Done" : "✔ Complete"}
              </button>
              <button class="btn-danger btn-delete">🗑 Delete</button>
            </td>
          </tr>
        `
          )
          .join("");

        attachTaskActions();
      } catch (err) {
        console.error("Error loading tasks:", err);
        showToast("⚠️ Failed to load tasks");
        table.innerHTML = `<tr><td colspan="6">Failed to load tasks</td></tr>`;
      }
    }

    function attachTaskActions() {
      // Complete buttons
      table.querySelectorAll(".btn-complete").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const row = e.currentTarget.closest("tr");
          const taskId = row.dataset.id;
          try {
            await updateDoc(doc(db, "employeeTasks", taskId), {
              status: "Completed"
            });
            showToast("✅ Task marked completed");
            row.classList.add("task-completed");
            row.querySelector("td:nth-child(5)").innerHTML =
              '<span class="status-badge status-completed">Completed</span>';
            btn.disabled = true;
            btn.textContent = "✔ Done";
          } catch (err) {
            console.error("Error marking complete:", err);
            showToast("⚠️ Failed to update task");
          }
        });
      });

      // Delete buttons
      table.querySelectorAll(".btn-delete").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const row = e.currentTarget.closest("tr");
          const taskId = row.dataset.id;
          if (!confirm("Delete this task?")) return;

          try {
            await deleteDoc(doc(db, "employeeTasks", taskId));
            showToast("🗑 Task deleted");

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
    }

    filterSelect?.addEventListener("change", (e) => {
      currentFilter = e.target.value;
      loadTasks();
    });

    refreshBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      loadTasks();
    });

    // Initial load
    loadTasks();
  });
});
