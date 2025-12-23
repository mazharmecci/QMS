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

// 🔹 Toast helper
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

// 🔹 Input formatting
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

function parseDetails(rawText) {
  const lines = rawText.split("\n").map(l => l.trim()).filter(l => l);
  const first = lines[0] || "";
  const second = lines[1] || "";
  const rest = lines.slice(2);

  let detailsHTML = "";
  if (first) detailsHTML += `<p><strong>${first}</strong></p>`;
  if (second || rest.length) {
    const allBullets = [];
    if (second) allBullets.push(second);
    allBullets.push(...rest);
    const li = allBullets.map(line => `<li>${line}</li>`).join("");
    detailsHTML += `<ul>${li}</ul>`;
  }

  return {
    firstLine: first,
    secondLine: second,
    remainingLines: rest.join("\n"),
    detailsHTML
  };
}

function formatPriceDisplay(v) {
  return "₹ " + Number(v || 0).toLocaleString("en-IN");
}

// 🔹 Form submit
form.addEventListener("submit", async e => {
  e.preventDefault();

  const { firstLine, secondLine, remainingLines, detailsHTML } = parseDetails(descriptionTextarea.value);
  const suppliedWithLines = (suppliedWithInput.value || "").split("\n").map(l => l.trim()).filter(Boolean);

  const instrument = {
    description: mainItemNameInput.value,
    instrumentName: firstLine,
    instrumentShortLine: secondLine,
    instrumentExtraLines: remainingLines,
    details: detailsHTML,
    suppliedWith: suppliedWithLines,
    origin: document.getElementById("origin").value,
    catalog: document.getElementById("catalog").value,
    hsn: hsnInput.value,
    instrumentCode: document.getElementById("instrumentCode").value,
    unitPrice: parsePriceValue(unitPriceInput.value),
    gstType: document.getElementById("gstType").value,
    gstPercent: document.getElementById("gstPercent").value
  };

  if (editIndex !== null) {
    // preserve ID when updating
    const existingId = instruments[editIndex].id;
    instruments[editIndex] = { ...instrument, id: existingId };
    await updateInstrument(existingId, instrument);
    editIndex = null;
  } else {
    // add new instrument and capture Firestore ID
    const newId = await addInstrument(instrument);
    instruments.push({ ...instrument, id: newId });
  }

  localStorage.setItem("instruments", JSON.stringify(instruments));
  form.reset();
  unitPriceInput.value = "";
  form.classList.remove("active");
  renderTable();
  showToast("Instrument saved");
});

// 🔹 Render table
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

// 🔹 Handlers
window.toggleDetails = function(el) {
  const d = el.nextElementSibling;
  const visible = d.style.display === "block";
  d.style.display = visible ? "none" : "block";
  el.textContent = visible ? "Details" : "Hide details";
};

window.editInstrument = function(i) {
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

window.deleteInstrument = async function(i) {
  const inst = instruments[i];
  if (!inst || !inst.id) {
    showToast("Missing instrument ID", "error");
    return;
  }
  await deleteInstrument(inst.id);
  instruments.splice(i, 1);
  localStorage.setItem("instruments", JSON.stringify(instruments));

  const maxPage = Math.max(1, Math.ceil(instruments.length / pageSize));
  if (currentPage > maxPage) currentPage = maxPage;
  renderTable();
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

// Initial render
renderTable();
