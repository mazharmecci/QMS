// customReport.js

import { getInstrumentsMaster } from "../js/quoteService.js";
import {
  db,
  collection,
  getDocs,
  query,
  orderBy
} from "../js/firebase.js";

/* ========= Local quotes (legacy, Tabs 1 & hospital dropdown) ========= */

function getAllQuotes() {
  return JSON.parse(localStorage.getItem("quotes") || "[]");
}

/* ========= Formatting helpers ========= */

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

/* ========= Generic DOM helpers ========= */

function clearTbody(tableId) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  if (!tbody) {
    console.error("[customReport] tbody not found for", tableId);
    return null;
  }
  tbody.innerHTML = "";
  return tbody;
}

/**
 * Append a row to a report table.
 * Columns (with price): Row, Quote No, Hospital, Item, Date, Qty, Price.
 * Columns (no price):  Row, Quote No, Hospital, Item, Date, Qty.
 */
function appendRow(
  tbody,
  rowNum,
  quoteNo,
  hospitalName,
  label,
  date,
  qty,
  unitPrice
) {
  const tr = document.createElement("tr");
  const formattedDate = formatDate(date);

  const tableId = tbody.closest("table")?.id || "";

  // Tab 3 (configReportTable) has NO Unit Price column.
  const hasPriceColumn = tableId !== "configReportTable";

  if (hasPriceColumn) {
    tr.innerHTML = `
      <td>${rowNum}</td>
      <td>${quoteNo}</td>
      <td>${hospitalName}</td>
      <td>${label}</td>
      <td>${formattedDate}</td>
      <td>${qty}</td>
      <td>${
        unitPrice != null ? "₹ " + formatINR(unitPrice) : "₹ " + formatINR(0)
      }</td>
    `;
  } else {
    // Config tab: 6 columns only
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

/* ========= Dropdown helpers ========= */

function buildUniqueSorted(list, extractor) {
  const map = {};
  list.forEach((item, idx) => {
    const val = extractor(item, idx);
    if (val) map[val] = true;
  });
  const keys = Object.keys(map);
  keys.sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
  return keys;
}

function populateSelect(selectorId, placeholder, options) {
  const el = document.getElementById(selectorId);
  if (!el) {
    console.error("[customReport] select not found:", selectorId);
    return;
  }
  el.innerHTML = "";

  const def = document.createElement("option");
  def.value = "";
  def.textContent = placeholder;
  el.appendChild(def);

  options.forEach(val => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = val;
    el.appendChild(opt);
  });
}

/* ========= Firestore helpers: latest revision per quote ========= */

/**
 * Load all quoteHistory docs ordered by quoteNo asc, revision desc,
 * then keep only the first doc per quoteNo (i.e. the highest revision).
 * Requires fields: quoteNo (string), revision (number or sortable string).
 */
async function getLatestHistoryDocs() {
  console.log("[getLatestHistoryDocs] ===== STARTING FETCH FROM FIRESTORE =====");
  
  try {
    const col = collection(db, "quoteHistory");
    const snap = await getDocs(
      query(col, orderBy("quoteNo"), orderBy("revision", "desc"))
    );

    console.log("[getLatestHistoryDocs] Raw docs from Firestore:", snap.size);

    const latestByQuoteNo = new Map();

    snap.forEach((doc) => {
      const data = doc.data();
      const qn = data.quoteNo || "UNKNOWN";
      
      console.log(`[getLatestHistoryDocs] Processing doc: docId=${doc.id}, quoteNo=${qn}, revision=${data.revision}`);

      if (!latestByQuoteNo.has(qn)) {
        console.log(`[getLatestHistoryDocs] ✓ KEEPING ${qn} (first occurrence = latest)`);
        latestByQuoteNo.set(qn, { id: doc.id, ...data });
      } else {
        console.log(`[getLatestHistoryDocs] ✗ SKIPPING ${qn} (duplicate quoteNo, keeping only latest revision)`);
      }
    });

    const result = Array.from(latestByQuoteNo.values());
    console.log("[getLatestHistoryDocs] ===== FINAL DEDUPED DOCS =====");
    console.log("[getLatestHistoryDocs] Total unique docs to return:", result.length);
    result.forEach((doc, idx) => {
      console.log(`[getLatestHistoryDocs] Doc ${idx}: quoteNo=${doc.quoteNo}, itemsCount=${(doc.items || []).length}, quoteLinesCount=${(doc.quoteLines || []).length}`);
    });
    
    return result;
  } catch (err) {
    console.error("[getLatestHistoryDocs] ERROR:", err);
    throw err;
  }
}

/* ========= Populate dropdowns ========= */

function populateCatalogDropdown() {
  const instruments = getInstrumentsMaster();
  const catalogs = buildUniqueSorted(instruments, (inst, idx) => {
    return inst.catalog || inst.instrumentCode || `CAT-${idx + 1}`;
  });
  populateSelect("catalogSelector", "-- Select Catalog --", catalogs);
}

function populateHospitalDropdown() {
  const allQuotes = getAllQuotes();
  const hospitals = buildUniqueSorted(allQuotes, q => {
    return (q.header && q.header.hospitalName) || null;
  });
  populateSelect("hospitalSelector", "-- Select Hospital --", hospitals);
}

async function populateConfigDropdown() {
  try {
    const docs = await getLatestHistoryDocs();
    const configNames = {};

    docs.forEach(data => {
      const items = data.items || [];
      items.forEach(item => {
        (item.configItems || []).forEach(config => {
          const name = config.name || config.code || null;
          if (name) configNames[name] = true;
        });
      });

      const quoteLines = data.quoteLines || [];
      quoteLines.forEach(line => {
        (line.configItems || []).forEach(config => {
          const name = config.name || config.code || null;
          if (name) configNames[name] = true;
        });
      });
    });

    const configList = Object.keys(configNames).sort((a, b) =>
      a.localeCompare(b)
    );

    populateSelect(
      "configSelector",
      "-- Select Configuration item --",
      configList
    );
    console.log(
      "[customReport] Config dropdown populated with",
      configList.length,
      "items"
    );
  } catch (err) {
    console.error("[customReport] Error fetching configs:", err);
  }
}

async function populateAdditionalDropdown() {
  try {
    const docs = await getLatestHistoryDocs();
    const additionalNames = {};

    docs.forEach(data => {
      const items = data.items || [];
      items.forEach(item => {
        (item.additionalItems || []).forEach(additional => {
          const name = additional.name || additional.code || null;
          if (name) additionalNames[name] = true;
        });
      });

      const quoteLines = data.quoteLines || [];
      quoteLines.forEach(line => {
        (line.additionalItems || []).forEach(additional => {
          const name = additional.name || additional.code || null;
          if (name) additionalNames[name] = true;
        });
      });
    });

    const additionalList = Object.keys(additionalNames).sort((a, b) =>
      a.localeCompare(b)
    );

    populateSelect(
      "additionalSelector",
      "-- Select Additional item --",
      additionalList
    );
    console.log(
      "[customReport] Additional dropdown populated with",
      additionalList.length,
      "items"
    );
  } catch (err) {
    console.error("[customReport] Error fetching additionals:", err);
  }
}

/* ========= Tab 1 – By Catalog (local quotes) ========= */

function showCatalogReport() {
  const selector = document.getElementById("catalogSelector");
  if (!selector) {
    console.error("[customReport] #catalogSelector not found");
    return;
  }
  const selectedCatalog = selector.value;
  if (!selectedCatalog) return;

  const tbody = clearTbody("catalogReportTable");
  if (!tbody) return;

  const instruments = getInstrumentsMaster();
  const allQuotes = getAllQuotes();
  let rowNum = 1;

  allQuotes.forEach(q => {
    const lines = q.lineItems || [];
    lines.forEach(line => {
      if (line.code === selectedCatalog) {
        const inst =
          instruments.find(
            i =>
              i.catalog === selectedCatalog ||
              i.instrumentCode === selectedCatalog
          ) || {};

        const quoteNo = (q.header && q.header.quoteNo) || "—";
        const hospitalName = (q.header && q.header.hospitalName) || "Unknown";
        const label = inst.instrumentName || inst.name || "—";
        const date = (q.header && q.header.quoteDate) || "—";
        const qty = line.quantity || 1;
        const price = line.price;

        appendRow(
          tbody,
          rowNum++,
          quoteNo,
          hospitalName,
          label,
          date,
          qty,
          price
        );
      }
    });
  });
}

/* ========= Tab 1 – By Instrument (latest revision from Firestore) ========= */

async function showInstrumentReport() {
  console.log("[showInstrumentReport] ========== STARTING TAB 1 REPORT ==========");

  const selector = document.getElementById("catalogSelector");
  if (!selector) {
    console.error("[showInstrumentReport] #catalogSelector not found");
    return;
  }

  const selectedCatalog = selector.value;
  console.log("[showInstrumentReport] selectedCatalog:", selectedCatalog);

  if (!selectedCatalog) {
    console.warn("[showInstrumentReport] No catalog selected");
    return;
  }

  const tbody = clearTbody("instrumentReportTable");
  if (!tbody) {
    console.error("[showInstrumentReport] tbody not found");
    return;
  }

  const instruments = getInstrumentsMaster();
  console.log("[showInstrumentReport] instruments master count:", instruments.length);

  let rowNum = 1;
  const processedRows = []; // Track all rows for debugging

  try {
    console.log("[showInstrumentReport] Fetching latest history docs...");
    const docs = await getLatestHistoryDocs();
    console.log("[showInstrumentReport] ===== FIRESTORE FETCH RESULTS =====");
    console.log("[showInstrumentReport] Total docs returned:", docs.length);
    
    // Log each document ID and structure
    docs.forEach((doc, idx) => {
      console.log(`[showInstrumentReport] Doc ${idx}:`, {
        docId: doc.docId || doc.id || "NO_ID",
        quoteNo: doc.quoteNo || "NO_QUOTE_NO",
        hospital: doc.hospital || "NO_HOSPITAL",
        itemsCount: (doc.items || []).length,
        quoteLinesCount: (doc.quoteLines || []).length,
        fullDoc: doc
      });
    });

    if (!docs.length) {
      console.warn("[showInstrumentReport] No docs returned from getLatestHistoryDocs");
      return;
    }

    let docMatchCount = 0;

    docs.forEach((data, docIdx) => {
      const quoteNo = data.quoteNo || (data.header && data.header.quoteNo) || "—";
      const quoteDate = data.quoteDate || (data.header && data.header.quoteDate) || "—";
      const hospitalName =
        data.hospital && typeof data.hospital === "string"
          ? data.hospital
          : (data.hospital && data.hospital.name) ||
            (data.header && data.header.hospitalName) ||
            "";

      const items = data.items || [];
      const quoteLines = data.quoteLines || [];

      console.log(`[showInstrumentReport] Processing Doc ${docIdx} (${quoteNo}):`, {
        hospital: hospitalName,
        hasItems: items.length > 0,
        itemsCount: items.length,
        hasQuoteLines: quoteLines.length > 0,
        quoteLinesCount: quoteLines.length
      });

      if (quoteLines.length) {
        // Modern quoteLines structure
        console.log(`[showInstrumentReport] Doc ${docIdx} using quoteLines (${quoteLines.length} items)`);

        quoteLines.forEach((line, lineIdx) => {
          const lineCode = line.code || line.catalogCode || "NO_CODE";
          console.log(`[showInstrumentReport] Doc ${docIdx} Line ${lineIdx}: code="${lineCode}"`);

          if (lineCode !== selectedCatalog) {
            console.log(`[showInstrumentReport] Doc ${docIdx} Line ${lineIdx}: SKIP (not matching catalog)`);
            return; // skip
          }

          docMatchCount++;
          console.log(`[showInstrumentReport] ✓ Doc ${docIdx} Line ${lineIdx}: MATCH! Processing row...`);

          const instIdx = line.instrumentIndex;
          let inst = {};

          if (instIdx != null && instIdx >= 0) {
            inst = instruments[instIdx] || {};
          }

          if (!inst || !inst.instrumentName) {
            inst =
              instruments.find(
                i =>
                  i.catalog === lineCode || i.instrumentCode === lineCode
              ) || {};
          }

          const label = inst.instrumentName || inst.name || "—";
          const qty = line.quantity || 1;
          const price =
            line.unitPriceOverride != null
              ? line.unitPriceOverride
              : inst.unitPrice || 0;

          const rowData = {
            rowNum: rowNum,
            quoteNo,
            hospitalName,
            label,
            quoteDate,
            qty,
            price,
            sourceDoc: docIdx,
            sourceLine: lineIdx
          };

          processedRows.push(rowData);

          console.log(`[showInstrumentReport] Appending Row ${rowNum}:`, rowData);

          appendRow(tbody, rowNum++, quoteNo, hospitalName, label, quoteDate, qty, price);
        });
      } else if (items.length) {
        // Legacy items structure
        console.log(`[showInstrumentReport] Doc ${docIdx} using items (${items.length} items)`);

        items.forEach((item, itemIdx) => {
          const itemCode = item.code || item.catalog || item.catalogCode || "NO_CODE";
          console.log(`[showInstrumentReport] Doc ${docIdx} Item ${itemIdx}: code="${itemCode}"`);

          if (itemCode !== selectedCatalog) {
            console.log(`[showInstrumentReport] Doc ${docIdx} Item ${itemIdx}: SKIP (not matching catalog)`);
            return; // skip
          }

          docMatchCount++;
          console.log(`[showInstrumentReport] ✓ Doc ${docIdx} Item ${itemIdx}: MATCH! Processing row...`);

          let label = item.name || item.instrumentName || "—";

          if (label === "—" && item.description) {
            const lines = item.description.split("\n");
            label = (lines[0] || "").trim() || "—";
          }

          const qty = item.quantity || 1;
          const price = item.price || item.unitPrice || 0;

          const rowData = {
            rowNum: rowNum,
            quoteNo,
            hospitalName,
            label,
            quoteDate,
            qty,
            price,
            sourceDoc: docIdx,
            sourceItem: itemIdx
          };

          processedRows.push(rowData);

          console.log(`[showInstrumentReport] Appending Row ${rowNum}:`, rowData);

          appendRow(tbody, rowNum++, quoteNo, hospitalName, label, quoteDate, qty, price);
        });
      } else {
        console.log(`[showInstrumentReport] Doc ${docIdx}: SKIP (no items or quoteLines)`);
      }
    });

    console.log("[showInstrumentReport] ===== FINAL RESULTS =====");
    console.log("[showInstrumentReport] Total docs processed:", docs.length);
    console.log("[showInstrumentReport] Total matching rows appended:", rowNum - 1);
    console.log("[showInstrumentReport] Processed rows array:", processedRows);
    console.log("[showInstrumentReport] ========== REPORT COMPLETE ==========");

  } catch (err) {
    console.error("[showInstrumentReport] Error rendering instrument report:", err);
  }
}

/* ========= Tab 2 – By Hospital (latest revision from Firestore) ========= */

async function showHospitalReport() {
  console.log("[showHospitalReport] Function called");

  const selector = document.getElementById("hospitalSelector");
  if (!selector) {
    console.error("[customReport] #hospitalSelector not found");
    return;
  }

  const selectedHospital = selector.value;
  console.log("[showHospitalReport] selectedHospital:", selectedHospital);

  if (!selectedHospital) {
    console.warn("[showHospitalReport] No hospital selected");
    return;
  }

  const tbody = clearTbody("hospitalReportTable");
  if (!tbody) {
    console.error("[showHospitalReport] tbody not found");
    return;
  }

  const instruments = getInstrumentsMaster();
  console.log("[showHospitalReport] instruments master count:", instruments.length);

  let rowNum = 1;

  try {
    console.log("[showHospitalReport] Fetching latest history docs...");
    const docs = await getLatestHistoryDocs();
    console.log("[showHospitalReport] Total latest docs:", docs.length);

    if (!docs.length) {
      console.warn("[showHospitalReport] No docs returned from getLatestHistoryDocs");
      return;
    }

    docs.forEach((data, docIdx) => {
      const headerHospital =
        data.header && data.header.hospitalName
          ? data.header.hospitalName
          : "";

      const hospitalName =
        (typeof data.hospital === "string"
          ? data.hospital
          : (data.hospital && data.hospital.name) || headerHospital) || "";

      if (hospitalName !== selectedHospital) return;

      console.log(`[showHospitalReport] Doc ${docIdx} matches!`);

      const quoteNo = data.quoteNo || (data.header && data.header.quoteNo) || "—";
      const quoteDate =
        data.quoteDate || (data.header && data.header.quoteDate) || "—";

      const items = data.items || [];
      const quoteLines = data.quoteLines || [];

      if (quoteLines.length) {
        // Modern quoteLines structure
        quoteLines.forEach((line, lineIdx) => {
          const instIdx = line.instrumentIndex;
          let inst = {};

          if (instIdx != null && instIdx >= 0) {
            inst = instruments[instIdx] || {};
          }

          if (!inst || !inst.instrumentName) {
            inst =
              instruments.find(
                i =>
                  i.catalog === line.code || i.instrumentCode === line.code
              ) || {};
          }

          const label = inst.instrumentName || inst.name || "—";
          const qty = line.quantity || 1;
          const price =
            line.unitPriceOverride != null
              ? line.unitPriceOverride
              : inst.unitPrice || 0;

          appendRow(
            tbody,
            rowNum++,
            quoteNo,
            hospitalName,
            label,
            quoteDate,
            qty,
            price
          );
        });
      } else if (items.length) {
        // Legacy items structure (no code field; use item.name or first line of description)
        items.forEach((item, itemIdx) => {
          // For legacy items, the name is stored as 'name' or in 'description'
          let label = item.name || item.instrumentName || "—";

          // If no name, try parsing first line of description
          if (label === "—" && item.description) {
            const lines = item.description.split("\n");
            label = (lines[0] || "").trim() || "—";
          }

          const qty = item.quantity || 1;
          const price = item.price || item.unitPrice || 0;

          console.log(`[showHospitalReport] Item ${itemIdx}: label="${label}"`);

          appendRow(
            tbody,
            rowNum++,
            quoteNo,
            hospitalName,
            label,
            quoteDate,
            qty,
            price
          );
        });
      }
    });

    console.log("[showHospitalReport] Completed. Total rows appended:", rowNum - 1);
  } catch (err) {
    console.error("[customReport] Error rendering hospital report:", err);
  }
}

/* ========= Tab 3 – By Configuration Item (latest revision) ========= */

async function showConfigReport() {
  const selector = document.getElementById("configSelector");
  if (!selector) {
    console.error("[customReport] #configSelector not found");
    return;
  }
  const selectedConfig = selector.value;
  if (!selectedConfig) return;

  const tbody = clearTbody("configReportTable");
  if (!tbody) return;

  try {
    const docs = await getLatestHistoryDocs();
    let rowNum = 1;

    docs.forEach(data => {
      const quoteNo = data.quoteNo || "—";
      const hospitalName = typeof data.hospital === "string"
        ? data.hospital
        : (data.hospital && data.hospital.name) || "Unknown";
      const quoteDate = data.quoteDate || "—";

      const items = data.items || [];
      items.forEach(item => {
        (item.configItems || []).forEach(config => {
          const itemName = config.name || config.code || "—";
          if (itemName === selectedConfig) {
            const qty = config.qty || "Included";
            appendRow(
              tbody,
              rowNum++,
              quoteNo,
              hospitalName,
              itemName,
              quoteDate,
              qty,
              null
            );
          }
        });
      });

      const quoteLines = data.quoteLines || [];
      quoteLines.forEach(line => {
        (line.configItems || []).forEach(config => {
          const itemName = config.name || config.code || "—";
          if (itemName === selectedConfig) {
            const qty = config.qty || "Included";
            appendRow(
              tbody,
              rowNum++,
              quoteNo,
              hospitalName,
              itemName,
              quoteDate,
              qty,
              null
            );
          }
        });
      });
    });
  } catch (err) {
    console.error("[customReport] Error rendering config report:", err);
  }
}

/* ========= Tab 4 – By Additional Item (latest revision) ========= */

async function showAdditionalReport() {
  const selector = document.getElementById("additionalSelector");
  if (!selector) {
    console.error("[customReport] #additionalSelector not found");
    return;
  }
  const selectedAdditional = selector.value;
  if (!selectedAdditional) return;

  const tbody = clearTbody("additionalReportTable");
  if (!tbody) return;

  try {
    const docs = await getLatestHistoryDocs();
    let rowNum = 1;

    docs.forEach(data => {
      const quoteNo = data.quoteNo || "—";
      const hospitalName = typeof data.hospital === "string"
        ? data.hospital
        : (data.hospital && data.hospital.name) || "Unknown";
      const quoteDate = data.quoteDate || "—";

      const items = data.items || [];
      items.forEach(item => {
        (item.additionalItems || []).forEach(additional => {
          const itemName = additional.name || additional.code || "—";
          if (itemName === selectedAdditional) {
            const qty = additional.qty || 1;
            const price = additional.price || 0;
            appendRow(
              tbody,
              rowNum++,
              quoteNo,
              hospitalName,
              itemName,
              quoteDate,
              qty,
              price
            );
          }
        });
      });

      const quoteLines = data.quoteLines || [];
      quoteLines.forEach(line => {
        (line.additionalItems || []).forEach(additional => {
          const itemName = additional.name || additional.code || "—";
          if (itemName === selectedAdditional) {
            const qty = additional.qty || 1;
            const price = additional.price || 0;
            appendRow(
              tbody,
              rowNum++,
              quoteNo,
              hospitalName,
              itemName,
              quoteDate,
              qty,
              price
            );
          }
        });
      });
    });
  } catch (err) {
    console.error("[customReport] Error rendering additional report:", err);
  }
}

/* ========= Init wiring ========= */

document.addEventListener("DOMContentLoaded", () => {
  console.log("[customReport] ===== DOMContentLoaded FIRED =====");

  // Populate dropdowns
  console.log("[customReport] Populating catalog dropdown...");
  populateCatalogDropdown();
  
  console.log("[customReport] Populating hospital dropdown...");
  populateHospitalDropdown();
  
  console.log("[customReport] Populating config dropdown...");
  populateConfigDropdown().catch(err => console.error("[customReport] Error in populateConfigDropdown:", err));
  
  console.log("[customReport] Populating additional dropdown...");
  populateAdditionalDropdown().catch(err => console.error("[customReport] Error in populateAdditionalDropdown:", err));

  // Tab 1 – By Instrument (Firestore latest revision)
  const instrumentBtn = document.getElementById("showInstrumentReportBtn");
  if (instrumentBtn) {
    console.log("[customReport] ✓ Found #showInstrumentReportBtn, wiring click handler...");
    instrumentBtn.addEventListener("click", async () => {
      console.log("[customReport] ========== INSTRUMENT REPORT BUTTON CLICKED ==========");
      try {
        await showInstrumentReport();
      } catch (err) {
        console.error("[customReport] ERROR in showInstrumentReport:", err);
      }
    });
  } else {
    console.error("[customReport] ✗ #showInstrumentReportBtn NOT FOUND");
  }

  // Tab 2 – By Hospital (latest revision)
  const hospitalBtn = document.getElementById("showHospitalReportBtn");
  if (hospitalBtn) {
    console.log("[customReport] ✓ Found #showHospitalReportBtn, wiring click handler...");
    hospitalBtn.addEventListener("click", async () => {
      console.log("[customReport] ========== HOSPITAL REPORT BUTTON CLICKED ==========");
      try {
        await showHospitalReport();
      } catch (err) {
        console.error("[customReport] ERROR in showHospitalReport:", err);
      }
    });
  } else {
    console.error("[customReport] ✗ #showHospitalReportBtn NOT FOUND");
  }

  // Tab 3 – By Configuration Item
  const configBtn = document.getElementById("showConfigReportBtn");
  if (configBtn) {
    console.log("[customReport] ✓ Found #showConfigReportBtn, wiring click handler...");
    configBtn.addEventListener("click", async () => {
      console.log("[customReport] ========== CONFIG REPORT BUTTON CLICKED ==========");
      try {
        await showConfigReport();
      } catch (err) {
        console.error("[customReport] ERROR in showConfigReport:", err);
      }
    });
  } else {
    console.error("[customReport] ✗ #showConfigReportBtn NOT FOUND");
  }

  // Tab 4 – By Additional Item
  const additionalBtn = document.getElementById("showAdditionalReportBtn");
  if (additionalBtn) {
    console.log("[customReport] ✓ Found #showAdditionalReportBtn, wiring click handler...");
    additionalBtn.addEventListener("click", async () => {
      console.log("[customReport] ========== ADDITIONAL REPORT BUTTON CLICKED ==========");
      try {
        await showAdditionalReport();
      } catch (err) {
        console.error("[customReport] ERROR in showAdditionalReport:", err);
      }
    });
  } else {
    console.error("[customReport] ✗ #showAdditionalReportBtn NOT FOUND");
  }

  console.log("[customReport] ===== DOMContentLoaded COMPLETE =====");
});
