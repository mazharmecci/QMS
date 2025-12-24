import {
  db,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc
} from "./firebase.js"; // ensure firebase.js exports these

function parseModels(str) {
  const raw = (str || "").split(",");
  const list = raw.map(s => s.trim()).filter(Boolean);
  return list.length ? list : [];
}

/* ===== Load tables ===== */
async function loadConfigTable() {
  const tbody = document.getElementById("configTableBody");
  tbody.innerHTML = "<tr><td colspan='4'>Loading...</td></tr>";

  const snap = await getDocs(collection(db, "configItems"));
  const rows = [];
  snap.forEach(d => {
    const data = d.data();
    rows.push({ id: d.id, ...data });
  });

  if (!rows.length) {
    tbody.innerHTML = "<tr><td colspan='4'>No config items</td></tr>";
    return;
  }

  tbody.innerHTML = rows
    .map(r => `
      <tr>
        <td>${r.code || ""}</td>
        <td>${r.name || ""}</td>
        <td>${(r.applicableModels || []).join(", ")}</td>
        <td>
          <button type="button" data-id="${r.id}" class="cfg-edit">Edit</button>
          <button type="button" data-id="${r.id}" class="cfg-del">Delete</button>
        </td>
      </tr>
    `)
    .join("");

  tbody.querySelectorAll(".cfg-edit").forEach(btn => {
    btn.addEventListener("click", () => fillConfigForm(rows.find(r => r.id === btn.dataset.id)));
  });
  tbody.querySelectorAll(".cfg-del").forEach(btn => {
    btn.addEventListener("click", () => deleteConfigItem(btn.dataset.id));
  });
}

async function loadAdditionalTable() {
  const tbody = document.getElementById("additionalTableBody");
  tbody.innerHTML = "<tr><td colspan='4'>Loading...</td></tr>";

  const snap = await getDocs(collection(db, "additionalItems"));
  const rows = [];
  snap.forEach(d => {
    const data = d.data();
    rows.push({ id: d.id, ...data });
  });

  if (!rows.length) {
    tbody.innerHTML = "<tr><td colspan='4'>No additional items</td></tr>";
    return;
  }

  tbody.innerHTML = rows
    .map(r => `
      <tr>
        <td>${r.code || ""}</td>
        <td>${r.name || ""}</td>
        <td>${(r.applicableModels || []).join(", ")}</td>
        <td>
          <button type="button" data-id="${r.id}" class="add-edit">Edit</button>
          <button type="button" data-id="${r.id}" class="add-del">Delete</button>
        </td>
      </tr>
    `)
    .join("");

  tbody.querySelectorAll(".add-edit").forEach(btn => {
    btn.addEventListener("click", () => fillAdditionalForm(rows.find(r => r.id === btn.dataset.id)));
  });
  tbody.querySelectorAll(".add-del").forEach(btn => {
    btn.addEventListener("click", () => deleteAdditionalItem(btn.dataset.id));
  });
}

/* ===== Config form handlers ===== */

function fillConfigForm(item) {
  document.getElementById("configDocId").value = item.id;
  document.getElementById("configCode").value = item.code || "";
  document.getElementById("configName").value = item.name || "";
  document.getElementById("configDescription").value = item.description || "";
  document.getElementById("configApplicable").value =
    (item.applicableModels || []).join(", ");
  document.getElementById("configPriceLabel").value =
    item.priceLabel || "Included";
  document.getElementById("configIsActive").checked =
    item.isActive !== false;
}

async function deleteConfigItem(id) {
  if (!confirm("Delete this configuration item?")) return;
  await deleteDoc(doc(db, "configItems", id)); // [web:285]
  await loadConfigTable();
}

async function onConfigSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("configDocId").value || null;
  const payload = {
    code: document.getElementById("configCode").value.trim(),
    name: document.getElementById("configName").value.trim(),
    description: document.getElementById("configDescription").value,
    priceLabel: document.getElementById("configPriceLabel").value || "Included",
    applicableModels: parseModels(
      document.getElementById("configApplicable").value
    ),
    isActive: document.getElementById("configIsActive").checked
  };

  if (!payload.code || !payload.name) return;

  if (id) {
    await updateDoc(doc(db, "configItems", id), payload); // [web:263]
  } else {
    await addDoc(collection(db, "configItems"), payload);
  }

  document.getElementById("configForm").reset();
  document.getElementById("configDocId").value = "";
  await loadConfigTable();
}

/* ===== Additional form handlers ===== */

function fillAdditionalForm(item) {
  document.getElementById("additionalDocId").value = item.id;
  document.getElementById("additionalCode").value = item.code || "";
  document.getElementById("additionalName").value = item.name || "";
  document.getElementById("additionalDescription").value =
    item.description || "";
  document.getElementById("additionalApplicable").value =
    (item.applicableModels || []).join(", ");
  document.getElementById("additionalPrice").value =
    item.price != null ? item.price : "";
  document.getElementById("additionalIsActive").checked =
    item.isActive !== false;
}

async function deleteAdditionalItem(id) {
  if (!confirm("Delete this additional item?")) return;
  await deleteDoc(doc(db, "additionalItems", id)); // [web:285]
  await loadAdditionalTable();
}

async function onAdditionalSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("additionalDocId").value || null;
  const rawPrice = document.getElementById("additionalPrice").value;
  const payload = {
    code: document.getElementById("additionalCode").value.trim(),
    name: document.getElementById("additionalName").value.trim(),
    description: document.getElementById("additionalDescription").value,
    price: rawPrice ? Number(rawPrice) : 0,
    applicableModels: parseModels(
      document.getElementById("additionalApplicable").value
    ),
    isActive: document.getElementById("additionalIsActive").checked
  };

  if (!payload.code || !payload.name) return;

  if (id) {
    await updateDoc(doc(db, "additionalItems", id), payload);
  } else {
    await addDoc(collection(db, "additionalItems"), payload);
  }

  document.getElementById("additionalForm").reset();
  document.getElementById("additionalDocId").value = "";
  await loadAdditionalTable();
}

/* ===== Init ===== */

document.addEventListener("DOMContentLoaded", async () => {
  document
    .getElementById("configForm")
    .addEventListener("submit", onConfigSubmit);
  document
    .getElementById("configResetBtn")
    .addEventListener("click", () => {
      document.getElementById("configForm").reset();
      document.getElementById("configDocId").value = "";
    });

  document
    .getElementById("additionalForm")
    .addEventListener("submit", onAdditionalSubmit);
  document
    .getElementById("additionalResetBtn")
    .addEventListener("click", () => {
      document.getElementById("additionalForm").reset();
      document.getElementById("additionalDocId").value = "";
    });

  await loadConfigTable();
  await loadAdditionalTable();
});
