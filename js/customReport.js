import { getInstrumentsMaster, getQuoteContext } from "../js/quoteService.js";

// 🔹 Populate dropdown with instruments from master
function populateInstrumentDropdown() {
  const instruments = getInstrumentsMaster();
  const selector = document.createElement("select");
  selector.id = "instrumentSelector";

  // Default option
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "-- Select Instrument --";
  selector.appendChild(defaultOpt);

  instruments.forEach((inst, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = inst.instrumentName || inst.name || `Instrument ${idx + 1}`;
    selector.appendChild(opt);
  });

  return selector;
}

// 🔹 Render report table for selected instrument
function showInstrumentReport() {
  const selector = document.getElementById("instrumentSelector");
  const selectedIndex = selector.value;
  const tbody = document.querySelector("#instrumentReportTable tbody");
  tbody.innerHTML = "";

  if (selectedIndex === "") return;

  const instruments = getInstrumentsMaster();
  const selectedInst = instruments[selectedIndex];
  const allQuotes = JSON.parse(localStorage.getItem("quotes") || "[]");

  let rowNum = 1;

  allQuotes.forEach(q => {
    const lines = q.lineItems || [];
    lines.forEach(line => {
      // Match instrument by code/catalog
      if (
        line.code === selectedInst.catalog ||
        line.code === selectedInst.instrumentCode
      ) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${rowNum++}</td>
          <td>${q.header?.hospitalName || "Unknown"}</td>
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
    <div class="controls">
      <!-- Dropdown injected here -->
    </div>
    <button id="showReportBtn">Show</button>
    <table id="instrumentReportTable">
      <thead>
        <tr>
          <th>#</th>
          <th>Hospital</th>
          <th>Date</th>
          <th>Quantity</th>
          <th>Unit Price (INR)</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;

  mount.appendChild(block);

  // Inject dropdown
  const selector = populateInstrumentDropdown();
  block.querySelector(".controls").appendChild(selector);

  // Wire button
  document.getElementById("showReportBtn").addEventListener("click", showInstrumentReport);
});
