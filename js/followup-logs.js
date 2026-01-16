// followup-logs.js
import {
  db,
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  updateDoc
} from "../js/firebase.js";

// ---------- Helpers ----------

function toIsoDateString(value) {
  if (!value) return "";
  if (value.toDate && typeof value.toDate === "function") {
    return value.toDate().toISOString().split("T")[0];
  }
  if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }
  if (typeof value === "string") {
    return value.includes("T") ? value.split("T")[0] : value;
  }
  return "";
}

function formatDateDMY(value) {
  const isoDate = toIsoDateString(value);
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}-${m}-${y}`;
}

function daysBetween(isoStart, isoEnd) {
  const d1 = new Date(isoStart);
  const d2 = new Date(isoEnd);
  const diffMs = d2 - d1;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function addDays(isoDate, days) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
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

// ---------- State ----------
let quoteLogs = [];

// ---------- Firestore updates ----------

async function saveContact(docId, newContact) {
  try {
    const ref = doc(db, "quoteHistory", docId);
    await updateDoc(ref, { contactPerson: newContact });
    const q = quoteLogs.find(x => x.id === docId);
    if (q) q.contactPerson = newContact;
  } catch (err) {
    console.error("[followup-logs] Failed to update contact:", err);
    alert("Could not save contact. Please try again.");
  }
}

async function addFollowUpNote(quote) {
  const noteText = prompt("Enter follow-up note:");
  if (!noteText) return;

  const now = new Date();
  const dateIso = now.toISOString().split("T")[0];
  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit"
  });

  const newNote = {
    date: dateIso,
    time: timeStr,
    note: noteText,
    followedBy: "sales", // TODO: replace with logged-in user
    status: "In Review"
  };

  const notes = Array.isArray(quote.followUpNotes)
    ? [...quote.followUpNotes, newNote]
    : [newNote];

  try {
    const ref = doc(db, "quoteHistory", quote.id);
    await updateDoc(ref, { followUpNotes: notes });
    quote.followUpNotes = notes;
    showQuoteDetail(quote.id); // re-render card
  } catch (err) {
    console.error("[followup-logs] Failed to add note:", err);
    alert("Could not save follow-up note. Please try again.");
  }
}

// ---------- Rendering list ----------

function renderFollowupPanel() {
  const panel = document.getElementById("followupPanel");
  if (!panel) return;

  if (!quoteLogs.length) {
    panel.innerHTML =
      '<div class="empty-state">No follow-ups due in the next 3 days.</div>';
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
            const baseIso = q.quoteDate || todayIso;
            const diff = daysBetween(baseIso, todayIso);
            const daysAgo = Number.isFinite(diff) ? diff : "";
            const overdueLabel =
              daysBetween(todayIso, q.nextFollowUpDate) < 0 ? " (OVERDUE)" : "";
            return `
              <div class="quote-item" data-quote-id="${q.id}">
                <div class="quote-info">
                  <div class="quote-no">${q.quoteNo || ""}</div>
                  <div class="hospital-name">
                    ${q.hospitalName || ""}${
              daysAgo !== "" ? ` | ${daysAgo} days ago` : ""
            }
                  </div>
                </div>
                <div class="due-date">
                  Next Due: ${formatDateDMY(q.nextFollowUpDate) || ""}${overdueLabel}
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  });

  panel.innerHTML =
    html || '<div class="empty-state">No follow-ups due in the next 3 days.</div>';

  panel.querySelectorAll(".quote-item").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-quote-id");
      showQuoteDetail(id);
    });
  });
}

// ---------- Rendering detail card ----------

function showQuoteDetail(docId) {
  const detailSection = document.getElementById("quoteDetailSection");
  const container = document.getElementById("quoteDetailContainer");
  if (!detailSection || !container) return;

  const quote = quoteLogs.find(q => q.id === docId);
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
                  <div class="log-date">📅 ${formatDateDMY(note.date) || ""} | ${
            note.time || ""
          }</div>
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
  const baseIso = quote.quoteDate || todayIso;
  const daysAgo = daysBetween(baseIso, todayIso);

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
          <input
            type="text"
            id="contact-input"
            value="${quote.contactPerson || ""}"
            placeholder="Enter contact name / number"
            style="width:100%;border:1px solid #d1d5db;border-radius:4px;padding:4px 6px;font-size:0.85rem;"
          />
        </div>
      </div>

      <div class="meta-item">
        <div class="meta-label">Quote Date (from word file)</div>
        <div class="meta-value">
          ${formatDateDMY(quote.quoteDate) || ""}
        </div>
      </div>

      <div class="meta-item">
        <div class="meta-label">Quote created In Tool</div>
        <div class="meta-value">
          ${formatDateDMY(quote.createdAt || quote.quoteDate) || ""}
        </div>
      </div>
    </div>

    <div class="meta-item">
      <div class="meta-label">Next Follow-Up Due</div>
      <div class="meta-value">
        ${formatDateDMY(quote.nextFollowUpDate) || ""}
      </div>
    </div>

    <div class="log-history">
      <h3 style="font-size:1rem; margin-bottom:8px;">✏️ FOLLOW-UP LOG HISTORY</h3>
      ${notesHtml}
      <div class="action-buttons">
        <button class="btn btn-primary" type="button" id="add-note-btn">
          ➕ Add Follow-Up Note
        </button>
        <button class="btn btn-secondary" type="button" id="send-email-btn">
          📧 Send Email
        </button>
      </div>
    </div>
  </div>
`;

  // contact save on blur
  const contactInput = document.getElementById("contact-input");
  if (contactInput) {
    contactInput.addEventListener("blur", () => {
      const newValue = contactInput.value.trim();
      if (newValue !== (quote.contactPerson || "")) {
        saveContact(quote.id, newValue);
      }
    });
  }

  // Add follow-up note
  const addNoteBtn = document.getElementById("add-note-btn");
  if (addNoteBtn) {
    addNoteBtn.addEventListener("click", () => addFollowUpNote(quote));
  }

  // Send Email (opens Outlook / default mail client)
  const sendEmailBtn = document.getElementById("send-email-btn");
  if (sendEmailBtn) {
    sendEmailBtn.addEventListener("click", () => {
      const to = quote.email || "";
      const subject = encodeURIComponent(`Quotation ${quote.quoteNo}`);
      const body = encodeURIComponent(
        `Dear ${quote.hospitalName || ""},\n\n` +
          `This is a follow-up regarding quotation ${quote.quoteNo}.\n\n` +
          `Regards,\nSales Team`
      );
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    });
  }

  detailSection.style.display = "block";
  detailSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- Firestore load from quoteHistory ----------

async function loadQuoteLogs() {
  const panel = document.getElementById("followupPanel");
  if (panel) {
    panel.innerHTML = '<div class="empty-state">Loading follow-ups...</div>';
  }

  try {
    const colRef = collection(db, "quoteHistory");
    const q = query(colRef, orderBy("quoteDate", "desc"));
    const snap = await getDocs(q);

    const todayIso = new Date().toISOString().split("T")[0];

    quoteLogs = snap.docs.map(docSnap => {
      const data = docSnap.data() || {};

      const quoteDateIso = toIsoDateString(data.quoteDate) || todayIso;
      const createdAtIso = toIsoDateString(data.createdAt);

      let nextFollowIso = data.nextFollowUpDate
        ? toIsoDateString(data.nextFollowUpDate)
        : addDays(quoteDateIso, 3);

      if (nextFollowIso < todayIso) {
        nextFollowIso = addDays(todayIso, 3);
      }

      return {
        id: docSnap.id,
        quoteNo: data.quoteNo || "",
        // prefer new hospitalName field, then hospital.name, then old clientName
        hospitalName:
          data.hospitalName ||
          (data.hospital && data.hospital.name) ||
          data.clientName ||
          "",
        contactPerson:
          data.contactPerson ||
          (data.hospital && data.hospital.contactPerson) ||
          "",
        phone:
          data.phone ||
          (data.hospital && data.hospital.phone) ||
          "",
        email:
          data.email ||
          (data.hospital && data.hospital.email) ||
          "",
        quoteDate: quoteDateIso,
        createdAt: createdAtIso,
        currentStatus: data.currentStatus || data.status || "",
        quoteValue:
          typeof data.totalValueINR === "number"
            ? data.totalValueINR
            : typeof data.totalValue === "number"
            ? data.totalValue
            : 0,
        followUpNotes: Array.isArray(data.followUpNotes)
          ? data.followUpNotes
          : [],
        nextFollowUpDate: nextFollowIso
      };
    });

    renderFollowupPanel();
  } catch (err) {
    console.error("[followup-logs] Failed to load quoteHistory:", err);
    if (panel) {
      panel.innerHTML =
        '<div class="empty-state">Error loading follow-ups. Please try again.</div>';
    }
  }
}

document.addEventListener("DOMContentLoaded", loadQuoteLogs);
