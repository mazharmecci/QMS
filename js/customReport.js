import { getInstrumentsMaster } from "../js/quoteService.js";
import {
  db,
  collection,
  getDocs
} from "../js/firebase.js";

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

async function populateConfigDropdown() {
  try {
    const snap = await getDocs(collection(db, "quoteHistory"));
    const configCodes = {};

    console.log("[customReport] Found", snap.docs.length, "documents in quoteHistory");

    snap.docs.forEach(function (doc, idx) {
      const data = doc.data();
      console.log("[customReport] Document", idx, "structure:", Object.keys(data));

      // Check top-level configItems field
      const topLevelConfigItems = data.configItems || [];
      console.log("[customReport] Document", idx, "topLevelConfigItems:", topLevelConfigItems.length);
      
      topLevelConfigItems.forEach(function (item) {
        const code = item.code || item.name || null;
        if (code) {
          configCodes[code] = true;
          console.log("[customReport] Added config code:", code);
        }
      });

      // Also check nested configItems in quoteLines
      const quoteLines = data.quoteLines || [];
      quoteLines.forEach(function (line) {
        const nestedConfigItems = line.configItems || [];
        nestedConfigItems.forEach(function (item) {
          const code = item.code || item.name || null;
          if (code) {
            configCodes[code] = true;
            console.log("[customReport] Added nested config code:", code);
          }
        });
      });
    });

    // If Firestore is empty, fall back to localStorage
    if (Object.keys(configCodes).length === 0) {
      console.log("[customReport] No configs in Firestore, checking localStorage...");
      const allQuotes = getAllQuotes();
      allQuotes.forEach(function (q) {
        const topLevelConfigItems = q.configItems || [];
        topLevelConfigItems.forEach(function (item) {
          const code = item.code || item.name || null;
          if (code) configCodes[code] = true;
        });

        const quoteLines = q.quoteLines || [];
        quoteLines.forEach(function (line) {
          const nestedConfigItems = line.configItems || [];
          nestedConfigItems.forEach(function (item) {
            const code = item.code || item.name || null;
            if (code) configCodes[code] = true;
          });
        });
      });
    }

    const configList = Object.keys(configCodes).sort(function (a, b) {
      return a.localeCompare(b);
    });
    
    populateSelect("configSelector", "-- Select Configuration item --", configList);
    console.log("[customReport] Config dropdown populated with", configList.length, "items:", configList);
  } catch (err) {
    console.error("[customReport] Error fetching configs:", err);
  }
}

async function populateAdditionalDropdown() {
  try {
    const snap = await getDocs(collection(db, "quoteHistory"));
    const additionalCodes = {};

    console.log("[customReport] Found", snap.docs.length, "documents in quoteHistory");

    snap.docs.forEach(function (doc, idx) {
      const data = doc.data();
      console.log("[customReport] Document", idx, "structure:", Object.keys(data));

      // Check top-level additionalItems field
      const topLevelAdditionalItems = data.additionalItems || [];
      console.log("[customReport] Document", idx, "topLevelAdditionalItems:", topLevelAdditionalItems.length);
      
      topLevelAdditionalItems.forEach(function (item) {
        const code = item.code || item.name || null;
        if (code) {
          additionalCodes[code] = true;
          console.log("[customReport] Added additional code:", code);
        }
      });

      // Also check nested additionalItems in quoteLines
      const quoteLines = data.quoteLines || [];
      quoteLines.forEach(function (line) {
        const nestedAdditionalItems = line.additionalItems || [];
        nestedAdditionalItems.forEach(function (item) {
          const code = item.code || item.name || null;
          if (code) {
            additionalCodes[code] = true;
            console.log("[customReport] Added nested additional code:", code);
          }
        });
      });
    });

    // If Firestore is empty, fall back to localStorage
    if (Object.keys(additionalCodes).length === 0) {
      console.log("[customReport] No additionals in Firestore, checking localStorage...");
      const allQuotes = getAllQuotes();
      allQuotes.forEach(function (q) {
        const topLevelAdditionalItems = q.additionalItems || [];
        topLevelAdditionalItems.forEach(function (item) {
          const code = item.code || item.name || null;
          if (code) additionalCodes[code] = true;
        });

        const quoteLines = q.quoteLines || [];
        quoteLines.forEach(function (line) {
          const nestedAdditionalItems = line.additionalItems || [];
          nestedAdditionalItems.forEach(function (item) {
            const code = item.code || item.name || null;
            if (code) additionalCodes[code] = true;
          });
        });
      });
    }

    const additionalList = Object.keys(additionalCodes).sort(function (a, b) {
      return a.localeCompare(b);
    });
    
    populateSelect("additionalSelector", "-- Select Additional item --", additionalList);
    console.log("[customReport] Additional dropdown populated with", additionalList.length, "items:", additionalList);
  } catch (err) {
    console.error("[customReport] Error fetching additionals:", err);
  }
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
    const snap = await getDocs(collection(db, "quoteHistory"));
    let rowNum = 1;
    let found = false;

    snap.docs.forEach(function (doc) {
      const data = doc.data();
      const hospitalName = (data.header && data.header.hospitalName) || "Unknown";
      const quoteDate = (data.header && data.header.quoteDate) || "—";

      // Check top-level configItems
      const topLevelConfigItems = data.configItems || [];
      topLevelConfigItems.forEach(function (item) {
        const itemCode = item.code || "";
        const itemName = item.name || item.code || "—";

        if (itemCode === selectedConfig || itemName === selectedConfig) {
          const qty = item.qty || "Included";
          const price = item.upInr || item.tpInr || item.price || 0;
          appendRow(tbody, rowNum++, hospitalName, itemName, quoteDate, qty, price);
          found = true;
        }
      });

      // Check nested configItems in quoteLines
      const quoteLines = data.quoteLines || [];
      quoteLines.forEach(function (line) {
        const configItems = line.configItems || [];
        configItems.forEach(function (item) {
          const itemCode = item.code || "";
          const itemName = item.name || item.code || "—";

          if (itemCode === selectedConfig || itemName === selectedConfig) {
            const qty = item.qty || "Included";
            const price = item.upInr || item.tpInr || item.price || 0;
            appendRow(tbody, rowNum++, hospitalName, itemName, quoteDate, qty, price);
            found = true;
          }
        });
      });
    });

    // If Firestore is empty, try localStorage
    if (!found) {
      console.log("[customReport] No config items in Firestore, checking localStorage...");
      const allQuotes = getAllQuotes();
      allQuotes.forEach(function (q) {
        const hospitalName = (q.header && q.header.hospitalName) || "Unknown";
        const quoteDate = (q.header && q.header.quoteDate) || "—";

        const topLevelConfigItems = q.configItems || [];
        topLevelConfigItems.forEach(function (item) {
          const itemCode = item.code || "";
          const itemName = item.name || item.code || "—";

          if (itemCode === selectedConfig || itemName === selectedConfig) {
            const qty = item.qty || "Included";
            const price = item.upInr || item.tpInr || item.price || 0;
            appendRow(tbody, rowNum++, hospitalName, itemName, quoteDate, qty, price);
            found = true;
          }
        });

        const quoteLines = q.quoteLines || [];
        quoteLines.forEach(function (line) {
          const configItems = line.configItems || [];
          configItems.forEach(function (item) {
            const itemCode = item.code || "";
            const itemName = item.name || item.code || "—";

            if (itemCode === selectedConfig || itemName === selectedConfig) {
              const qty = item.qty || "Included";
              const price = item.upInr || item.tpInr || item.price || 0;
              appendRow(tbody, rowNum++, hospitalName, itemName, quoteDate, qty, price);
              found = true;
            }
          });
        });
      });
    }
  } catch (err) {
    console.error("[customReport] Error rendering config report:", err);
  }
}

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
    const snap = await getDocs(collection(db, "quoteHistory"));
    let rowNum = 1;
    let found = false;

    snap.docs.forEach(function (doc) {
      const data = doc.data();
      const hospitalName = (data.header && data.header.hospitalName) || "Unknown";
      const quoteDate = (data.header && data.header.quoteDate) || "—";

      // Check top-level additionalItems
      const topLevelAdditionalItems = data.additionalItems || [];
      topLevelAdditionalItems.forEach(function (item) {
        const itemCode = item.code || "";
        const itemName = item.name || item.code || "—";

        if (itemCode === selectedAdditional || itemName === selectedAdditional) {
          const qty = item.qty || 1;
          const price = item.price || 0;
          appendRow(tbody, rowNum++, hospitalName, itemName, quoteDate, qty, price);
          found = true;
        }
      });

      // Check nested additionalItems in quoteLines
      const quoteLines = data.quoteLines || [];
      quoteLines.forEach(function (line) {
        const additionalItems = line.additionalItems || [];
        additionalItems.forEach(function (item) {
          const itemCode = item.code || "";
          const itemName = item.name || item.code || "—";

          if (itemCode === selectedAdditional || itemName === selectedAdditional) {
            const qty = item.qty || 1;
            const price = item.price || 0;
            appendRow(tbody, rowNum++, hospitalName, itemName, quoteDate, qty, price);
            found = true;
          }
        });
      });
    });

    // If Firestore is empty, try localStorage
    if (!found) {
      console.log("[customReport] No additional items in Firestore, checking localStorage...");
      const allQuotes = getAllQuotes();
      allQuotes.forEach(function (q) {
        const hospitalName = (q.header && q.header.hospitalName) || "Unknown";
        const quoteDate = (q.header && q.header.quoteDate) || "—";

        const topLevelAdditionalItems = q.additionalItems || [];
        topLevelAdditionalItems.forEach(function (item) {
          const itemCode = item.code || "";
          const itemName = item.name || item.code || "—";

          if (itemCode === selectedAdditional || itemName === selectedAdditional) {
            const qty = item.qty || 1;
            const price = item.price || 0;
            appendRow(tbody, rowNum++, hospitalName, itemName, quoteDate, qty, price);
            found = true;
          }
        });

        const quoteLines = q.quoteLines || [];
        quoteLines.forEach(function (line) {
          const additionalItems = line.additionalItems || [];
          additionalItems.forEach(function (item) {
            const itemCode = item.code || "";
            const itemName = item.name || item.code || "—";

            if (itemCode === selectedAdditional || itemName === selectedAdditional) {
              const qty = item.qty || 1;
              const price = item.price || 0;
              appendRow(tbody, rowNum++, hospitalName, itemName, quoteDate, qty, price);
              found = true;
            }
          });
        });
      });
    }
  } catch (err) {
    console.error("[customReport] Error rendering additional report:", err);
  }
}

/* ========= Init wiring ========= */

document.addEventListener("DOMContentLoaded", function () {
  // Populate all dropdowns
  populateCatalogDropdown();
  populateHospitalDropdown();
  populateConfigDropdown();  // async – fetches from quoteHistory.configItems
  populateAdditionalDropdown();  // async – fetches from quoteHistory.additionalItems

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
    configBtn.addEventListener("click", function () {
      showConfigReport();
    });
  } else {
    console.error("[customReport] #showConfigReportBtn not found");
  }

  // Wire Tab 4 – By Additional Item
  const additionalBtn = document.getElementById("showAdditionalReportBtn");
  if (additionalBtn) {
    additionalBtn.addEventListener("click", function () {
      showAdditionalReport();
    });
  } else {
    console.error("[customReport] #showAdditionalReportBtn not found");
  }
});
