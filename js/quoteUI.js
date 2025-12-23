// quoteUI.js

import {
  getQuoteHeaderRaw,
  saveQuoteHeader,
  getInstrumentsMaster,
  getQuoteContext,
  validateHeader,
  finalizeQuote
} from "../js/quoteService.js";

import {
  moneyINR,
  parseDetailsText,
  formatInstrumentCell,
  formatItemCell
} from "../js/quoteUtils.js";

/* ========= Quote Builder & Summary ========= */

// Populate letterhead from header
export function populateHeader() {
  const header = getQuoteHeaderRaw();
  if (!validateHeader(header)) return;

  document.getElementById("metaQuoteNo").textContent   = header.quoteNo || "";
  document.getElementById("metaQuoteDate").textContent = header.quoteDate || "";
  document.getElementById("metaYourRef").textContent   = header.yourReference || "";
  document.getElementById("metaRefDate").textContent   = header.refDate || "";
  document.getElementById("metaContactPerson").textContent = header.contactPerson || "";
  document.getElementById("metaPhone").textContent     = header.contactPhone || "";
  document.getElementById("metaEmail").textContent     = header.contactEmail || "";
  document.getElementById("metaOffice").textContent    = header.officePhone || "";

  document.getElementById("toHospitalNameLine").textContent =
    header.hospitalName || "Hospital / Client Name";

  const [line1, line2] = (header.hospitalAddress || "").split(",");
  document.getElementById("toHospitalAddressLine1").textContent = line1 || "";
  document.getElementById("toHospitalAddressLine2").textContent = line2 || "";
  document.getElementById("toAttn").textContent = header.kindAttn || "Attention";

  const noteEl = document.getElementById("salesNoteBlock");
  if (noteEl && header.salesNote) {
    noteEl.textContent = header.salesNote;
  }

  const termsEl = document.getElementById("termsTextBlock");
  if (termsEl) {
    if (header.termsHtml) {
      termsEl.innerHTML = header.termsHtml;
    } else if (header.termsText) {
      termsEl.textContent = header.termsText;
    } else {
      termsEl.textContent = "";
    }
  }
}

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

  lines.forEach((line, lineIdx) => {
    const inst = instruments[line.instrumentIndex] || null;
    if (!inst) return;

    const qty = Number(line.quantity || 1);
    const codeText = String(runningItemCode).padStart(3, "0");
    runningItemCode += 1;

    const instUnit = Number(inst.unitPrice || 0);
    const instTotal = instUnit * qty;
    itemsTotal += instTotal;

    // main instrument row
    rows.push(`
      <tr>
        <td>${codeText}</td>
        ${formatInstrumentCell(inst, lineIdx)}
        <td>${qty}</td>
        <td>₹ ${moneyINR(instUnit)}</td>
        <td>₹ ${moneyINR(instTotal)}</td>
      </tr>
    `);

    // configuration items
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

        const q      = item.qty != null ? item.qty : "Included";
        const upRaw  = item.upInr != null ? item.upInr : "Included";
        const tpRaw  = item.tpInr != null ? item.tpInr : "Included";
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

    // additional items
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

        const qtyNum  = Number(item.qty || 1);
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
  });

  body.innerHTML = rows.join("");
  renderSummaryRows(itemsTotal);
}

export function updateDiscountVisibility(discountValue) {
  const table = document.getElementById("quoteSummaryTable");
  if (!table) return;

  const header   = getQuoteHeaderRaw();
  const discount = discountValue != null ? Number(discountValue) : Number(header.discount || 0);

  if (discount === 0) {
    table.classList.add("discount-zero");
  } else {
    table.classList.remove("discount-zero");
  }
}

export function renderSummaryRows(itemsTotal) {
  const sb = document.getElementById("quoteSummaryBody");
  if (!sb) return;

  const header     = getQuoteHeaderRaw();
  const gstPercent = 18;
  const discount   = Number(header.discount || 0);

  const afterDisc    = itemsTotal - discount;
  const gstAmount    = (afterDisc * gstPercent) / 100;
  const totalValue   = afterDisc + gstAmount;
  const roundedTotal = Math.round(totalValue);
  const roundOff     = roundedTotal - totalValue;

  sb.innerHTML = `
    <tr><td colspan="3"></td><td style="text-align:right; font-size:12px; color:#475569;">Items Total</td><td style="text-align:right; font-weight:600;">₹ ${moneyINR(itemsTotal)}</td></tr>
    <tr class="discount-row"><td colspan="3"></td><td style="text-align:right; font-size:12px; color:#475569;">Discount</td><td style="text-align:right; font-weight:600;"><input id="discountInput" type="number" value="${discount}" style="width:100px; text-align:right;" oninput="discountInputChanged(this.value)" onblur="discountInputCommitted()" /></td></tr>
    <tr class="after-discount-row"><td colspan="3"></td><td style="text-align:right; font-size:12px; color:#475569;">After Discount</td><td style="text-align:right; font-weight:600;">₹ ${moneyINR(afterDisc)}</td></tr>
    <tr><td colspan="3"></td><td style="text-align:right; font-size:12px; color:#475569;">GST @ ${gstPercent}%</td><td style="text-align:right; font-weight:600;">₹ ${moneyINR(gstAmount)}</td></tr>
    <tr><td colspan="3"></td><td style="text-align:right; font-size:12px; color:#475569;">Total Value</td><td style="text-align:right; font-weight:600;">₹ ${moneyINR(totalValue)}</td></tr>
    <tr><td colspan="3"></td><td style="text-align:right; font-size:12px; color:#475569;">Round Off</td><td style="text-align:right; font-weight:600;">₹ ${moneyINR(roundOff)}</td></tr>
    <tr><td colspan="3"></td><td style="text-align:right; font-size:12px;"><strong>Grand Total</strong></td><td style="text-align:right; font-weight:700;">₹ ${moneyINR(roundedTotal)}</td></tr>
  `;

  updateDiscountVisibility(discount);
}

/* ========= Discount Handling ========= */

let discountDraft = null;

export function discountInputChanged(val) {
  discountDraft = Number(val || 0);
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
      const qtyNum  = Number(item.qty || 1);
      const unitNum = Number(item.price || item.unitPrice || 0);
      itemsTotal += qtyNum * unitNum;
    });
  });

  renderSummaryRows(itemsTotal);
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

export function openInstrumentPicker() {
  const overlay = document.getElementById("instrumentPickerOverlay");
  if (!overlay) return;

  const listEl = document.getElementById("instrumentPickerList");
  const instruments = getInstrumentsMaster();

  if (!instruments.length) {
    listEl.innerHTML = '<div style="font-size:12px; color:#64748b;">No instruments in master. Please create instruments first.</div>';
  } else {
    listEl.innerHTML = instruments.map((inst, idx) => {
      const name = inst.instrumentName || inst.name || "Unnamed Instrument";
      const code = inst.catalog || inst.instrumentCode || "";
      const desc = inst.description || inst.longDescription || "";
      const shortDesc = desc.replace(/\s+/g, " ").slice(0, 160) + (desc.length > 160 ? "…" : "";
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
    }).join("");
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

export function openItemModal(type, lineIndex) {
  const { header } = getQuoteContext();
  const line = header.quoteLines[lineIndex] || { configItems: [], additionalItems: [] };

  const overlay = document.getElementById("itemModalOverlay");
  const titleEl = document.getElementById("itemModalTitle");
  const typeEl  = document.getElementById("itemModalType");
  const lineEl  = document.getElementById("itemLineIndex");

  const codeEl      = document.getElementById("itemCodeInput");
  const qtyEl       = document.getElementById("itemQty");
  const priceEl     = document.getElementById("itemPrice");
  const priceGroup  = document.getElementById("itemPriceGroup");
  const detailsEl   = document.getElementById("itemDetails");

  currentEditIndex = null;
  typeEl.value = type;
  lineEl.value = String(lineIndex);

  titleEl.textContent = type === "config"
    ? "Configuration Items for this Instrument"
    : "Additional Items for this Instrument";

  codeEl.value    = "";
  qtyEl.value     = type === "config" ? "Included" : "1";
  detailsEl.value = "";
  if (priceGroup) priceGroup.style.display = (type === "config") ? "none" : "block";
  if (priceEl) priceEl.value = "";

  renderItemModalList(line, type);
  overlay.style.display = "flex";
}

export function closeItemModal() {
  const overlay = document.getElementById("itemModalOverlay");
  if (overlay) overlay.style.display = "none";
  currentEditIndex = null;
}

export function renderItemModalList(line, type) {
  const listEl = document.getElementById("itemModalList");
  const arr = type === "config" ? (line.configItems || []) : (line.additionalItems || []);

  if (!arr.length) {
    listEl.innerHTML = '<div style="font-size:12px; color:#64748b;">No items yet for this instrument.</div>';
    return;
  }

  listEl.innerHTML = arr.map((item, idx) => {
    const qty = item.qty != null ? item.qty : (type === "config" ? "Included" : "1");
    const price = type === "config"
      ? "Included"
      : (item.price || item.unitPrice || item.upInr || item.tpInr || "");
    return `
      <div style="display:flex; align-items:center; justify-content:space-between;
                  padding:0.25rem 0; border-bottom:1px dashed #e2e8f0;">
        <div style="flex:1; font-size:12px;">
          <div style="font-weight:600;">${item.code || ""} ${item.name || ""}</div>
          <div style="color:#64748b;">Qty: ${qty} &nbsp; | &nbsp; Price: ${price}</div>
        </div>
        <div style="display:flex; gap:0.25rem;">
          <button type="button"
                  class="btn-quote"
                  onclick="editItemFromModal('${type}', ${idx})">
            Edit
          </button>
          <button type="button"
                  class="btn-quote btn-quote-secondary"
                  onclick="removeItemFromModal('${type}', ${idx})">
            Remove
          </button>
        </div>
      </div>
    `;
  }).join("");
}

/* ========= Item Modal Editing ========= */

export function editItemFromModal(type, idx) {
  const { header } = getQuoteContext();
  const lineIndex = Number(document.getElementById("itemLineIndex").value || 0);
  const line = header.quoteLines[lineIndex] || { configItems: [], additionalItems: [] };
  const arr = type === "config" ? (line.configItems || []) : (line.additionalItems || []);
  const item = arr[idx];
  if (!item) return;

  currentEditIndex = idx;
  document.getElementById("itemModalType").value = type;

  const titleEl = document.getElementById("itemModalTitle");
  titleEl.textContent = type === "config" ? "Edit Configuration Item" : "Edit Additional Item";

  const codeEl     = document.getElementById("itemCodeInput");
  const qtyEl      = document.getElementById("itemQty");
  const priceEl    = document.getElementById("itemPrice");
  const priceGroup = document.getElementById("itemPriceGroup");
  const detailsEl  = document.getElementById("itemDetails");

  codeEl.value = item.code || "";
  qtyEl.value  = item.qty != null ? item.qty : (type === "config" ? "Included" : "1");

  if (priceGroup) priceGroup.style.display = (type === "config") ? "none" : "block";

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
  const lineIndex = Number(document.getElementById("itemLineIndex").value || 0);
  const line = header.quoteLines[lineIndex] || { configItems: [], additionalItems: [] };

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
  const typeEl    = document.getElementById("itemModalType");
  const lineIndex = Number(document.getElementById("itemLineIndex").value || 0);
  const codeEl    = document.getElementById("itemCodeInput");
  const qtyEl     = document.getElementById("itemQty");
  const priceEl   = document.getElementById("itemPrice");
  const detailsEl = document.getElementById("itemDetails");

  const type = typeEl.value;
  const code = (codeEl.value || "").trim();
  const { name } = parseDetailsText(detailsEl.value);
  if (!name) return;

  const line = header.quoteLines[lineIndex] || { configItems: [], additionalItems: [] };
  const arrName = type === "config" ? "configItems" : "additionalItems";
  if (!Array.isArray(line[arrName])) line[arrName] = [];

  const isEdit = currentEditIndex != null;
  const idx = isEdit ? currentEditIndex : line[arrName].length;

  if (type === "config") {
    const existingCode = isEdit && line.configItems[idx]?.code || null;
    const item = {
      code: code || existingCode || `CFG-${String(line.configItems.length + 1).padStart(2, "0")}`,
      name,
      description: detailsEl.value,
      qty: qtyEl.value || "Included",
      upInr: "Included",
      tpInr: "Included"
    };
    line.configItems[idx] = item;
  } else {
    const existingCode = isEdit && line.additionalItems[idx]?.code || null;
    const rawPrice = priceEl?.value || "0";
    const cleanedPrice = rawPrice.replace(/[^\d.]/g, "");
    const priceNum = parseFloat(cleanedPrice) || 0;

    const item = {
      code: code || existingCode || `ADD-${String(line.additionalItems.length + 1).padStart(2, "0")}`,
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

// Basic helper: go back
function goBack() {
  if (window.history.length > 1) window.history.back();
}

document.addEventListener("DOMContentLoaded", () => {
  // Initial render
  populateHeader();
  renderQuoteBuilder();

  // Header back button
  document.getElementById("goBackBtn")?.addEventListener("click", goBack);

  // Instrument modal
  document.getElementById("openInstrumentModalBtn")?.addEventListener("click", openInstrumentModal);
  document.getElementById("closeInstrumentModalBtn")?.addEventListener("click", closeInstrumentModal);
  document.getElementById("closeInstrumentModalFooterBtn")?.addEventListener("click", closeInstrumentModal);

  // Instrument picker
  document.getElementById("openInstrumentPickerBtn")?.addEventListener("click", openInstrumentPicker);
  document.getElementById("closeInstrumentPickerBtn")?.addEventListener("click", closeInstrumentPicker);

  // Item modal
  document.getElementById("closeItemModalBtn")?.addEventListener("click", closeItemModal);
  document.getElementById("cancelItemModalBtn")?.addEventListener("click", closeItemModal);
  document.getElementById("itemModalForm")?.addEventListener("submit", saveItemFromModal);

  // Config/Additional pickers
  document.getElementById("closeConfigPickerBtn")?.addEventListener("click", () => {
    document.getElementById("configPickerOverlay").style.display = "none";
  });
  document.getElementById("closeAdditionalPickerBtn")?.addEventListener("click", () => {
    document.getElementById("additionalPickerOverlay").style.display = "none";
  });

  // Finalize quote
  document.getElementById("finalizeQuoteBtn")?.addEventListener("click", finalizeQuote);
});
