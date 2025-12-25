// quoteUI.js

/* ========= Imports ========= */
import {
  moneyINR,
  parseDetailsText,
  formatInstrumentCell,
  formatItemCell
} from "./quoteUtils.js";

import {
  getQuoteHeaderRaw,
  saveQuoteHeader,
  getInstrumentsMaster,
  getQuoteContext,
  validateHeader,
  finalizeQuote,
  buildQuoteObject
} from "./quoteService.js";

import {
  db,
  collection,
  getDocs
} from "./firebase.js";

/* ========= Master items cache ========= */
let masterConfigItems = [];
let masterAdditionalItems = [];
let masterItemsLoaded = false;

async function loadMasterItemsOnce() {
  if (masterItemsLoaded) return;

  // Load configItems
  const cfgSnap = await getDocs(collection(db, "configItems"));
  masterConfigItems = cfgSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(it => it.isActive !== false);

  // Load additionalItems
  const addSnap = await getDocs(collection(db, "additionalItems"));
  masterAdditionalItems = addSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(it => it.isActive !== false);

  masterItemsLoaded = true;
}

/* ========= Header population ========= */
function populateHeader() {
  // Prefer in-memory header first
  const header = window.currentQuoteHeader 
    || JSON.parse(localStorage.getItem("quoteHeader") || "{}");

  if (!header || !header.quoteNo) {
    console.warn("[populateHeader] No header found to populate.");
    return;
  }

  console.log("[populateHeader] Populating UI with header:", header);

  // Helper for safe DOM assignment
  const safeAssign = (selector, value) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = value || "";
  };

  // Quote metadata
  safeAssign("#metaQuoteNo", header.quoteNo);
  safeAssign("#metaQuoteDate", header.quoteDate);
  safeAssign("#metaYourRef", header.yourReference);
  safeAssign("#metaRefDate", header.refDate);

  // Hospital details
  safeAssign("#toHospitalNameLine", header.hospitalName);
  const addressParts = (header.hospitalAddress || "").split(",");
  safeAssign("#toHospitalAddressLine1", addressParts[0]?.trim() || "");
  safeAssign("#toHospitalAddressLine2", addressParts[1]?.trim() || "");

  // Contact details
  safeAssign("#metaContactPerson", header.contactPerson);
  safeAssign("#metaPhone", header.contactPhone);
  safeAssign("#metaEmail", header.contactEmail);
  safeAssign("#metaOffice", header.officePhone);

  safeAssign("#toAttn", header.kindAttn);
  safeAssign("#salesNoteBlock", header.salesNote);

  // Terms HTML
  const termsEl = document.getElementById("termsTextBlock");
  if (termsEl) {
    termsEl.innerHTML = header.termsHtml || "";
  }
}

/* ========= Quote Summary Helper ========= */
function renderSummaryRows(itemsTotal) {
  const sb = document.getElementById("quoteSummaryBody");
  if (!sb) return;
  
  const taxRate = 0.18;
  const taxAmount = itemsTotal * taxRate;
  const grandTotal = itemsTotal + taxAmount;
  
  sb.innerHTML = `
    <tr><td>Subtotal</td><td>₹ ${moneyINR(itemsTotal)}</td></tr>
    <tr><td>GST (18%)</td><td>₹ ${moneyINR(taxAmount)}</td></tr>
    <tr style="font-weight: bold; font-size: 1.1em;">
      <td>Total</td><td>₹ ${moneyINR(grandTotal)}</td>
    </tr>
  `;
}

/* ========= Quote builder (with config/additional) ========= */
export function renderQuoteBuilder() {
  const { instruments, lines } = getQuoteContext();
  const body = document.getElementById("quoteBuilderBody");
  
  if (!body) {
    console.error("[renderQuoteBuilder] Missing #quoteBuilderBody container.");
    return;
  }

  if (!Array.isArray(lines) || !lines.length) {
    body.innerHTML = "";
    renderSummaryRows(0);
    console.log("[renderQuoteBuilder] No lines to render.");
    return;
  }

  const rows = [];
  let runningItemCode = 1;
  let itemsTotal = 0;

  const nextItemCode = () => {
    const code = String(runningItemCode).padStart(3, "0");
    runningItemCode++;
    return code;
  };
  
  const formatCurrency = (val) =>
    typeof val === "number" && !isNaN(val) ? `₹ ${moneyINR(val)}` : "Included";

  lines.forEach((line, lineIdx) => {
    const inst = instruments[line.instrumentIndex] || null;
    if (!inst) {
      console.warn("[renderQuoteBuilder] Missing instrument for line:", lineIdx);
      return;
    }

    const qty = Number(line.quantity || 1);
    const instUnit = Number(inst.unitPrice || 0);
    const instTotal = instUnit * qty;
    itemsTotal += instTotal;

    // Main instrument row
    rows.push(`
      <tr>
        <td>${nextItemCode()}</td>
        ${formatInstrumentCell(inst, lineIdx)}
        <td>${qty}</td>
        <td>${formatCurrency(instUnit)}</td>
        <td>${formatCurrency(instTotal)}</td>
      </tr>
    `);

    // Configuration items
    const configItems = line.configItems || [];
    if (configItems.length) {
      rows.push(`
        <tr style="background:#00B0F0; color:#000;">
          <td colspan="5" style="font-weight:700;">Configuration Items</td>
        </tr>
      `);

      configItems.forEach(item => {
        const q = item.qty != null ? item.qty : "Included";
        const upRaw = item.upInr != null ? item.upInr : "Included";
        const tpRaw = item.tpInr != null ? item.tpInr : "Included";

        rows.push(`
          <tr>
            <td>${nextItemCode()}</td>
            ${formatItemCell(item)}
            <td>${q}</td>
            <td>${formatCurrency(upRaw)}</td>
            <td>${formatCurrency(tpRaw)}</td>
          </tr>
        `);
      });
    }

    // Additional items
    const additionalItems = line.additionalItems || [];
    if (additionalItems.length) {
      rows.push(`
        <tr style="background:#00B0F0; color:#000;">
          <td colspan="5" style="font-weight:700;">Additional Items</td>
        </tr>
      `);

      additionalItems.forEach(item => {
        const qtyNum = Number(item.qty || 1);
        const unitNum = Number(item.price || item.unitPrice || 0);
        const totalNum = unitNum * qtyNum;
        itemsTotal += totalNum;

        rows.push(`
          <tr>
            <td>${nextItemCode()}</td>
            ${formatItemCell(item)}
            <td>${qtyNum}</td>
            <td>${formatCurrency(unitNum)}</td>
            <td>${formatCurrency(totalNum)}</td>
          </tr>
        `);
      });
    }
  });

  body.innerHTML = rows.join("");
  renderSummaryRows(itemsTotal);

  console.log("[renderQuoteBuilder] Rendered", lines.length, "lines. Items total:", itemsTotal);
}

/* ========= Summary rows / discount ========= */

export function renderSummaryRows(itemsTotal) {
  const sb = document.getElementById("quoteSummaryBody");
  if (!sb) return;

  const header = getQuoteHeaderRaw();
  const gstPercent = 18;
  const discount = Number(header.discount || 0);
  const afterDisc = itemsTotal - discount;
  const gstAmount = (afterDisc * gstPercent) / 100;
  const totalValue = afterDisc + gstAmount;
  const roundedTotal = Math.round(totalValue);
  const roundOff = roundedTotal - totalValue;

  sb.innerHTML = `
  <tr>
    <td colspan="3"></td>
    <td style="text-align:right; font-size:12px; color:#475569;">Items Total</td>
    <td style="text-align:right; font-weight:600;">₹ ${moneyINR(itemsTotal)}</td>
  </tr>

  <tr class="discount-row">
    <td colspan="3"></td>
    <td style="text-align:right; font-size:12px; color:#475569;">Discount</td>
    <td style="text-align:right; font-weight:600;">
      ₹ <input
        id="discountInput"
        type="text"
        value="${moneyINR(discount)}"
        style="width:120px; text-align:right; border:1px solid #cbd5e1; border-radius:4px; padding:2px 6px;"
        oninput="discountInputChanged(this.value)"
        onblur="discountInputCommitted()"
      />
    </td>
  </tr>

  <tr class="after-discount-row">
    <td colspan="3"></td>
    <td style="text-align:right; font-size:12px; color:#475569;">After Discount</td>
    <td style="text-align:right; font-weight:600;">₹ ${moneyINR(afterDisc)}</td>
  </tr>

  <tr>
    <td colspan="3"></td>
    <td style="text-align:right; font-size:12px; color:#475569;">Freight</td>
    <td style="text-align:right; font-weight:600;">Included</td>
  </tr>

  <tr>
    <td colspan="3"></td>
    <td style="text-align:right; font-size:12px; color:#475569;">GST @ ${gstPercent.toFixed(2)}%</td>
    <td style="text-align:right; font-weight:600;">₹ ${moneyINR(gstAmount)}</td>
  </tr>

  <tr>
    <td colspan="3"></td>
    <td style="text-align:right; font-size:12px; color:#475569;">Total Value</td>
    <td style="text-align:right; font-weight:600;">₹ ${moneyINR(totalValue)}</td>
  </tr>

  <tr>
    <td colspan="3"></td>
    <td style="text-align:right; font-size:12px; color:#475569;">Round Off</td>
    <td style="text-align:right; font-weight:600;">₹ ${moneyINR(roundOff)}</td>
  </tr>

  <tr>
    <td colspan="3"></td>
    <td style="text-align:right; font-size:12px;"><strong>Grand Total</strong></td>
    <td style="text-align:right; font-weight:700;">₹ ${moneyINR(roundedTotal)}</td>
  </tr>
`;

  updateDiscountVisibility(discount);
}

export function updateDiscountVisibility(discountValue) {
  const table = document.getElementById("quoteSummaryTable");
  if (!table) return;

  const header = getQuoteHeaderRaw();
  const discount =
    discountValue != null ? Number(discountValue) : Number(header.discount || 0);

  if (discount === 0) {
    table.classList.add("discount-zero");
  } else {
    table.classList.remove("discount-zero");
  }
}

/* ========= Discount Handling ========= */
let discountDraft = null;

export function discountInputChanged(val) {
  const cleaned = String(val).replace(/[^\d.-]/g, "");
  discountDraft = Number(cleaned || 0);
}

export function discountInputCommitted() {
  const value = discountDraft != null ? discountDraft : 0;
  const header = getQuoteHeaderRaw();
  header.discount = value;
  saveQuoteHeader(header);

  const { instruments, lines } = getQuoteContext();
  let itemsTotal = 0;

  lines.forEach(line => {
    const inst = instruments[line.instrumentIndex] || null;
    if (inst) {
      const qty = Number(line.quantity || 1);
      itemsTotal += Number(inst.unitPrice || 0) * qty;
    }
    (line.additionalItems || []).forEach(item => {
      const qtyNum = Number(item.qty || 1);
      const unitNum = Number(item.price || item.unitPrice || 0);
      itemsTotal += qtyNum * unitNum;
    });
  });

  renderSummaryRows(itemsTotal);
}

/* ========= Instrument Modal ========= */
// (unchanged below this point except item modal pieces)

export function openInstrumentModal() {
  const overlay = document.getElementById("instrumentModalOverlay");
  if (!overlay) return;
  renderInstrumentModalList();
  overlay.style.display = "flex";
}

export function closeInstrumentModal() {
  const overlay = document.getElementById("instrumentModalOverlay");
  if (overlay) overlay.style.display = "none";
}

export function renderInstrumentModalList() {
  const listEl = document.getElementById("instrumentModalList");
  const { instruments, lines } = getQuoteContext();

  if (!lines.length) {
    listEl.innerHTML = `
      <tr>
        <td colspan="7" style="padding:0.4rem; font-size:12px; color:#64748b; text-align:center;">
          No instruments added yet for this quote.
        </td>
      </tr>`;
    return;
  }

  let rows = "";
  lines.forEach((line, idx) => {
    const inst = instruments[line.instrumentIndex] || {};
    const itemNo = String(idx + 1).padStart(2, "0");
    const code   = inst.catalog || inst.instrumentCode || "";
    const name   = inst.instrumentName || inst.name || "Unnamed Instrument";
    const desc   = inst.description || inst.longDescription || "";
    const shortDesc = desc.replace(/\s+/g, " ").slice(0, 80) + (desc.length > 80 ? "…" : "");

    const qty  = Number(line.quantity || 1);
    const unit = Number(inst.unitPrice || 0);
    const total = qty * unit;

    rows += `
      <tr>
        <td style="padding:0.3rem 0.4rem; border:1px solid #e2e8f0; text-align:center;">${itemNo}</td>
        <td style="padding:0.3rem 0.4rem; border:1px solid #e2e8f0;">${code}</td>
        <td style="padding:0.3rem 0.4rem; border:1px solid #e2e8f0;">
          <div style="font-weight:600;">${name}</div>
          <div style="font-size:11px; color:#64748b;">${shortDesc}</div>
        </td>
        <td style="padding:0.3rem 0.4rem; border:1px solid #e2e8f0; text-align:center;">${qty}</td>
        <td style="padding:0.3rem 0.4rem; border:1px solid #e2e8f0; text-align:right;">${moneyINR(unit)}</td>
        <td style="padding:0.3rem 0.4rem; border:1px solid #e2e8f0; text-align:right;">${moneyINR(total)}</td>
        <td style="padding:0.3rem 0.4rem; border:1px solid #e2e8f0;">
          <button type="button" class="btn-quote" style="font-size:11px; padding:0.2rem 0.6rem; margin-right:0.25rem;" onclick="editInstrumentLine(${idx})">Edit</button>
          <button type="button" class="btn-quote btn-quote-secondary" style="font-size:11px; padding:0.2rem 0.6rem;" onclick="removeInstrumentLine(${idx})">Remove</button>
        </td>
      </tr>
    `;
  });

  listEl.innerHTML = rows;
}

export function removeInstrumentLine(idx) {
  const { header } = getQuoteContext();
  if (!Array.isArray(header.quoteLines)) return;
  header.quoteLines.splice(idx, 1);
  saveQuoteHeader(header);
  renderQuoteBuilder();
  renderInstrumentModalList();
}

export function editInstrumentLine(idx) {
  const { header } = getQuoteContext();
  if (!Array.isArray(header.quoteLines) || !header.quoteLines[idx]) return;

  const currentQty = Number(header.quoteLines[idx].quantity || 1);
  const newQtyStr = prompt("Update quantity for this instrument:", String(currentQty));
  if (newQtyStr == null) return;
  const newQty = Math.max(1, Number(newQtyStr) || 1);

  header.quoteLines[idx].quantity = newQty;
  saveQuoteHeader(header);
  renderQuoteBuilder();
  renderInstrumentModalList();
}

/* ========= Instrument Picker ========= */
// (unchanged)

export function openInstrumentPicker() {
  const overlay = document.getElementById("instrumentPickerOverlay");
  if (!overlay) return;

  const listEl = document.getElementById("instrumentPickerList");
  const instruments = getInstrumentsMaster();

  if (!instruments.length) {
    listEl.innerHTML =
      '<div style="font-size:12px; color:#64748b;">No instruments in master. Please create instruments first.</div>';
  } else {
    listEl.innerHTML = instruments
      .map((inst, idx) => {
        const name = inst.instrumentName || inst.name || "Unnamed Instrument";
        const code = inst.catalog || inst.instrumentCode || "";
        const desc = inst.description || inst.longDescription || "";
        const shortDesc =
          desc.replace(/\s+/g, " ").slice(0, 160) +
          (desc.length > 160 ? "…" : "");
        return `
        <div style="border-bottom:1px dashed #e2e8f0; padding:0.4rem 0; display:flex; align-items:flex-start; justify-content:space-between; gap:0.5rem;">
          <div style="font-size:12px; flex:1;">
            <div style="font-weight:600;">${code} ${name}</div>
            <div style="color:#64748b; margin-top:2px; font-size:11px;">${shortDesc}</div>
          </div>
          <div style="display:flex; align-items:center; gap:0.25rem;">
            <input type="number" min="1" value="1" id="instQty_${idx}" style="width:50px; font-size:11px; padding:0.15rem 0.3rem; border-radius:4px; border:1px solid #cbd5e1;">
            <button type="button" class="btn-quote" onclick="addInstrumentToQuote(${idx})">Add</button>
          </div>
        </div>
      `;
      })
      .join("");
  }

  overlay.style.display = "flex";
}

export function closeInstrumentPicker() {
  const overlay = document.getElementById("instrumentPickerOverlay");
  if (overlay) overlay.style.display = "none";
}

export function addInstrumentToQuote(instIndex) {
  const header = getQuoteHeaderRaw();
  const qtyInput = document.getElementById(`instQty_${instIndex}`);
  const qty = Math.max(1, Number(qtyInput?.value || 1));

  if (!Array.isArray(header.quoteLines)) header.quoteLines = [];

  header.quoteLines.push({
    lineType: "instrument",
    instrumentIndex: instIndex,
    quantity: qty,
    configItems: [],
    additionalItems: []
  });

  saveQuoteHeader(header);
  renderQuoteBuilder();
  renderInstrumentModalList();
}

/* ========= Config / Additional Modal ========= */
let currentEditIndex = null;

export function openConfigModal(lineIndex) {
  openItemModal("config", lineIndex);
}

export function openAdditionalModal(lineIndex) {
  openItemModal("additional", lineIndex);
}

export async function openItemModal(type, lineIndex) {
  const { header, instruments } = getQuoteContext();
  const line =
    header.quoteLines[lineIndex] || { configItems: [], additionalItems: [] };

  await loadMasterItemsOnce();

  const overlay = document.getElementById("itemModalOverlay");
  const titleEl = document.getElementById("itemModalTitle");
  const typeEl = document.getElementById("itemModalType");
  const lineEl = document.getElementById("itemLineIndex");

  const codeEl = document.getElementById("itemCodeInput");
  const qtyEl = document.getElementById("itemQty");
  const priceEl = document.getElementById("itemPrice");
  const priceGroup = document.getElementById("itemPriceGroup");
  const detailsEl = document.getElementById("itemDetails");

  currentEditIndex = null;
  typeEl.value = type;
  lineEl.value = String(lineIndex);

  titleEl.textContent =
    type === "config"
      ? "Configuration Items for this Instrument"
      : "Additional Items for this Instrument";

  codeEl.value = "";
  qtyEl.value = type === "config" ? "Included" : "1";
  detailsEl.value = "";
  if (priceGroup) priceGroup.style.display = type === "config" ? "none" : "block";
  if (priceEl) priceEl.value = "";

  // render existing selections
  renderItemModalList(line, type);

  // render master list for this instrument
  const inst = instruments[line.instrumentIndex] || {};
  const modelKey = inst.catalog || inst.instrumentCode || "";
  renderMasterItemPicker(type, modelKey, lineIndex);

  overlay.style.display = "flex";
}

export function closeItemModal() {
  const overlay = document.getElementById("itemModalOverlay");
  if (overlay) overlay.style.display = "none";
  currentEditIndex = null;
}

export function renderItemModalList(line, type) {
  const listEl = document.getElementById("itemModalList");
  const arr =
    type === "config" ? line.configItems || [] : line.additionalItems || [];

  if (!arr.length) {
    listEl.innerHTML =
      '<div style="font-size:11px; color:#64748b;">No items yet for this instrument.</div>';
    return;
  }

  listEl.innerHTML = arr
    .map((item, idx) => {
      const qty =
        item.qty != null ? item.qty : type === "config" ? "Included" : "1";
      const price =
        type === "config"
          ? "Included"
          : item.price || item.unitPrice || item.upInr || item.tpInr || "";

      return `
        <div class="item-row">
          <div class="item-row-main">
            <div class="item-row-main-title">
              ${item.code || ""} ${item.name || ""}
            </div>
            <div class="item-row-main-meta">
              Qty: ${qty} &nbsp; | &nbsp; Price: ${price}
            </div>
          </div>
          <div class="item-row-actions">
            <button type="button"
                    onclick="editItemFromModal('${type}', ${idx})">
              Edit
            </button>
            <button type="button"
                    onclick="removeItemFromModal('${type}', ${idx})">
              Remove
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

/* ===== Master picker (bottom list) ===== */

function renderMasterItemPicker(type, modelKey, lineIndex) {
  const pickerEl =
    type === "config"
      ? document.getElementById("configPickerList")
      : document.getElementById("additionalPickerList");
  const overlay =
    type === "config"
      ? document.getElementById("configPickerOverlay")
      : document.getElementById("additionalPickerOverlay");

  if (!pickerEl || !overlay) return;

  const source =
    type === "config" ? masterConfigItems : masterAdditionalItems;

  const available = source.filter(it => {
    const models = it.applicableModels || [];
    if (!models.length) return true;
    return models.includes("ALL") || models.includes(modelKey);
  });

  if (!available.length) {
    pickerEl.innerHTML =
      '<div style="font-size:11px; color:#64748b;">No master items defined for this instrument.</div>';
  } else {
    pickerEl.innerHTML = available
      .map((it, idx) => {
        const qtyLabel = type === "config" ? "Included" : "1";
        const priceLabel =
          type === "config"
            ? it.priceLabel || "Included"
            : (it.price != null ? `₹ ${moneyINR(it.price)}` : "");
        return `
          <div class="item-row">
            <div class="item-row-main">
              <div class="item-row-main-title">
                ${it.code || ""} ${it.name || ""}
              </div>
              <div class="item-row-main-meta">
                Qty: ${qtyLabel} &nbsp; | &nbsp; Price: ${priceLabel}
              </div>
            </div>
            <div class="item-row-actions">
              <button type="button"
                      onclick="addMasterItemToLine('${type}', ${lineIndex}, '${it.id}')">
                Add
              </button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  overlay.style.display = "flex";
}

/* Add from master to this quote line */
export function addMasterItemToLine(type, lineIndex, masterId) {
  const { header } = getQuoteContext();
  const line =
    header.quoteLines[lineIndex] || { configItems: [], additionalItems: [] };
  const arrName = type === "config" ? "configItems" : "additionalItems";
  if (!Array.isArray(line[arrName])) line[arrName] = [];

  const source =
    type === "config" ? masterConfigItems : masterAdditionalItems;
  const master = source.find(it => it.id === masterId);
  if (!master) return;

  if (type === "config") {
    line.configItems.push({
      code: master.code || "",
      name: master.name || "",
      description: master.description || "",
      qty: "Included",
      upInr: "Included",
      tpInr: "Included"
    });
  } else {
    line.additionalItems.push({
      code: master.code || "",
      name: master.name || "",
      description: master.description || "",
      qty: 1,
      price: Number(master.price || 0)
    });
  }

  header.quoteLines[lineIndex] = line;
  saveQuoteHeader(header);
  renderQuoteBuilder();
  renderItemModalList(line, type);
}

/* ========= Item Modal Editing ========= */

export function editItemFromModal(type, idx) {
  const { header } = getQuoteContext();
  const lineIndex = Number(
    document.getElementById("itemLineIndex").value || 0
  );
  const line =
    header.quoteLines[lineIndex] || { configItems: [], additionalItems: [] };
  const arr =
    type === "config" ? line.configItems || [] : line.additionalItems || [];
  const item = arr[idx];
  if (!item) return;

  currentEditIndex = idx;
  document.getElementById("itemModalType").value = type;

  const titleEl = document.getElementById("itemModalTitle");
  titleEl.textContent =
    type === "config" ? "Edit Configuration Item" : "Edit Additional Item";

  const codeEl = document.getElementById("itemCodeInput");
  const qtyEl = document.getElementById("itemQty");
  const priceEl = document.getElementById("itemPrice");
  const priceGroup = document.getElementById("itemPriceGroup");
  const detailsEl = document.getElementById("itemDetails");

  codeEl.value = item.code || "";
  qtyEl.value =
    item.qty != null ? item.qty : type === "config" ? "Included" : "1";

  if (priceGroup) priceGroup.style.display = type === "config" ? "none" : "block";

  if (type === "config") {
    if (priceEl) priceEl.value = "";
  } else {
    let raw = item.price || item.unitPrice || item.upInr || item.tpInr || "";
    raw = String(raw).replace(/[^\d.]/g, "");
    if (priceEl) priceEl.value = raw;
  }

  detailsEl.value = item.description || "";
  document.getElementById("itemModalOverlay").style.display = "flex";
}

export function removeItemFromModal(type, idx) {
  const { header } = getQuoteContext();
  const lineIndex = Number(
    document.getElementById("itemLineIndex").value || 0
  );
  const line =
    header.quoteLines[lineIndex] || { configItems: [], additionalItems: [] };

  const arrName = type === "config" ? "configItems" : "additionalItems";
  const arr = line[arrName] || [];
  arr.splice(idx, 1);
  line[arrName] = arr;

  header.quoteLines[lineIndex] = line;
  saveQuoteHeader(header);

  renderQuoteBuilder();
  renderItemModalList(line, type);
}

export function saveItemFromModal(e) {
  e.preventDefault();

  const { header } = getQuoteContext();
  const typeEl = document.getElementById("itemModalType");
  const lineIndex = Number(
    document.getElementById("itemLineIndex").value || 0
  );
  const codeEl = document.getElementById("itemCodeInput");
  const qtyEl = document.getElementById("itemQty");
  const priceEl = document.getElementById("itemPrice");
  const detailsEl = document.getElementById("itemDetails");

  const type = typeEl.value;
  const code = (codeEl.value || "").trim();
  const { name } = parseDetailsText(detailsEl.value);
  if (!name) return;

  const line =
    header.quoteLines[lineIndex] || { configItems: [], additionalItems: [] };
  const arrName = type === "config" ? "configItems" : "additionalItems";
  if (!Array.isArray(line[arrName])) line[arrName] = [];

  const isEdit = currentEditIndex != null;
  const idx = isEdit ? currentEditIndex : line[arrName].length;

  if (type === "config") {
    const existingCode = (isEdit && line.configItems[idx]?.code) || null;
    const item = {
      code:
        code ||
        existingCode ||
        `CFG-${String(line.configItems.length + 1).padStart(2, "0")}`,
      name,
      description: detailsEl.value,
      qty: qtyEl.value || "Included",
      upInr: "Included",
      tpInr: "Included"
    };
    line.configItems[idx] = item;
  } else {
    const existingCode = (isEdit && line.additionalItems[idx]?.code) || null;
    const rawPrice = priceEl?.value || "0";
    const cleanedPrice = rawPrice.replace(/[^\d.]/g, "");
    const priceNum = parseFloat(cleanedPrice) || 0;

    const item = {
      code:
        code ||
        existingCode ||
        `ADD-${String(line.additionalItems.length + 1).padStart(2, "0")}`,
      name,
      description: detailsEl.value,
      qty: Number(qtyEl.value || 1),
      price: priceNum
    };
    line.additionalItems[idx] = item;
  }

  currentEditIndex = null;
  header.quoteLines[lineIndex] = line;
  saveQuoteHeader(header);
  renderQuoteBuilder();
  renderItemModalList(line, type);
}

/* ========= Quote History (Firebase) ========= */
// (unchanged)

/* ========= Basic helper: go back ========= */
function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "index.html";
  }
}

/* ========= Init wiring ========= */
document.addEventListener("DOMContentLoaded", () => {
  populateHeader();
  renderQuoteBuilder();

  document.getElementById("backBtn")?.addEventListener("click", goBack);

  document
    .getElementById("openInstrumentModalBtn")
    ?.addEventListener("click", openInstrumentModal);
  document
    .getElementById("closeInstrumentModalBtn")
    ?.addEventListener("click", closeInstrumentModal);
  document
    .getElementById("closeInstrumentModalFooterBtn")
    ?.addEventListener("click", closeInstrumentModal);

  document
    .getElementById("openInstrumentPickerBtn")
    ?.addEventListener("click", openInstrumentPicker);
  document
    .getElementById("closeInstrumentPickerBtn")
    ?.addEventListener("click", closeInstrumentPicker);

  document
    .getElementById("closeItemModalBtn")
    ?.addEventListener("click", closeItemModal);
  document
    .getElementById("cancelItemModalBtn")
    ?.addEventListener("click", closeItemModal);
  document
    .getElementById("itemModalForm")
    ?.addEventListener("submit", saveItemFromModal);

  document
    .getElementById("closeConfigPickerBtn")
    ?.addEventListener("click", () => {
      document.getElementById("configPickerOverlay").style.display = "none";
    });
  document
    .getElementById("closeAdditionalPickerBtn")
    ?.addEventListener("click", () => {
      document.getElementById("additionalPickerOverlay").style.display = "none";
    });

  document
    .getElementById("finalizeQuoteBtn")
    ?.addEventListener("click", finalizeQuote);
});

/* ========= Expose functions for inline onclick ========= */
window.addInstrumentToQuote = addInstrumentToQuote;
window.editInstrumentLine = editInstrumentLine;
window.removeInstrumentLine = removeInstrumentLine;
window.editItemFromModal = editItemFromModal;
window.removeItemFromModal = removeItemFromModal;
window.discountInputChanged = discountInputChanged;
window.discountInputCommitted = discountInputCommitted;
window.addMasterItemToLine = addMasterItemToLine;
