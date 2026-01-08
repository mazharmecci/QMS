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

  if (unitPrice === null) {
    tr.innerHTML = `
      <td>${rowNum}</td>
      <td>${quoteNo}</td>
      <td>${hospitalName}</td>
      <td>${label}</td>
      <td>${formattedDate}</td>
      <td>${qty}</td>
    `;
  } else {
    tr.innerHTML = `
      <td>${rowNum}</td>
      <td>${quoteNo}</td>
      <td>${hospitalName}</td>
      <td>${label}</td>
      <td>${formattedDate}</td>
      <td>${qty}</td>
      <td>₹ ${formatINR(unitPrice)}</td>
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
  const col = collection(db, "quoteHistory");
  const snap = await getDocs(
    query(col, orderBy("quoteNo"), orderBy("revision", "desc"))
  ); // latest revision per quote when folded [web:60][web:64]

  const latestByQuoteNo = new Map();

  snap.forEach(doc => {
    const data = doc.data();
    const qn = data.quoteNo || "UNKNOWN";
    if (!latestByQuoteNo.has(qn)) {
      latestByQuoteNo.set(qn, { id: doc.id, ...data });
    }
  });

  return Array.from(latestByQuoteNo.values());
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

/* ========= Tab 2 – By Hospital (latest revision from Firestore) ========= */

async function showHospitalReport() {
  const selector = document.getElementById("hospitalSelector");
  if (!selector) {
    console.error("[customReport] #hospitalSelector not found");
    return;
  }
  const selectedHospital = selector.value;
  if (!selectedHospital) return;

  const tbody = clearTbody("hospitalReportTable");
  if (!tbody) return;

  const instruments = getInstrumentsMaster();
  let rowNum = 1;

  try {
    const docs = await getLatestHistoryDocs(); // each quoteNo only newest revision [web:60][web:64]

    docs.forEach(data => {
      const headerHospital =
        data.header && data.header.hospitalName
          ? data.header.hospitalName
          : "";

      const hospitalName =
        (typeof data.hospital === "string"
          ? data.hospital
          : (data.hospital && data.hospital.name) || headerHospital) || "";

      if (hospitalName !== selectedHospital) return;

      const quoteNo = data.quoteNo || (data.header && data.header.quoteNo) || "—";
      const quoteDate =
        data.quoteDate || (data.header && data.header.quoteDate) || "—";

      const items = data.items || [];
      const quoteLines = data.quoteLines || [];

      if (quoteLines.length) {
        // Preferred modern structure
        quoteLines.forEach(line => {
          const instIdx = line.instrumentIndex;
          let inst = {};

          if (Array.isArray(data.instruments) && instIdx != null) {
            inst = data.instruments[instIdx] || {};
          } else {
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
        // Legacy structure fallback
        items.forEach(item => {
          const inst =
            instruments.find(
              i => i.catalog === item.code || i.instrumentCode === item.code
            ) || {};
          const label = inst.instrumentName || inst.name || "—";
          const qty = item.quantity || 1;
          const price = item.price || 0;

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
  // Populate dropdowns
  populateCatalogDropdown();
  populateHospitalDropdown();
  populateConfigDropdown();
  populateAdditionalDropdown();

  // Tab 1 – By Catalog
  const catalogBtn = document.getElementById("showCatalogReportBtn");
  if (catalogBtn) {
    catalogBtn.addEventListener("click", showCatalogReport);
  } else {
    console.error("[customReport] #showCatalogReportBtn not found");
  }

  // Tab 2 – By Hospital (latest revision)
  const hospitalBtn = document.getElementById("showHospitalReportBtn");
  if (hospitalBtn) {
    hospitalBtn.addEventListener("click", showHospitalReport);
  } else {
    console.error("[customReport] #showHospitalReportBtn not found");
  }

  // Tab 3 – By Configuration Item
  const configBtn = document.getElementById("showConfigReportBtn");
  if (configBtn) {
    configBtn.addEventListener("click", showConfigReport);
  } else {
    console.error("[customReport] #showConfigReportBtn not found");
  }

  // Tab 4 – By Additional Item
  const additionalBtn = document.getElementById("showAdditionalReportBtn");
  if (additionalBtn) {
    additionalBtn.addEventListener("click", showAdditionalReport);
  } else {
    console.error("[customReport] #showAdditionalReportBtn not found");
  }
});
