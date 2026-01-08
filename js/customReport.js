import { getInstrumentsMaster } from "../js/quoteService.js";

/* ========= Data helpers ========= */

function getAllQuotes() {
  return JSON.parse(localStorage.getItem("quotes") || "[]");
}

function formatINR(value) {
  const num = value != null ? Number(value) : null;
  if (num == null || isNaN(num)) return "—";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/* ========= Dropdown helpers ========= */

// Build a unique, sorted list from an array and extractor fn
function buildUniqueSorted(list, extractor) {
  const map = {};
  list.forEach(function (item, idx) {
    const val = extractor(item, idx);
    if (val) map[val] = true;
  });
  const keys = Object.keys(map);
  keys.sort(function (a, b) {
    const na = Number(a);
    const nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
  return keys;
}

// Populate a <select> with simple string options
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

  options.forEach(function (val) {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = val;
    el.appendChild(opt);
  });
}

/* ========= Populate dropdowns ========= */

function populateCatalogDropdown() {
  const instruments = getInstrumentsMaster();
  const catalogs = buildUniqueSorted(instruments, function (inst, idx) {
    return inst.catalog || inst.instrumentCode || ("CAT-" + (idx + 1));
  });
  populateSelect("catalogSelector", "-- Select Catalog --", catalogs);
}

function populateHospitalDropdown() {
  const allQuotes = getAllQuotes();
  const hospitals = buildUniqueSorted(allQuotes, function (q) {
    return (q.header && q.header.hospitalName) || null;
  });
  populateSelect("hospitalSelector", "-- Select Hospital --", hospitals);
}

function populateConfigDropdown() {
  const allQuotes = getAllQuotes();
  const configs = {};

  allQuotes.forEach(function (q) {
    const lines = q.lineItems || [];
    lines.forEach(function (line) {
      const configItems = line.configItems || [];
      configItems.forEach(function (item) {
        const configName = item.name || item.code || "Unknown";
        if (configName) configs[configName] = true;
      });
    });
  });

  const configList = Object.keys(configs).sort(function (a, b) {
    return a.localeCompare(b);
  });
  populateSelect("configSelector", "-- Select Configuration item --", configList);
}

function populateAdditionalDropdown() {
  const allQuotes = getAllQuotes();
  const additionals = {};

  allQuotes.forEach(function (q) {
    const lines = q.lineItems || [];
    lines.forEach(function (line) {
      const additionalItems = line.additionalItems || [];
      additionalItems.forEach(function (item) {
        const addName = item.name || item.code || "Unknown";
        if (addName) additionals[addName] = true;
      });
    });
  });

  const additionalList = Object.keys(additionals).sort(function (a, b) {
    return a.localeCompare(b);
  });
  populateSelect("additionalSelector", "-- Select Additional item --", additionalList);
}

/* ========= Render helpers ========= */

function clearTbody(tableId) {
  const tbody = document.querySelector("#" + tableId + " tbody");
  if (!tbody) {
    console.error("[customReport] tbody not found for", tableId);
    return null;
  }
  tbody.innerHTML = "";
  return tbody;
}

function appendRow(tbody, rowNum, hospitalName, label, date, qty, unitPrice) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${rowNum}</td>
    <td>${hospitalName}</td>
    <td>${label}</td>
    <td>${date}</td>
    <td>${qty}</td>
    <td>₹ ${formatINR(unitPrice)}</td>
  `;
  tbody.appendChild(tr);
}

/* ========= By Catalog report ========= */

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

  allQuotes.forEach(function (q) {
    const lines = q.lineItems || [];
    lines.forEach(function (line) {
      if (line.code === selectedCatalog) {
        const inst =
          instruments.find(function (i) {
            return (
              i.catalog === selectedCatalog ||
              i.instrumentCode === selectedCatalog
            );
          }) || {};

        const hospitalName = (q.header && q.header.hospitalName) || "Unknown";
        const label = inst.instrumentName || inst.name || "—";
        const date = (q.header && q.header.quoteDate) || "—";
        const qty = line.quantity || 1;
        const price = line.price;

        appendRow(tbody, rowNum++, hospitalName, label, date, qty, price);
      }
    });
  });
}

/* ========= By Hospital report ========= */

function showHospitalReport() {
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
  const allQuotes = getAllQuotes();
  let rowNum = 1;

  allQuotes.forEach(function (q) {
    const hospitalName = (q.header && q.header.hospitalName) || "";
    if (hospitalName === selectedHospital) {
      const lines = q.lineItems || [];
      lines.forEach(function (line) {
        const inst =
          instruments.find(function (i) {
            return i.catalog === line.code || i.instrumentCode === line.code;
          }) || {};

        const label = inst.instrumentName || inst.name || "—";
        const date = (q.header && q.header.quoteDate) || "—";
        const qty = line.quantity || 1;
        const price = line.price;

        appendRow(tbody, rowNum++, selectedHospital, label, date, qty, price);
      });
    }
  });
}

/* ========= By Configuration Item report ========= */

function showConfigReport() {
  const selector = document.getElementById("configSelector");
  if (!selector) {
    console.error("[customReport] #configSelector not found");
    return;
  }
  const selectedConfig = selector.value;
  if (!selectedConfig) return;

  const tbody = clearTbody("configReportTable");
  if (!tbody) return;

  const allQuotes = getAllQuotes();
  let rowNum = 1;

  allQuotes.forEach(function (q) {
    const hospitalName = (q.header && q.header.hospitalName) || "Unknown";
    const date = (q.header && q.header.quoteDate) || "—";
    const lines = q.lineItems || [];

    lines.forEach(function (line) {
      const configItems = line.configItems || [];
      configItems.forEach(function (item) {
        const configName = item.name || item.code || "";
        if (configName === selectedConfig) {
          const qty = item.qty || "Included";
          const price =
            typeof item.upInr === "number" ? item.upInr : item.price || 0;

          appendRow(tbody, rowNum++, hospitalName, selectedConfig, date, qty, price);
        }
      });
    });
  });
}

/* ========= By Additional Item report ========= */

function showAdditionalReport() {
  const selector = document.getElementById("additionalSelector");
  if (!selector) {
    console.error("[customReport] #additionalSelector not found");
    return;
  }
  const selectedAdditional = selector.value;
  if (!selectedAdditional) return;

  const tbody = clearTbody("additionalReportTable");
  if (!tbody) return;

  const allQuotes = getAllQuotes();
  let rowNum = 1;

  allQuotes.forEach(function (q) {
    const hospitalName = (q.header && q.header.hospitalName) || "Unknown";
    const date = (q.header && q.header.quoteDate) || "—";
    const lines = q.lineItems || [];

    lines.forEach(function (line) {
      const additionalItems = line.additionalItems || [];
      additionalItems.forEach(function (item) {
        const addName = item.name || item.code || "";
        if (addName === selectedAdditional) {
          const qty = item.qty || 1;
          const price = item.price || 0;

          appendRow(tbody, rowNum++, hospitalName, selectedAdditional, date, qty, price);
        }
      });
    });
  });
}

/* ========= Init wiring ========= */

document.addEventListener("DOMContentLoaded", function () {
  // Populate all dropdowns
  populateCatalogDropdown();
  populateHospitalDropdown();
  populateConfigDropdown();
  populateAdditionalDropdown();

  // Wire Tab 1 – By Catalog
  const catalogBtn = document.getElementById("showCatalogReportBtn");
  if (catalogBtn) {
    catalogBtn.addEventListener("click", showCatalogReport);
  } else {
    console.error("[customReport] #showCatalogReportBtn not found");
  }

  // Wire Tab 2 – By Hospital
  const hospitalBtn = document.getElementById("showHospitalReportBtn");
  if (hospitalBtn) {
    hospitalBtn.addEventListener("click", showHospitalReport);
  } else {
    console.error("[customReport] #showHospitalReportBtn not found");
  }

  // Wire Tab 3 – By Configuration Item
  const configBtn = document.getElementById("showConfigReportBtn");
  if (configBtn) {
    configBtn.addEventListener("click", showConfigReport);
  } else {
    console.error("[customReport] #showConfigReportBtn not found");
  }

  // Wire Tab 4 – By Additional Item
  const additionalBtn = document.getElementById("showAdditionalReportBtn");
  if (additionalBtn) {
    additionalBtn.addEventListener("click", showAdditionalReport);
  } else {
    console.error("[customReport] #showAdditionalReportBtn not found");
  }
});
