/**
 * Format a number into INR currency style (with commas).
 * @param {number} value
 * @returns {string}
 */
export function moneyINR(value) {
  const num = Number(value || 0);
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Parse a block of text into "supplied items" and "meta details".
 * Blank line separates the two sections.
 * @param {string|array} raw
 * @returns {{ suppliedLines: string[], metaLines: string[] }}
 */
export function parseSuppliedBlock(raw) {
  let lines = [];

  if (Array.isArray(raw)) {
    lines = raw.map(String).filter(Boolean);
  } else {
    lines = String(raw || "")
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean);
  }

  const blankIndex = lines.findIndex(line => line === "");
  const suppliedLines = blankIndex >= 0 ? lines.slice(0, blankIndex) : lines;
  const metaLines = blankIndex >= 0 ? lines.slice(blankIndex + 1) : [];

  return { suppliedLines, metaLines };
}

/**
 * Parse plain text into trimmed non-empty lines.
 * @param {string} raw
 * @returns {string[]}
 */
export function parseLines(raw) {
  if (!raw) return [];
  return String(raw)
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);
}

/**
 * Parse details text into structured parts.
 * @param {string} rawText
 * @returns {{ name: string, description: string }}
 */
export function parseDetailsText(rawText) {
  const lines = parseLines(rawText);
  const name = lines[0] || "";
  const description = lines.slice(1).join("\n");
  return { name, description };
}

/**
 * Render the instrument cell for the quote builder table.
 * @param {object} inst - instrument object
 * @param {number} lineIdx - index of the line
 * @returns {string} HTML string
 */
export function formatInstrumentCell(inst, lineIdx) {
  const code     = inst.catalog || inst.instrumentCode || inst.code || "";
  const name     = inst.instrumentName || inst.name || "Unnamed Instrument";
  const descText = inst.longDescription || inst.description || "";
  const descLines = parseLines(descText);

  const suppliedRaw = inst.suppliedCompleteWith || inst.suppliedWith || inst.supplied || "";
  const { suppliedLines, metaLines } = parseSuppliedBlock(suppliedRaw);

  const origin = inst.origin || inst.country || inst.countryOfOrigin || "";
  const hsn    = inst.hsn || inst.hsnCode || "";

  let html = `<td style="white-space:pre-line; vertical-align:top; line-height:1.35;">`;

  if (code) html += `<div class="cat-main" style="margin-bottom:2px;">${code}</div>`;
  if (name) html += `<div style="font-weight:600; margin-bottom:4px;">${name}</div>`;
  if (descLines.length) {
    html += `<div style="font-weight:600;">${descLines.join(" ")}</div>`;
    html += `<div style="height:8px;"></div>`;
  }

  if (suppliedLines.length) {
    html += `<div style="font-weight:600; margin-bottom:2px;">Supplied Complete with:</div>`;
    suppliedLines.forEach(line => {
      html += `<div style="padding-left:1.25rem;">- ${line}</div>`;
    });
  }

  if (metaLines.length || origin || hsn) {
    html += `<div style="height:8px;"></div>`;
  }

  metaLines.forEach(line => {
    html += `<div>${line}</div>`;
  });

  if (origin) html += `<div>Country of Origin: ${origin}</div>`;
  if (hsn) html += `<div>HSN Code: ${hsn}</div>`;

  html += `
    <div style="margin-top:8px; display:flex; gap:0.4rem; flex-wrap:wrap;">
      <button type="button" class="btn-quote" onclick="openConfigModal(${lineIdx})">Config Items</button>
      <button type="button" class="btn-quote btn-quote-secondary" onclick="openAdditionalModal(${lineIdx})">Additional Items</button>
    </div>
  `;

  html += `</td>`;
  return html;
}

/**
 * Render a generic item cell (config/additional) with preserved formatting.
 * First line: code (bold)
 * Second line: main title (bold)
 * Remaining lines: shown exactly as typed (including "Supplied Complete with", bullets, origin, HSN).
 * @param {object} item
 * @returns {string} HTML string
 */
export function formatItemCell(item) {
  const code = item.code || item.catalog || "";
  const descSource = item.description || item.longDescription || "";

  // Split raw description into lines without trying to re‑parse supplied/meta blocks
  const lines = descSource.split(/\r?\n/);

  const titleLine = lines[0] || item.name || item.itemName || "Unnamed Item";
  const bodyLines = lines.slice(1); // all remaining lines as the user authored them

  // Escape HTML and preserve line breaks
  const escape = str =>
    String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const bodyHtml = bodyLines
    .map(escape)
    .join("<br>");

  let html = `<td style="white-space:normal; vertical-align:top; line-height:1.4;">`;

  if (code) {
    html += `<div class="cat-main" style="margin-bottom:2px; font-weight:700;">${escape(code)}</div>`;
  }

  if (titleLine) {
    html += `<div style="font-weight:700; margin-bottom:4px;">${escape(titleLine)}</div>`;
  }

  if (bodyLines.length) {
    html += `<div style="font-weight:400;">${bodyHtml}</div>`;
  }

  html += `</td>`;
  return html;
}

