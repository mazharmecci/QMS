/**
 * Format a number into INR currency style (with commas).
 * @param {number} value
 * @returns {string}
 */
// quoteUtils.js
export function moneyINR(value) {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return "0.00";

  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
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
    const code       = inst.catalog || inst.instrumentCode || inst.code || "";
    const name       = inst.instrumentName || inst.name || "Unnamed Instrument";
  
    // Refactored: separate fields for description and additionalDescription
    const mainDesc   = inst.description || "";
    const extraDesc  = inst.additionalDescription || "";
  
    const suppliedRaw = inst.suppliedCompleteWith || inst.suppliedWith || inst.supplied || "";
    const { suppliedLines, metaLines } = parseSuppliedBlock(suppliedRaw);
  
    const origin = inst.origin || inst.country || inst.countryOfOrigin || "";
    const hsn    = inst.hsn || inst.hsnCode || "";
  
    let html = `<td style="white-space:pre-line; vertical-align:top; line-height:1.35;">`;
  
    // Code
    if (code) {
      html += `<div class="cat-main" style="margin-bottom:2px; font-weight:700;">${code}</div>`;
    }
  
    // Name
    if (name) {
      html += `<div style="font-weight:600; margin-bottom:4px;">${name}</div>`;
    }
  
    // Main description
    if (mainDesc) {
      html += `<div style="font-weight:600; margin-bottom:4px;">${mainDesc}</div>`;
    }
  
    // Additional description / technical specs
    if (extraDesc) {
      html += `<div style="height:10px;"></div>`; // spacer before second block
      // Split into lines and render as bullet points
      parseLines(extraDesc).forEach(line => {
        html += `<div style="margin-bottom:2px;">• ${line}</div>`;
      });
    }
  
    // Supplied complete with
    if (suppliedLines.length) {
      html += `<div style="height:12px;"></div>`; // spacer before heading
      html += `<div style="font-weight:600; margin:4px 0 2px;">Supplied Complete with:</div>`;
      suppliedLines.forEach(line => {
        html += `<div style="padding-left:1.25rem; margin-bottom:2px;">- ${line}</div>`;
      });
    }
  
    // Meta / origin / HSN
    if (metaLines.length || origin || hsn) {
      metaLines.forEach(line => {
        html += `<div style="margin-bottom:2px;">${line}</div>`;
      });
  
      if (origin) {
        html += `<div style="height:10px;"></div>`; // spacer before origin
        html += `<div style="margin-bottom:2px;">Country of Origin: ${origin}</div>`;
      }
      if (hsn) {
        html += `<div style="height:6px;"></div>`; // spacer before HSN
        html += `<div>HSN Code: ${hsn}</div>`;
      }
    }
  
    html += `</td>`;
    return html;
  }

  // Config / Additional buttons – very small top margin
  html += `
    <div style="margin-top:2px; display:flex; gap:0.4rem; flex-wrap:wrap;">
      <button type="button" class="btn-quote" onclick="openConfigModal(${lineIdx})">
        Config Items
      </button>
      <button type="button" class="btn-quote btn-quote-secondary" onclick="openAdditionalModal(${lineIdx})">
        Additional Items
      </button>
    </div>
  `;

  html += `</td>`;
  return html;
}

/**
 * Render a generic item cell (config/additional) with preserved formatting.
 * First line: code (bold)
 * Second line: main title (bold)
 * Remaining lines: description + additionalDescription shown with bullets, origin, HSN.
 * @param {object} item
 * @returns {string} HTML string
 */
export function formatItemCell(item) {
  const code = item.code || item.catalog || "";

  // ✅ Use new fields
  const mainDesc = item.description || "";
  const extraDesc = item.additionalDescription || "";

  const escape = str =>
    String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  let html = `<td style="white-space:normal; vertical-align:top; line-height:1.4;">`;

  // Code
  if (code) {
    html += `<div class="cat-main" style="margin-bottom:2px; font-weight:700;">${escape(code)}</div>`;
  }

  // Main description (title line)
  if (mainDesc) {
    html += `<div style="font-weight:700; margin-bottom:4px;">${escape(mainDesc)}</div>`;
  }

  // Additional description (bullet points or plain lines)
  if (extraDesc) {
    escape(extraDesc)
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .forEach(line => {
        if (line.startsWith("-")) {
          const bulletText = line.replace(/^-+\s*/, "");
          html += `<div style="padding-left:1.25rem;">- ${escape(bulletText)}</div>`;
        } else if (
          line.toLowerCase().startsWith("country of origin:") ||
          line.toLowerCase().startsWith("hsn code:")
        ) {
          // Meta lines not indented
          html += `<div>${escape(line)}</div>`;
        } else {
          html += `<div>${escape(line)}</div>`;
        }
      });
  }

  html += `</td>`;
  return html;
}

