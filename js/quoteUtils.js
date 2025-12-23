// quoteUtils.js

/**
 * Format a number into INR currency style (with commas).
 * @param {number} value
 * @returns {string}
 */
export function moneyINR(value) {
  const num = Number(value || 0);
  return num.toLocaleString("en-IN", { minimumFractionDigits: 0 });
}

/**
 * Render the instrument cell for the quote builder table.
 * @param {object} inst - instrument object
 * @param {number} lineIdx - index of the line
 * @returns {string} HTML string
 */
export function formatInstrumentCell(inst, lineIdx) {
  const name = inst.instrumentName || inst.name || "Unnamed Instrument";
  const desc = inst.description || inst.longDescription || "";
  const shortDesc = desc.replace(/\s+/g, " ").slice(0, 80) + (desc.length > 80 ? "…" : "");

  return `
    <td>
      <div style="font-weight:600;">${name}</div>
      <div style="font-size:11px; color:#64748b;">${shortDesc}</div>
      <div style="margin-top:4px;">
        <button type="button" class="btn-quote" style="font-size:11px; padding:0.2rem 0.6rem; margin-right:0.25rem;" onclick="openConfigModal(${lineIdx})">Config</button>
        <button type="button" class="btn-quote btn-quote-secondary" style="font-size:11px; padding:0.2rem 0.6rem;" onclick="openAdditionalModal(${lineIdx})">Additional</button>
      </div>
    </td>
  `;
}

/**
 * Render a generic item cell (config/additional).
 * @param {object} item
 * @returns {string} HTML string
 */
export function formatItemCell(item) {
  const name = item.name || item.itemName || "Unnamed Item";
  const desc = item.description || "";
  const shortDesc = desc.replace(/\s+/g, " ").slice(0, 60) + (desc.length > 60 ? "…" : "");

  return `
    <td>
      <div style="font-weight:600;">${item.code || ""} ${name}</div>
      <div style="font-size:11px; color:#64748b;">${shortDesc}</div>
    </td>
  `;
}

/**
 * Parse details text into structured parts.
 * @param {string} rawText
 * @returns {{ name: string, description: string }}
 */
export function parseDetailsText(rawText) {
  const lines = (rawText || "").split("\n").map(l => l.trim()).filter(Boolean);
  const name = lines[0] || "";
  const description = lines.slice(1).join("\n");
  return { name, description };
}
