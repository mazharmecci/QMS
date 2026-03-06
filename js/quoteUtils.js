// quoteUtils.js

export function moneyINR(value) {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return "0.00";

  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

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

export function parseLines(raw) {
  if (!raw) return [];
  return String(raw)
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);
}

export function parseDetailsText(rawText) {
  const lines = parseLines(rawText);
  const name = lines[0] || "";
  const description = lines.slice(1).join("\n");
  return { name, description };
}

/**
 * Render the instrument cell for the quote builder table.
 */
export function formatInstrumentCell(inst, lineIdx) {
  const code       = inst.catalog || inst.instrumentCode || inst.code || "";
  const name       = inst.instrumentName || inst.name || "Unnamed Instrument";
  const descText   = inst.description || inst.longDescription || "";
  const descLines  = parseLines(descText);

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

  // Description with >>>>> marker detection
  descLines.forEach(line => {
    if (line.includes(">>>>>")) {
      const cleaned = line.replace(/>{5}/g, "").trim();
      html += `<div style="margin-bottom:2px;">${cleaned}</div><div style="height:12px;"></div>`;
    } else {
      html += `<div style="margin-bottom:2px;">${line}</div>`;
    }
  });

  // Supplied complete with
  if (suppliedLines.length) {
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
      html += `<div style="margin-bottom:2px;">Country of Origin: ${origin}</div>`;
    }
    if (hsn) {
      html += `<div>HSN Code: ${hsn}</div>`;
    }
  }

  // Config / Additional buttons
  html += `
    <div style="margin-top:2px; display:flex; gap:0.4rem; flex-wrap:wrap;">
      <button type="button" class="btn-quote" onclick="openConfigModal(${lineIdx})">Config Items</button>
      <button type="button" class="btn-quote btn-quote-secondary" onclick="openAdditionalModal(${lineIdx})">Additional Items</button>
    </div>
  `;

  html += `</td>`;
  return html;
}

/**
 * Render a generic item cell (config/additional).
 */
export function formatItemCell(item) {
  const code = item.code || item.catalog || "";
  const descSource = item.description || item.longDescription || "";
  const rawLines = descSource.split(/\r?\n/);

  const titleLine = rawLines[0] || item.name || item.itemName || "Unnamed Item";
  const contentLines = rawLines.slice(1);

  const escape = str =>
    String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  let html = `<td style="white-space:normal; vertical-align:top; line-height:1.4;">`;

  if (code) {
    html += `<div class="cat-main" style="margin-bottom:2px; font-weight:700;">${escape(code)}</div>`;
  }

  if (titleLine) {
    html += `<div style="font-weight:700; margin-bottom:4px;">${escape(titleLine)}</div>`;
  }

  contentLines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) {
      html += `<div style="height:4px;"></div>`;
      return;
    }

    if (trimmed.includes(">>>>>")) {
      const cleaned = trimmed.replace(/>{5}/g, "").trim();
      html += `<div>${escape(cleaned)}</div><div style="height:12px;"></div>`;
      return;
    }

    if (trimmed.startsWith("-")) {
      const bulletText = trimmed.replace(/^-+\s*/, "");
      html += `<div style="padding-left:1.25rem;">- ${escape(bulletText)}</div>`;
      return;
    }

    if (
      trimmed.toLowerCase().startsWith("country of origin:") ||
      trimmed.toLowerCase().startsWith("hsn code:")
    ) {
      html += `<div>${escape(trimmed)}</div>`;
      return;
    }

    html += `<div>${escape(trimmed)}</div>`;
  });

  html += `</td>`;
  return html;
}
