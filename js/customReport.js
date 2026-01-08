import { getInstrumentsMaster } from "../js/quoteService.js";

// 🔹 Populate dropdown with catalog numbers
function populateCatalogDropdown() {
  const instruments = getInstrumentsMaster();
  const selector = document.createElement("select");
  selector.id = "catalogSelector";

  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "-- Select Catalog --";
  selector.appendChild(defaultOpt);

  instruments.forEach((inst, idx) => {
    const catalog = inst.catalog || inst.instrumentCode || `CAT-${idx + 1}`;
    const opt = document.createElement("option");
    opt.value = catalog;
    opt.textContent = catalog;
    selector.appendChild(opt);
  });

  return selector;
}

// 🔹 Render report table for selected catalog
function showCatalogReport() {
  const selector = document.getElementById("catalogSelector");
  const selectedCatalog = selector.value;
  const tbody = document.querySelector("#instrumentReportTable tbody");
  tbody.innerHTML = "";

  if (!selectedCatalog) return;

  const instruments = getInstrumentsMaster();
  const allQuotes = JSON.parse(localStorage.getItem("quotes") || "[]");

  let rowNum = 1;

  allQuotes.forEach(q => {
    const lines = q.lineItems || [];
    lines.forEach(line => {
      if (
        line.code === selectedCatalog
      ) {
        const inst = instruments.find(
          i => i.catalog === selectedCatalog || i.instrumentCode === selectedCatalog
        );

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${rowNum++}</td>
          <td>${q.header?.hospitalName || "Unknown"}</td>
          <td>${inst?.instrumentName || inst?.name || "—"}</td>
          <td>${q.header?.quoteDate || "—"}</td>
          <td>${line.quantity || 1}</td>
          <td>₹ ${line.price ? line.price.toLocaleString("en-IN") : "—"}</td>
        `;
        tbody.appendChild(tr);
      }
    });
  });
}

// 🔹 Mount UI into #reportMount
document.addEventListener("DOMContentLoaded", () => {
  const mount = document.getElementById("reportMount");

  const block = document.createElement("div");
  block.className = "instrument-report-block";
  block.innerHTML = `
    <h3>Instrument Supply History</h3>
    <div class="controls"></div>
    <button id="showReportBtn">Show</button>
    <table id="instrumentReportTable">
      <thead>
        <tr>
          <th>#</th>
          <th>Hospital</th>
          <th>Instrument Name</th>
          <th>Date</th>
          <th>Quantity</th>
          <th>Unit Price (INR)</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;

  mount.appendChild(block);

  // Inject catalog dropdown
  const selector = populateCatalogDropdown();
  block.querySelector(".controls").appendChild(selector);

  // Wire button
  document.getElementById("showReportBtn").addEventListener("click", showCatalogReport);
});
