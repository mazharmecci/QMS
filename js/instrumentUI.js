// instrumentUI.js
import { fetchInstruments, addInstrument, updateInstrument, deleteInstrument } from "./instrumentService.js";

const form = document.getElementById("instrumentForm");
const tableBody = document.querySelector("#instrumentTable tbody");
const pageInfo = document.getElementById("pageInfo");
const hsnInput = document.getElementById("hsn");
const unitPriceInput = document.getElementById("unitPrice");
const mainItemNameInput = document.getElementById("mainItemName");
const descriptionTextarea = document.getElementById("description");
const suppliedWithInput = document.getElementById("suppliedWithInput");

let instruments = [];
let currentPage = 1;
const pageSize = 10;
let editIndex = null;

// Format price
function formatPriceDisplay(v) {
  return "₹ " + Number(v || 0).toLocaleString("en-IN");
}

// Render table
export async function renderTable() {
  tableBody.innerHTML = "";
  instruments = await fetchInstruments();

  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;

  instruments.slice(start, end).forEach((inst, i) => {
    const idx = start + i;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${inst.description || ""}</td>
      <td>
        <div class="collapse-toggle" onclick="toggleDetails(this)">Details</div>
        <div class="details-content">${inst.details || ""}</div>
      </td>
      <td>${inst.origin || ""}</td>
      <td>${inst.catalog || ""}</td>
      <td>${inst.hsn || ""}</td>
      <td>${inst.instrumentCode || ""}</td>
      <td class="price-cell">${formatPriceDisplay(inst.unitPrice)}</td>
      <td>${inst.gstType || ""}</td>
      <td>${inst.gstPercent || ""}</td>
      <td class="actions">
        <button type="button" class="edit-btn" onclick="editInstrument(${idx})">Edit</button>
        <button type="button" class="delete-btn" onclick="deleteInstrument(${idx})">Delete</button>
      </td>
    `;
    tableBody.appendChild(row);
  });

  const totalPages = Math.ceil(instruments.length / pageSize) || 1;
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
}

// Toggle details
window.toggleDetails = function (el) {
  const d = el.nextElementSibling;
  const visible = d.style.display === "block";
  d.style.display = visible ? "none" : "block";
  el.textContent = visible ? "Details" : "Hide details";
};

// Edit instrument
window.editInstrument = function (i) {
  const inst = instruments[i];
  if (!inst) return;

  mainItemNameInput.value = inst.description || "";
  descriptionTextarea.value = [
    inst.instrumentName || "",
    inst.instrumentShortLine || "",
    inst.instrumentExtraLines || ""
  ].filter(Boolean).join("\n");

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

// Delete instrument
window.deleteInstrument = async function (i) {
  const inst = instruments[i];
  instruments.splice(i, 1);
  localStorage.setItem("instruments", JSON.stringify(instruments));
  await deleteInstrument(inst.id);
  const maxPage = Math.max(1, Math.ceil(instruments.length / pageSize));
  if (currentPage > maxPage) currentPage = maxPage;
  renderTable();
};

// Pagination
window.nextPage = function () {
  if (currentPage * pageSize < instruments.length) {
    currentPage++;
    renderTable();
  }
};
window.prevPage = function () {
  if (currentPage > 1) {
    currentPage--;
    renderTable();
  }
};

// Handle form submit
form.addEventListener("submit", async e => {
  e.preventDefault();
  const isEdit = editIndex !== null;

  const instrument = {
    description: mainItemNameInput.value,
    instrumentName: descriptionTextarea.value.split("\n")[0] || "",
    origin: document.getElementById("origin").value,
    catalog: document.getElementById("catalog").value,
    hsn: hsnInput.value,
    instrumentCode: document.getElementById("instrumentCode").value,
    unitPrice: unitPriceInput.value,
    gstType: document.getElementById("gstType").value,
    gstPercent: document.getElementById("gstPercent").value,
    suppliedWith: suppliedWithInput.value.split("\n").filter(Boolean)
  };

  if (isEdit) {
    instruments[editIndex] = instrument;
    localStorage.setItem("instruments", JSON.stringify(instruments));
    await updateInstrument(instruments[editIndex].id, instrument);
    editIndex = null;
  } else {
    instruments.push(instrument);
    localStorage.setItem("instruments", JSON.stringify(instruments));
    await addInstrument(instrument);
  }

  form.reset();
  unitPriceInput.value = "";
  form.classList.remove("active");
  renderTable();
});

// Initial render
renderTable();
