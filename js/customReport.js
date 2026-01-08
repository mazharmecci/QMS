import { getInstrumentsMaster } from "../js/quoteService.js";

/* ========= Populate existing catalog dropdown ========= */

/* ========= Populate existing catalog dropdown ========= */

function populateCatalogDropdown() {
  const instruments = getInstrumentsMaster();
  const selector = document.getElementById("catalogSelector");
  if (!selector) {
    console.error("[customReport] #catalogSelector not found in DOM");
    return;
  }

  // Clear any existing options
  selector.innerHTML = "";

  // Collect catalog / instrumentCode, dedupe, sort
  const catalogsMap = {};
  instruments.forEach(function (inst, idx) {
    const catalog = inst.catalog || inst.instrumentCode || ("CAT-" + (idx + 1));
    if (!catalog) return;
    catalogsMap[catalog] = true;
  });

  const uniqueCatalogs = Object.keys(catalogsMap).sort(function (a, b) {
    // numeric-safe sort if codes are numeric strings, fallback to string
    const na = Number(a), nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  // Default placeholder option
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "-- Select Catalog --";
  selector.appendChild(defaultOpt);

  // Append unique, sorted catalogs
  uniqueCatalogs.forEach(function (catalog) {
    const opt = document.createElement("option");
    opt.value = catalog;
    opt.textContent = catalog;
    selector.appendChild(opt);
  });
}

/* ========= Render report table for selected catalog ========= */

function showCatalogReport() {
  const selector = document.getElementById("catalogSelector");
  if (!selector) {
    console.error("[customReport] #catalogSelector not found");
    return;
  }

  const selectedCatalog = selector.value;
  const tbody = document.querySelector("#instrumentReportTable tbody");
  if (!tbody) {
    console.error("[customReport] #instrumentReportTable tbody not found");
    return;
  }

  tbody.innerHTML = "";

  if (!selectedCatalog) return;

  const instruments = getInstrumentsMaster();
  const allQuotes = JSON.parse(localStorage.getItem("quotes") || "[]");
  let rowNum = 1;

  allQuotes.forEach(function (q) {
    const lines = q.lineItems || [];
    lines.forEach(function (line) {
      // match by catalog / code
      if (line.code === selectedCatalog) {
        const inst = instruments.find(function (i) {
          return i.catalog === selectedCatalog || i.instrumentCode === selectedCatalog;
        }) || {};

        const tr = document.createElement("tr");
        const qty = line.quantity || 1;
        const priceNum = line.price != null ? Number(line.price) : null;

        tr.innerHTML = `
          <td>${rowNum++}</td>
          <td>${(q.header && q.header.hospitalName) || "Unknown"}</td>
          <td>${inst.instrumentName || inst.name || "—"}</td>
          <td>${(q.header && q.header.quoteDate) || "—"}</td>
          <td>${qty}</td>
          <td>₹ ${priceNum != null && !isNaN(priceNum)
            ? priceNum.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : "—"}</td>
        `;
        tbody.appendChild(tr);
      }
    });
  });
}

/* ========= Init wiring ========= */

document.addEventListener("DOMContentLoaded", function () {
  // Use existing markup from HTML
  populateCatalogDropdown();

  const btn = document.getElementById("showReportBtn");
  if (btn) {
    btn.addEventListener("click", showCatalogReport);
  } else {
    console.error("[customReport] #showReportBtn not found");
  }
});
