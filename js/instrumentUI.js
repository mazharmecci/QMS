// instrumentUI.js
import {
  fetchInstruments,
  addInstrument,
  updateInstrument,
  deleteInstrument
} from "./instrumentService.js";

const form = document.getElementById("instrumentForm");
const tableBody = document.querySelector("#instrumentTable tbody");
const pageInfo = document.getElementById("pageInfo");
const hsnInput = document.getElementById("hsn");
const unitPriceInput = document.getElementById("unitPrice");
const mainItemNameInput = document.getElementById("mainItemName");
const descriptionTextarea = document.getElementById("description");
const suppliedWithInput = document.getElementById("suppliedWithInput");
const searchInput = document.getElementById("searchInput");

let instruments = [];
let currentPage = 1;
const pageSize = 10;
let editIndex = null;
let searchQuery = "";

/* ========= Toast helper ========= */
export function showToast(message, type = "success", duration = 1800) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const el = document.createElement("div");
  el.className = "toast" + (type === "error" ? " error" : "");
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => {
      if (el.parentNode === container) container.removeChild(el);
    }, 250);
  }, duration);
}

/* ========= Input formatting ========= */
hsnInput.addEventListener("input", () => {
  let digits = hsnInput.value.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 4) digits = digits.slice(0, 4) + " " + digits.slice(4);
  hsnInput.value = digits;
});

unitPriceInput.addEventListener("input", () => {
  let digits = unitPriceInput.value.replace(/[^\d]/g, "");
  if (!digits) {
    unitPriceInput.value = "";
    return;
  }
  const num = parseInt(digits, 10);
  unitPriceInput.value = "₹ " + num.toLocaleString("en-IN");
});

function parsePriceValue(v) {
  const digits = (v || "").replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

function formatPriceDisplay(v) {
  return "₹ " + Number(v || 0).toLocaleString("en-IN");
}

/* ========= Search wiring ========= */
if (searchInput) {
  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value.trim().toLowerCase();
    currentPage = 1;
    renderTable();
  });
}

/* ========= Form submit ========= */
form.addEventListener("submit", async e => {
  e.preventDefault();

  const instrument = {
    instrumentName: mainItemNameInput.value.trim(),
    longDescription: descriptionTextarea.value.trim(),
    suppliedWith: (suppliedWithInput.value || "")
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean),
    origin: document.getElementById("origin").value.trim(),
    catalog: document.getElementById("catalog").value.trim(),
    hsn: hsnInput.value.trim(),
    instrumentCode: document.getElementById("instrumentCode").value.trim(),
    unitPrice: parsePriceValue(unitPriceInput.value),
    gstType: document.getElementById("gstType").value.trim(),
    gstPercent: document.getElementById("gstPercent").value.trim()
  };

  try {
    if (editIndex !== null) {
      const existing = instruments[editIndex];
      if (!existing || !existing.id) {
        showToast("Missing instrument ID", "error");
      } else {
        await updateInstrument(existing.id, instrument);
        showToast("Instrument updated");
      }
      editIndex = null;
    } else {
      await addInstrument(instrument);
      showToast("Instrument saved");
    }
  } catch (err) {
    console.error(err);
    showToast("Failed to save instrument", "error");
  }

  form.reset();
  unitPriceInput.value = "";
  form.classList.remove("active");

  await renderTable();
});

/* ========= Render table with search (no # column) ========= */
export async function renderTable() {
  try {
    instruments = await fetchInstruments();
  } catch (err) {
    console.error(err);
    showToast("Failed to load instruments", "error");
    return;
  }

  localStorage.setItem("instruments", JSON.stringify(instruments));
  tableBody.innerHTML = "";

  // 1) Filter by equipment name / description
  let filtered = instruments;
  if (searchQuery) {
    filtered = instruments.filter(inst => {
      const name = (inst.instrumentName || inst.description || "").toLowerCase();
      const desc = (inst.longDescription || "").toLowerCase();
      return name.includes(searchQuery) || desc.includes(searchQuery);
    });
  }

  // 2) Pagination based on filtered list
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;

  filtered.slice(start, end).forEach(inst => {
    // index in full array so edit/delete still work on original instruments[]
    const idx = instruments.indexOf(inst);

    const row = document.createElement("tr");
    row.innerHTML = `
      <!-- Equip-Name -->
      <td><strong>${inst.instrumentName || inst.description || ""}</strong></td>

      <!-- Equip-Desc -->
      <td><strong>${inst.longDescription || ""}</strong></td>

      <!-- Origin -->
      <td>${inst.origin || ""}</td>

      <!-- Catalog -->
      <td>${inst.catalog || ""}</td>

      <!-- HSN -->
      <td>${inst.hsn || ""}</td>

      <!-- Code -->
      <td>${inst.instrumentCode || ""}</td>

      <!-- Price -->
      <td class="price-cell">${formatPriceDisplay(inst.unitPrice)}</td>

      <!-- GST Type -->
      <td>${inst.gstType || ""}</td>

      <!-- GST % -->
      <td>${inst.gstPercent || ""}</td>

      <!-- Actions -->
      <td class="actions">
        <button type="button" class="edit-btn" onclick="editInstrument(${idx})">Edit</button>
        <button type="button" class="delete-btn" onclick="deleteInstrumentRow(${idx})">Delete</button>
      </td>
    `;
    tableBody.appendChild(row);
  });

  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
}

/* ========= Handlers ========= */
window.editInstrument = function(i) {
  const inst = instruments[i];
  if (!inst) return;

  mainItemNameInput.value = inst.instrumentName || "";
  descriptionTextarea.value = inst.longDescription || "";
  document.getElementById("origin").value = inst.origin || "";
  document.getElementById("catalog").value = inst.catalog || "";
  hsnInput.value = inst.hsn || "";
  document.getElementById("instrumentCode").value = inst.instrumentCode || "";
  unitPriceInput.value = formatPriceDisplay(inst.unitPrice);
  document.getElementById("gstType").value = inst.gstType || "";
  document.getElementById("gstPercent").value = inst.gstPercent || "";
  suppliedWithInput.value = (inst.suppliedWith || []).join("\n");

  editIndex = i;
  form.classList.add("active");
};

window.deleteInstrumentRow = async function(i) {
  const inst = instruments[i];
  if (!inst || !inst.id) {
    showToast("Missing instrument ID", "error");
    return;
  }

  try {
    await deleteInstrument(inst.id);
    showToast("Instrument deleted");
    await renderTable();
  } catch (err) {
    console.error(err);
    showToast("Failed to delete instrument", "error");
  }
};

window.nextPage = function() {
  if (currentPage * pageSize < instruments.length) {
    currentPage++;
    renderTable();
  }
};

window.prevPage = function() {
  if (currentPage > 1) {
    currentPage--;
    renderTable();
  }
};

/* ========= Initial render ========= */
document.addEventListener("DOMContentLoaded", () => {
  renderTable();
});
