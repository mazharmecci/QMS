// followup-logs.js
import {
  db,
  collection,
  query,
  orderBy,
  getDocs
} from "./QMS/js/firebase.js";

// ---------- Helpers ----------
function daysBetween(isoStart, isoEnd) {
  const d1 = new Date(isoStart);
  const d2 = new Date(isoEnd);
  const diffMs = d2 - d1;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function formatINR(amount) {
  if (typeof amount !== "number") return "";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

function getStatusClass(status) {
  if (status === "Sent") return "status-sent";
  if (status === "In Review") return "status-review";
  return "";
}

function getFollowupCategory(quote) {
  if (!quote.nextFollowUpDate) return null;

  const todayIso = new Date().toISOString().split("T")[0];
  const diff = daysBetween(todayIso, quote.nextFollowUpDate);

  if (diff < 0) return "overdue";
  if (diff === 0) return "due-today";
  if (diff <= 3) return "due-soon";
  return null;
}

// ---------- Rendering ----------
let quoteLogs = [];

function renderFollowupPanel() {
  const panel = document.getElementById("followupPanel");
  if (!panel) return;

  if (!quoteLogs.length) {
    panel.innerHTML = '<div class="empty-state">No follow-ups due in the next 3 days.</div>';
    return;
  }

  const todayIso = new Date().toISOString().split("T")[0];
  const groups = { overdue: [], "due-today": [], "due-soon": [] };
  const labels = {
    overdue: "⚠️ OVERDUE",
    "due-today": "📅 DUE TODAY",
    "due-soon": "⏰ DUE IN 1–3 DAYS"
  };

  quoteLogs.forEach(q => {
    const cat = getFollowupCategory(q);
    if (cat) groups[cat].push(q);
  });

  let html = "";
  ["overdue", "due-today", "due-soon"].forEach(cat => {
    const list = groups[cat];
    if (!list.length) return;

    html += `
      <div class="followup-group ${cat}">
        <div class="group-header">
          <span>${labels[cat]}</span>
          <span>(${list.length})</span>
        </div>
        ${list
          .map(q => {
            const diff = daysBetween(q.createdDate || q.lastStatusUpdate || todayIso, todayIso);
            const daysAgo = Number.isFinite(diff) ? diff : "";
            const overdueLabel =
              daysBetween(todayIso, q.nextFollowUpDate) < 0 ? " (OVERDUE)" : "";
            return `
              <div class="quote-item" data-quote-no="${q.quoteNo}">
                <div class="quote-info">
                  <div class="quote-no">${q.quoteNo || ""}</div>
                  <div class="hospital-name">
                    ${q.hospitalName || ""}${daysAgo !== "" ? ` | ${daysAgo} days ago` : ""}
                  </div>
                </div>
                <div class="due-date">
                  Next Due: ${q.nextFollowUpDate || ""}${overdueLabel}
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  });

  panel.innerHTML = html || '<div class="empty-state">No follow-ups due in the next 3 days.</div>';

  // Attach click handlers
  panel.querySelectorAll(".quote-item").forEach(el => {
    el.addEventListener("click", () => {
      const quoteNo = el.getAttribute("data-quote-no");
      showQuoteDetail(quoteNo);
    });
  });
}

function showQuoteDetail(quoteNo) {
  const detailSection = document.getElementById("quoteDetailSection");
  const container = document.getElementById("quoteDetailContainer");
  if (!detailSection || !container) return;

  const quote = quoteLogs.find(q => q.quoteNo === quoteNo);
  if (!quote) return;

  const notes = Array.isArray(quote.followUpNotes) ? quote.followUpNotes : [];

  const notesHtml = notes.length
    ? notes
        .map(note => {
          const statusClass = getStatusClass(note.status);
          return `
            <div class="log-entry">
              <div class="log-header">
                <div>
                  <div class="log-date">📅 ${note.date || ""} | ${note.time || ""}</div>
                  <div class="log-author">By: ${note.followedBy || ""}</div>
                </div>
                <span class="log-status ${statusClass}">
                  ${note.status || ""}
                </span>
              </div>
              <div class="log-note">${note.note || ""}</div>
              <div class="log-actions">
                <button class="btn btn-secondary" type="button">Edit</button>
                <button class="btn btn-danger" type="button">Delete</button>
              </div>
            </div>
          `;
        })
        .join("")
    : '<div class="empty-state">No follow-up notes yet.</div>';

  const todayIso = new Date().toISOString().split("T")[0];
  const daysAgo = daysBetween(
    quote.lastStatusUpdate || quote.createdDate || todayIso,
    todayIso
  );

  container.innerHTML = `
    <div class="quote-card">
      <div class="quote-header">
        <div class="quote-title">
          ${quote.quoteNo || ""} | ${quote.hospitalName || ""}
        </div>
      </div>

      <div class="quote-meta">
        <div class="meta-item">
          <div class="meta-label">Status</div>
          <div class="meta-value">
            📤 ${quote.currentStatus || ""}${
    Number.isFinite(daysAgo) ? ` (since ${daysAgo} days)` : ""
  }
          </div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Value</div>
          <div class="meta-value">${formatINR(quote.quoteValue)}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Contact</div>
          <div class="meta-value">
            ${quote.contactPerson || ""} | ${quote.phone || ""}
          </div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Next Follow-Up Due</div>
          <div class="meta-value">${quote.nextFollowUpDate || ""}</div>
        </div>
      </div>

      <div class="log-history">
        <h3 style="font-size:1rem; margin-bottom:8px;">✏️ FOLLOW-UP LOG HISTORY</h3>
        ${notesHtml}
        <div class="action-buttons">
          <button class="btn btn-primary" type="button">➕ Add Follow-Up Note</button>
          <button class="btn btn-secondary" type="button">📞 Schedule Call</button>
          <button class="btn btn-secondary" type="button">📧 Send Email</button>
        </div>
      </div>
    </div>
  `;

  detailSection.style.display = "block";
  detailSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- Firestore load ----------
async function loadQuoteLogs() {
  const panel = document.getElementById("followupPanel");
  if (panel) {
    panel.innerHTML = '<div class="empty-state">Loading follow-ups...</div>';
  }

  try {
    const colRef = collection(db, "quoteLogs");
    const q = query(colRef, orderBy("nextFollowUpDate", "asc"));
    const snap = await getDocs(q);

    quoteLogs = snap.docs.map(docSnap => {
      const data = docSnap.data() || {};
      return {
        id: docSnap.id,
        quoteNo: data.quoteNo || "",
        hospitalName: data.hospitalName || "",
        contactPerson: data.contactPerson || "",
        phone: data.phone || "",
        email: data.email || "",
        lastStatusUpdate: data.lastStatusUpdate || null,
        currentStatus: data.currentStatus || "",
        quoteValue: typeof data.quoteValue === "number" ? data.quoteValue : 0,
        instruments: data.instruments || [],
        createdDate: data.createdDate || null,
        createdBy: data.createdBy || "",
        lastFollowUpDate: data.lastFollowUpDate || null,
        nextFollowUpDate: data.nextFollowUpDate || null,
        followUpNotes: Array.isArray(data.followUpNotes) ? data.followUpNotes : [],
        priority: data.priority || "medium"
      };
    });

    renderFollowupPanel();
  } catch (err) {
    console.error("[followup-logs] Failed to load quoteLogs:", err);
    if (panel) {
      panel.innerHTML =
        '<div class="empty-state">Error loading follow-ups. Please try again.</div>';
    }
  }
}

document.addEventListener("DOMContentLoaded", loadQuoteLogs);
