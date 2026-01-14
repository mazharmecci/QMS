import { getInstrumentsMaster } from "../js/quoteService.js";
import {
  db,
  collection,
  getDocs,
  query,
  orderBy
} from "../js/firebase.js";

/* ========= Core Data Access ========= */

function getAllQuotes() {
  return JSON.parse(localStorage.getItem("quotes") || "[]");
}

async function getLatestHistoryDocs() {
  console.log("[getLatestHistoryDocs] Fetching latest revisions from Firestore...");
  
  try {
    const col = collection(db, "quoteHistory");
    const snap = await getDocs(
      query(col, orderBy("quoteNo"), orderBy("revision", "desc"))
    );

    const latestByQuoteNo = new Map();
    snap.forEach((doc) => {
      const data = doc.data();
      const qn = data.quoteNo || "UNKNOWN";
      
      // FILTER: Skip deleted quotes
      if (data.status === "DELETED") {
        console.log(`[getLatestHistoryDocs] Skipping deleted quote: ${qn}`);
        return;
      }

      // FILTER: Keep only latest revision per quote
      if (!latestByQuoteNo.has(qn)) {
        latestByQuoteNo.set(qn, { id: doc.id, ...data });
      }
    });

    const result = Array.from(latestByQuoteNo.values());
    console.log(`[getLatestHistoryDocs] ✓ ${result.length} unique active docs loaded (deleted excluded)`);
    return result;
  } catch (err) {
    console.error("[getLatestHistoryDocs] Error:", err);
    throw err;
  }
}

/* ========= Formatting & DOM Helpers ========= */

function formatINR(value) {
  const num = value != null ? Number(value) : null;
  if (num == null || Number.isNaN(num)) return "—";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(dateStr) {
  if (!dateStr || dateStr === "—") return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function clearTbody(tableId) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  if (!tbody) {
    console.error(`[clearTbody] #${tableId} tbody not found`);
    return null;
  }
  tbody.innerHTML = "";
  return tbody;
}

function appendRow(tbody, rowNum, quoteNo, hospitalName, label, date, qty, unitPrice = null) {
  const tr = document.createElement("tr");
  const formattedDate = formatDate(date);
  const tableId = tbody.closest("table")?.id || "";
  const hasPriceColumn = tableId !== "configReportTable";

  if (hasPriceColumn) {
    tr.innerHTML = `
      <td>${rowNum}</td>
      <td>${quoteNo}</td>
      <td>${hospitalName}</td>
      <td>${label}</td>
      <td>${formattedDate}</td>
      <td>${qty}</td>
      <td>${unitPrice != null ? "₹ " + formatINR(unitPrice) : "₹ —"}</td>
    `;
  } else {
    tr.innerHTML = `
      <td>${rowNum}</td>
      <td>${quoteNo}</td>
      <td>${hospitalName}</td>
      <td>${label}</td>
      <td>${formattedDate}</td>
      <td>${qty}</td>
    `;
  }
  tbody.appendChild(tr);
}

/* ========= Dropdown Population ========= */

function buildUniqueSorted(list, extractor) {
  const map = {};
  list.forEach((item) => {
    const val = extractor(item);
    if (val) map[val] = true;
  });
  return Object.keys(map).sort((a, b) => {
    const na = Number(a), nb = Number(b);
    return !Number.isNaN(na) && !Number.isNaN(nb) ? na - nb : a.localeCompare(b);
  });
}

function populateSelect(selectorId, placeholder, options) {
  const el = document.getElementById(selectorId);
  if (!el) {
    console.error(`[populateSelect] #${selectorId} not found`);
    return;
  }
  el.innerHTML = `<option value="">${placeholder}</option>`;
  options.forEach(val => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = val;
    el.appendChild(opt);
  });
}

function populateCatalogDropdown() {
  const instruments = getInstrumentsMaster();
  const catalogs = buildUniqueSorted(instruments, inst => inst.catalog || inst.instrumentCode);
  populateSelect("catalogSelector", "-- Select Catalog --", catalogs);
}

function populateHospitalDropdown() {
  const allQuotes = getAllQuotes();
  const hospitals = buildUniqueSorted(allQuotes, q => q.header?.hospitalName);
  populateSelect("hospitalSelector", "-- Select Hospital --", hospitals);
}

async function populateConfigDropdown() {
  try {
    const docs = await getLatestHistoryDocs();
    const configs = new Set();
    
    docs.forEach(data => {
      (data.quoteLines || []).forEach(item => {
        (item.configItems || []).forEach(config => {
          const name = config.name || config.code;
          if (name) configs.add(name);
        });
      });
    });
    
    populateSelect("configSelector", "-- Select Configuration item --", Array.from(configs).sort());
    console.log(`[populateConfigDropdown] ✓ ${configs.size} configs loaded`);
  } catch (err) {
    console.error("[populateConfigDropdown] Error:", err);
  }
}

async function populateAdditionalDropdown() {
  try {
    const docs = await getLatestHistoryDocs();
    const additionals = new Set();
    
    docs.forEach(data => {
      (data.quoteLines || []).forEach(item => {
        (item.additionalItems || []).forEach(additional => {
          const name = additional.name || additional.code;
          if (name) additionals.add(name);
        });
      });
    });
    
    populateSelect("additionalSelector", "-- Select Additional item --", Array.from(additionals).sort());
    console.log(`[populateAdditionalDropdown] ✓ ${additionals.size} additionals loaded`);
  } catch (err) {
    console.error("[populateAdditionalDropdown] Error:", err);
  }
}

/* ========= Report Generation Core ========= */

function getQuoteInfo(data) {
  return {
    quoteNo: data.quoteNo || data.header?.quoteNo || "—",
    quoteDate: data.quoteDate || data.header?.quoteDate || "—",
    hospitalName: typeof data.hospital === "string" 
      ? data.hospital 
      : data.hospital?.name || data.header?.hospitalName || "Unknown"
  };
}

function findInstrument(instruments, codeOrIndex) {
  if (typeof codeOrIndex === "number" && codeOrIndex >= 0) {
    return instruments[codeOrIndex] || {};
  }
  return instruments.find(i => i.catalog === codeOrIndex || i.instrumentCode === codeOrIndex) || {};
}

async function generateReport(selectorId, tableId, filterFn, hasPriceColumn = true) {
  const selector = document.getElementById(selectorId);
  if (!selector?.value) {
    console.warn(`[generateReport ${tableId}] No selection`);
    return;
  }

  const tbody = clearTbody(tableId);
  if (!tbody) return;

  const instruments = getInstrumentsMaster();
  const selectedValue = selector.value;
  let rowNum = 1;

  try {
    console.log(`[generateReport ${tableId}] Generating for "${selectedValue}"...`);
    const docs = await getLatestHistoryDocs();
    
    let matchCount = 0;
    docs.forEach(data => {
      const { quoteNo, quoteDate, hospitalName } = getQuoteInfo(data);
      
      // Use ONLY quoteLines (primary source), NOT items (legacy fallback)
      const items = data.quoteLines || [];
      
      items.forEach(item => {
        const rowData = filterFn(item, instruments, selectedValue, data);
        if (rowData) {
          matchCount++;
          appendRow(tbody, rowNum++, quoteNo, hospitalName, rowData.label, 
                   quoteDate, rowData.qty, rowData.price);
        }
      });
    });
    
    console.log(`[generateReport ${tableId}] ✓ ${matchCount} rows from ${docs.length} docs`);
  } catch (err) {
    console.error(`[generateReport ${tableId}] Error:`, err);
  }
}

/* ========= Table-Aware Report Functions ========= */

async function showInstrumentReport(tableId = "catalogReportTable") {
  const selector = document.getElementById("catalogSelector");
  if (!selector?.value) {
    console.warn("[showInstrumentReport] No selection");
    return;
  }

  const tbody = clearTbody(tableId);
  if (!tbody) return;

  const instruments = getInstrumentsMaster();
  const selectedCatalog = selector.value;
  let rowNum = 1;

  try {
    console.log(`[showInstrumentReport] Generating for "${selectedCatalog}"...`);
    const docs = await getLatestHistoryDocs();
    
    let matchCount = 0;
    docs.forEach(data => {
      const { quoteNo, quoteDate, hospitalName } = getQuoteInfo(data);
      
      // Use quoteLines if available, otherwise fallback to legacy items
      const items = data.quoteLines || data.items || [];
      
      console.log(`[showInstrumentReport] Quote ${quoteNo}: using ${data.quoteLines ? 'quoteLines' : 'legacy items'}, count: ${items.length}`);
      
      items.forEach(item => {
        const code =
          item.code ||
          item.catalogCode ||
          item.catalog ||
          item.instrumentCode ||
          item.catalogNo ||
          item.catalogNoCode;

        if (code !== selectedCatalog) return;

        const inst = findInstrument(instruments, code);
        return {
          label: inst.instrumentName || inst.name ||
                 item.name || (item.description?.split("\n")[0] || "").trim() || "—",
          qty: item.quantity || 1,
          price: item.unitPriceOverride ?? item.price ?? item.unitPrice ?? inst.unitPrice ?? 0
        };
      });

      items.forEach(item => {
        const code =
          item.code ||
          item.catalogCode ||
          item.catalog ||
          item.instrumentCode ||
          item.catalogNo ||
          item.catalogNoCode;

        if (code !== selectedCatalog) return;

        const inst = findInstrument(instruments, code);
        const label = inst.instrumentName || inst.name ||
                     item.name || (item.description?.split("\n")[0] || "").trim() || "—";
        const qty = item.quantity || 1;
        const price = item.unitPriceOverride ?? item.price ?? item.unitPrice ?? inst.unitPrice ?? 0;

        appendRow(tbody, rowNum++, quoteNo, hospitalName, label, quoteDate, qty, price);
        matchCount++;
      });
    });
    
    console.log(`[showInstrumentReport] ✓ ${matchCount} rows from ${docs.length} docs`);
  } catch (err) {
    console.error(`[showInstrumentReport] Error:`, err);
  }
}

async function showHospitalReport(tableId = "hospitalReportTable") {
  const selector = document.getElementById("hospitalSelector");
  if (!selector?.value) {
    console.warn("[showHospitalReport] No hospital selected");
    return;
  }

  const tbody = clearTbody(tableId);
  if (!tbody) return;

  const instruments = getInstrumentsMaster();
  const selectedHospital = selector.value;
  let rowNum = 1;

  try {
    const docs = await getLatestHistoryDocs();
    let matchCount = 0;

    docs.forEach(data => {
      const { quoteNo, quoteDate, hospitalName } = getQuoteInfo(data);
      if (hospitalName !== selectedHospital) return;

      // Use quoteLines if available, otherwise fallback to legacy items
      const allLines = data.quoteLines || data.items || [];
      
      console.log(`[showHospitalReport] Quote ${quoteNo}: using ${data.quoteLines ? 'quoteLines' : 'legacy items'}, count: ${allLines.length}`);

      allLines.forEach(item => {
        // Extract and display MAIN INSTRUMENT
        const catalogCode = 
          item.code ||
          item.catalogCode ||
          item.catalog ||
          item.instrumentCode ||
          item.catalogNo ||
          item.catalogNoCode;

        const inst = findInstrument(instruments, catalogCode);

        let mainLabel =
          inst.instrumentName ||
          inst.name ||
          item.instrumentName ||
          item.name ||
          "";

        if (!mainLabel && item.description) {
          mainLabel = (item.description.split("\n")[0] || "").trim();
        }

        if (!mainLabel) mainLabel = "—";

        const mainQty = item.quantity || 1;
        const mainPrice =
          item.unitPriceOverride ??
          item.price ??
          item.unitPrice ??
          inst.unitPrice ??
          0;

        // Add main instrument row
        appendRow(
          tbody,
          rowNum++,
          quoteNo,
          hospitalName,
          `[MAIN] ${mainLabel}`,
          quoteDate,
          mainQty,
          mainPrice
        );
        matchCount++;

        // Add CONFIG ITEMS (nested)
        const configItems = item.configItems || [];
        configItems.forEach(config => {
          const configLabel = config.name || config.code || "—";
          const configQty = config.qty || "Included";
          const configPrice = config.price || config.unitPrice || 0;

          appendRow(
            tbody,
            rowNum++,
            quoteNo,
            hospitalName,
            `  ├─ [CONFIG] ${configLabel}`,
            quoteDate,
            configQty,
            configPrice
          );
          matchCount++;
        });

        // Add ADDITIONAL ITEMS (nested)
        const additionalItems = item.additionalItems || [];
        additionalItems.forEach(additional => {
          const addLabel = additional.name || additional.code || "—";
          const addQty = additional.qty || 1;
          const addPrice = additional.price || additional.unitPrice || 0;

          appendRow(
            tbody,
            rowNum++,
            quoteNo,
            hospitalName,
            `  └─ [ADDITIONAL] ${addLabel}`,
            quoteDate,
            addQty,
            addPrice
          );
          matchCount++;
        });
      });
    });

    console.log(`[showHospitalReport ${tableId}] ✓ ${matchCount} total items (main + config + additional)`);
  } catch (err) {
    console.error(`[showHospitalReport ${tableId}] Error:`, err);
  }
}

async function showConfigReport(tableId = "configReportTable") {
  await generateReport("configSelector", tableId, (item, instruments, configName) => {
    const config = (item.configItems || []).find(c => (c.name || c.code) === configName);
    if (!config) return null;
    return {
      label: config.name || config.code || "—",
      qty: config.qty || "Included",
      price: null
    };
  }, false);
}

async function showAdditionalReport(tableId = "additionalReportTable") {
  await generateReport("additionalSelector", tableId, (item, instruments, additionalName) => {
    const additional = (item.additionalItems || []).find(a => (a.name || a.code) === additionalName);
    if (!additional) return null;
    return {
      label: additional.name || additional.code || "—",
      qty: additional.qty || 1,
      price: additional.price || additional.unitPrice || 0
    };
  });
}

/* ========= Tab Switching ========= */

function switchTab(tabName) {
  console.log(`[switchTab] Switching to: ${tabName}`);
  
  document.querySelectorAll(".report-panel").forEach(panel => 
    panel.classList.remove("active")
  );
  
  document.querySelectorAll(".report-tab").forEach(btn => 
    btn.classList.remove("active")
  );

  const panel = document.getElementById(`tab-${tabName}`);
  if (panel) panel.classList.add("active");

  const activeBtn = document.querySelector(`.report-tab[data-tab="${tabName}"]`);
  if (activeBtn) activeBtn.classList.add("active");
}

/* ========= Initialization ========= */

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[customReport] ===== INITIALIZING CUSTOM REPORTS =====");

  // Populate dropdowns
  console.log("[customReport] Populating dropdowns...");
  populateCatalogDropdown();
  populateHospitalDropdown();
  
  try {
    await Promise.all([populateConfigDropdown(), populateAdditionalDropdown()]);
    console.log("[customReport] ✓ All dropdowns populated");
  } catch (err) {
    console.error("[customReport] Dropdown population failed:", err);
  }

  // Wire tab switching
  document.querySelectorAll(".report-tab").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // Wire report buttons → table mapping
  const buttonConfigs = [
    { btnId: "showCatalogReportBtn", tableId: "catalogReportTable", handler: showInstrumentReport },
    { btnId: "showHospitalReportBtn", tableId: "hospitalReportTable", handler: showHospitalReport },
    { btnId: "showConfigReportBtn", tableId: "configReportTable", handler: showConfigReport },
    { btnId: "showAdditionalReportBtn", tableId: "additionalReportTable", handler: showAdditionalReport }
  ];
  
  buttonConfigs.forEach(({ btnId, tableId, handler }) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      console.log(`[customReport] ✓ #${btnId} → ${tableId}`);
      btn.addEventListener("click", async () => {
        console.log(`[${btnId}] → ${tableId} CLICKED`);
        try {
          await handler(tableId);
        } catch (err) {
          console.error(`[${btnId}] ERROR:`, err);
        }
      });
    } else {
      console.warn(`[customReport] ⚠️ #${btnId} missing`);
    }
  });

  console.log("[customReport] ===== INITIALIZATION COMPLETE =====");
});

