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
  validateHeader
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

  const cfgSnap = await getDocs(collection(db, "configItems"));
  masterConfigItems = cfgSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(it => it.isActive !== false);

  const addSnap = await getDocs(collection(db, "additionalItems"));
  masterAdditionalItems = addSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(it => it.isActive !== false);

  masterItemsLoaded = true;
}

/* ========= Header population ========= */
export function populateHeader() {
  const header = getQuoteHeaderRaw();
  if (!validateHeader(header)) return;

  const $ = id => document.getElementById(id);

  $("metaQuoteNo").textContent = header.quoteNo || "";
  $("metaQuoteDate").textContent = header.quoteDate || "";
  $("metaYourRef").textContent = header.yourReference || "";
  $("metaRefDate").textContent = header.refDate || "";
  $("metaContactPerson").textContent = header.contactPerson || "";
  $("metaPhone").textContent = header.contactPhone || "";
  $("metaEmail").textContent = header.contactEmail || "";
  $("metaOffice").textContent = header.officePhone || "";
  $("toHospitalNameLine").textContent =
    header.hospitalName || "Hospital / Client Name";

  const addressLines = (header.hospitalAddress || "").split(",").map(l => l.trim());
  $("toHospitalAddressLine1").textContent = addressLines[0] || "";
  $("toHospitalAddressLine2").textContent = addressLines.slice(1).join(", ") || "";

  $("toAttn").textContent = header.kindAttn || "Attention";

  const noteEl = $("salesNoteBlock");
  if (noteEl && header.salesNote) noteEl.textContent = header.salesNote;

  const termsEl = $("termsTextBlock");
  if (!termsEl) return;

  const htmlStored =
    header.termsHtml && header.termsHtml.trim().length
      ? header.termsHtml.trim()
      : null;

  const textStored =
    header.termsText && header.termsText.trim().length
      ? header.termsText.trim()
      : null;

  if (htmlStored) {
    console.log("[populateHeader] Rendering stored termsHtml");
    termsEl.innerHTML = htmlStored;
    return;
  }

  if (textStored) {
    console.log("[populateHeader] Rendering stored termsText as paragraphs");
    const text = textStored.replace(/\r\n/g, "\n");
    const blocks = text
      .split(/\n\s*\n/)
      .map(b => b.trim())
      .filter(Boolean);

    const html = blocks
      .map(block => `<p>${block.replace(/\n+/g, "<br>")}</p>`)
      .join("");

    termsEl.innerHTML = html;
    return;
  }

  const warrantyText =
    header.termsWarrantyText ||
    "12 months from the date of installation against any manufacturing defects. The consumables, other accessories, glass parts and other easily damageable items do not carry any warranty. Unauthorized usage and mishandling of the equipment will void the warranty.";

  const signerName = header.termsSignerName || "Naushad";

  const html = `
    <div class="terms-section">
      <p><strong>Warranty:</strong> ${warrantyText}</p>
      <div class="quote-sender-highlight">${signerName}</div>
    </div>
  `;
  console.log("[populateHeader] Rendering template terms (no stored termsText/termsHtml)");
  termsEl.innerHTML = html;
}

/* ========= Quote builder (with config/additional) ========= */
export function renderQuoteBuilder() {
  const { instruments, lines } = getQuoteContext();
  const body = document.getElementById("quoteBuilderBody");
  if (!body) return;

  if (!lines.length) {
    body.innerHTML = "";
    const sb = document.getElementById("quoteSummaryBody");
    if (sb) sb.innerHTML = "";
    return;
  }

  const rows = [];
  let runningItemCode = 1;
  let itemsTotal = 0;

  (Array.isArray(lines) ? lines : []).forEach((line, lineIdx) => {
    const inst = instruments[line.instrumentIndex] || null;
    if (!inst) return;

    const qty = Number(line.quantity || 1);
    const codeText = String(runningItemCode).padStart(3, "0");
    runningItemCode += 1;

    const instUnit = Number(
      line.unitPriceOverride ?? inst.unitPrice ?? 0
    );
    const instTotal = instUnit * qty;
    itemsTotal += instTotal;

    rows.push(`
      <tr>
        <td>${codeText}</td>
        ${formatInstrumentCell(inst, lineIdx)}
        <td>${qty}</td>
        <td>
          ₹
          <input
            type="text"
            value="${moneyINR(instUnit)}"
            style="width:120px; text-align:right; border:1px solid #cbd5e1; border-radius:4px; padding:2px 6px;"
            onblur="unitPriceCommitted(${lineIdx}, this)"
          />
        </td>
        <td>₹ ${moneyINR(instTotal)}</td>
      </tr>
    `);

const configItems = line.configItems || [];
if (configItems.length) {
  rows.push(`
    <tr style="background:#00B0F0; color:#000;">
      <td colspan="5" style="font-weight:700;">Configuration Items</td>
    </tr>
  `);

  configItems.forEach(item => {
    const itemCode = String(runningItemCode).padStart(3, "0");
    runningItemCode += 1;

    const q = item.qty != null ? item.qty : "Included";
    const upRaw = item.upInr != null ? item.upInr : "Included";
    const tpRaw = item.tpInr != null ? item.tpInr : "Included";

    const upCell = typeof upRaw === "number" ? `₹ ${moneyINR(upRaw)}` : upRaw;
    const tpCell = typeof tpRaw === "number" ? `₹ ${moneyINR(tpRaw)}` : tpRaw;

    rows.push(`
      <tr>
        <td>${itemCode}</td>
        ${formatItemCell(item)}
        <td>${q}</td>
        <td>${upCell}</td>
        <td>${tpCell}</td>
      </tr>
    `);
  });
}

const additionalItems = line.additionalItems || [];
if (additionalItems.length) {
  rows.push(`
    <tr style="background:#00B0F0; color:#000;">
      <td colspan="5" style="font-weight:700;">Additional Items</td>
    </tr>
  `);

  additionalItems.forEach(item => {
    const itemCode = String(runningItemCode).padStart(3, "0");
    runningItemCode += 1;

    const qtyNum = Number(item.qty || 1);
    const unitNum = Number(item.price || item.unitPrice || 0);
    const totalNum = unitNum * qtyNum;
    itemsTotal += totalNum;

    rows.push(`
      <tr>
        <td>${itemCode}</td>
        ${formatItemCell(item)}
        <td>${qtyNum.toString().padStart(2, "0")}</td>
        <td>₹ ${moneyINR(unitNum)}</td>
        <td>₹ ${moneyINR(totalNum)}</td>
      </tr>
    `);
  });
}

// Final render (your existing code)
body.innerHTML = rows.join("");
renderSummaryRows(itemsTotal);

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
      <td style="text-align:right; font-size:12px; color:#475569;">GST @ ${gstPercent.toFixed(
        2
      )}%</td>
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

  (Array.isArray(lines) ? lines : []).forEach(line => {
    const inst = instruments[line.instrumentIndex] || null;
    if (inst) {
      const qty = Number(line.quantity || 1);
      const unitPrice = Number(
        line.unitPriceOverride ?? inst.unitPrice ?? 0
      );
      itemsTotal += unitPrice * qty;
    }
    (line.additionalItems || []).forEach(item => {
      const qtyNum = Number(item.qty || 1);
      const unitNum = Number(item.price || item.unitPrice || 0);
      itemsTotal += qtyNum * unitNum;
    });
  });

  renderSummaryRows(itemsTotal);
}

/* ========= Unit price override handling ========= */

export function unitPriceCommitted(lineIdx, inputEl) {
  const header = getQuoteHeaderRaw();
  if (!Array.isArray(header.quoteLines) || !header.quoteLines[lineIdx]) return;

  const cleaned = String(inputEl.value).replace(/[^\d.]/g, "");
  const num = cleaned === "" ? null : Number(cleaned);

  if (num != null && !Number.isNaN(num)) {
    header.quoteLines[lineIdx].unitPriceOverride = num;
    inputEl.value = moneyINR(num);
  } else {
    delete header.quoteLines[lineIdx].unitPriceOverride;
    inputEl.value = moneyINR(0);
  }

  saveQuoteHeader(header);
  renderQuoteBuilder();
  renderInstrumentModalList();
}

/* ========= Instrument Modal ========= */

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
  if (!listEl) return;

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
  (Array.isArray(lines) ? lines : []).forEach((line, idx) => {
    const inst = instruments[line.instrumentIndex] || {};
    const itemNo = String(idx + 1).padStart(2, "0");
    const code = inst.catalog || inst.instrumentCode || "";
    const name = inst.instrumentName || inst.name || "Unnamed Instrument";
    const desc = inst.description || inst.longDescription || "";
    const shortDesc =
      desc.length > 80 ? desc.replace(/\s+/g, " ").slice(0, 80) + "…" : desc;

    const qty = Number(line.quantity || 1);
    const unit = Number(
      line.unitPriceOverride ?? inst.unitPrice ?? 0
    );
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
          <button type="button"
                  class="btn-quote"
                  style="font-size:11px; padding:0.2rem 0.6rem; margin-right:0.25rem;"
                  onclick="openEditInstrument(${idx})">
            Edit
          </button>
          <button type="button"
                  class="btn-quote btn-quote-secondary"
                  style="font-size:11px; padding:0.2rem 0.6rem;"
                  onclick="removeInstrumentLine(${idx})">
            Remove
          </button>
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

/* ========= Edit Instrument Modal (qty + price) ========= */

export function openEditInstrument(idx) {
  const header = getQuoteHeaderRaw();
  const line = Array.isArray(header.quoteLines) ? header.quoteLines[idx] : null;
  if (!line) return;

  const instruments = getInstrumentsMaster();
  const inst = instruments[line.instrumentIndex] || {};
  const instPrice = Number(inst.unitPrice || 0);

  const editIdxEl = document.getElementById("editInstrumentIndex");
  const qtyEl = document.getElementById("editQuantity");
  const priceEl = document.getElementById("editUnitPrice");
  const overlay = document.getElementById("editInstrumentOverlay");

  if (!editIdxEl || !qtyEl || !priceEl || !overlay) return;

  editIdxEl.value = String(idx);
  qtyEl.value = line.quantity || 1;
  priceEl.value = line.unitPriceOverride ?? instPrice ?? 0;

  overlay.style.display = "flex";
}

export function closeEditInstrument() {
  const overlay = document.getElementById("editInstrumentOverlay");
  if (overlay) overlay.style.display = "none";
}

export function saveEditInstrument() {
  const editIdxEl = document.getElementById("editInstrumentIndex");
  const qtyEl = document.getElementById("editQuantity");
  const priceEl = document.getElementById("editUnitPrice");
  if (!editIdxEl || !qtyEl || !priceEl) return;

  const idx = Number(editIdxEl.value || 0);
  const header = getQuoteHeaderRaw();
  if (!Array.isArray(header.quoteLines) || !header.quoteLines[idx]) return;

  const line = header.quoteLines[idx];
  const newQty = Math.max(1, Number(qtyEl.value || 1));
  const newPriceRaw = String(priceEl.value || "").replace(/[^\d.]/g, "");
  const newPrice = Number(newPriceRaw || 0);

  line.quantity = newQty;
  line.unitPriceOverride = newPrice > 0 ? newPrice : null;

  saveQuoteHeader(header);
  renderQuoteBuilder();
  renderInstrumentModalList();
  closeEditInstrument();
}

/* ========= Instrument Picker ========= */

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
          desc.length > 160 ? desc.replace(/\s+/g, " ").slice(0, 160) + "…" : desc;
        return `
          <div style="border-bottom:1px dashed #e2e8f0; padding:0.4rem 0; display:flex; align-items:flex-start; justify-content:space-between; gap:0.5rem;">
            <div style="font-size:12px; flex:1;">
              <div style="font-weight:600;">${code} ${name}</div>
              <div style="color:#64748b; margin-top:2px; font-size:11px;">${shortDesc}</div>
            </div>
            <div style="display:flex; align-items:center; gap:0.25rem;">
              <input type="number"
                     min="1"
                     value="1"
                     id="instQty_${idx}"
                     style="width:50px; font-size:11px; padding:0.15rem 0.3rem; border-radius:4px; border:1px solid #cbd5e1;">
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
    unitPriceOverride: null,
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

  renderItemModalList(line, type);

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
      .map(it => {
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

/* ========= Basic helper: go back ========= */
function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "index.html";
  }
}

/* ========= Init wiring ========= */
let initialized = false;

document.addEventListener("DOMContentLoaded", () => {
  if (initialized) return;
  initialized = true;

  console.log("[quoteUI] DOMContentLoaded init");

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

  // Edit instrument modal buttons
  document
    .getElementById("closeEditInstrumentBtn")
    ?.addEventListener("click", closeEditInstrument);
  document
    .getElementById("cancelEditInstrumentBtn")
    ?.addEventListener("click", closeEditInstrument);
  document
    .getElementById("saveEditInstrumentBtn")
    ?.addEventListener("click", saveEditInstrument);
});

/* ========= Expose functions for inline onclick ========= */
window.addInstrumentToQuote = addInstrumentToQuote;
window.openEditInstrument = openEditInstrument;
window.closeEditInstrument = closeEditInstrument;
window.saveEditInstrument = saveEditInstrument;
window.removeInstrumentLine = removeInstrumentLine;
window.editItemFromModal = editItemFromModal;
window.removeItemFromModal = removeItemFromModal;
window.discountInputChanged = discountInputChanged;
window.discountInputCommitted = discountInputCommitted;
window.addMasterItemToLine = addMasterItemToLine;
window.unitPriceCommitted = unitPriceCommitted;
