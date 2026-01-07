// hospitalUI.js
import {
  fetchHospitals,
  addHospital,
  updateHospital,
  deleteHospital as deleteHospitalFromService
} from "./hospitalService.js";

const form = document.getElementById("hospitalForm");
const tableBody = document.querySelector("#hospitalTable tbody");
let hospitals = [];
let editIndex = null;

// 🔹 Render hospital table
export async function renderTable() {
  tableBody.innerHTML = "";

  try {
    hospitals = await fetchHospitals(); // Firebase-first
    localStorage.setItem("hospitals", JSON.stringify(hospitals));
  } catch (error) {
    console.error("Error fetching from Firebase, using localStorage:", error);
    hospitals = JSON.parse(localStorage.getItem("hospitals") || "[]");
  }

  hospitals.forEach((h, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${h.clientCode || ""}</td>
      <td>${h.clientName || ""}</td>
      <td>${h.address || ""}</td>
      <td>${h.area || ""}</td>
      <td>${h.mobile || ""}</td>
      <td>${h.email || ""}</td>
      <td>${h.gst || ""}</td>
      <td class="actions">
        <button class="edit-btn" onclick="editHospital(${index})">Edit</button>
        <button class="delete-btn" onclick="deleteHospitalUI(${index})">Delete</button>
      </td>
    `;
    tableBody.appendChild(row);
  });

  const codeEl = document.getElementById("clientCode");
  if (codeEl) codeEl.value = getNextClientCode();
}

// 🔹 Generate next client code
function getNextClientCode() {
  if (!hospitals.length) return "HO-01";
  const nums = hospitals
    .map(h => h.clientCode || "")
    .map(code => {
      const match = String(code).match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => !isNaN(n) && n > 0);

  const maxNum = nums.length ? Math.max(...nums) : 0;
  return "HO-" + String(maxNum + 1).padStart(2, "0");
}

// 🔹 Handle form submit
form.addEventListener("submit", async e => {
  e.preventDefault();
  const isEdit = editIndex !== null;

  const hospital = {
    clientCode: isEdit
      ? document.getElementById("clientCode").value
      : getNextClientCode(),
    clientName: document.getElementById("clientName").value,
    address: document.getElementById("address").value,
    area: document.getElementById("area").value,
    mobile: document.getElementById("mobile").value,
    email: document.getElementById("email").value,
    gst: document.getElementById("gst").value
  };

  if (isEdit) {
    const id = hospitals[editIndex]?.id;
    const updatedHospital = { ...hospital, id };
    hospitals[editIndex] = updatedHospital;

    try {
      if (id) await updateHospital(id, updatedHospital);
      localStorage.setItem("hospitals", JSON.stringify(hospitals));
    } catch (err) {
      console.error("Update failed:", err);
    }
    editIndex = null;
  } else {
    try {
      const newId = await addHospital(hospital);
      hospitals.push({ ...hospital, id: newId });
      localStorage.setItem("hospitals", JSON.stringify(hospitals));
    } catch (err) {
      console.error("Add failed:", err);
    }
  }

  form.reset();
  document.getElementById("clientCode").value = getNextClientCode();
  renderTable();
});

// 🔹 Edit hospital
window.editHospital = function (index) {
  const h = hospitals[index];
  if (!h) return;

  document.getElementById("clientCode").value = h.clientCode || "";
  document.getElementById("clientName").value = h.clientName || "";
  document.getElementById("address").value = h.address || "";
  document.getElementById("area").value = h.area || "";
  document.getElementById("mobile").value = h.mobile || "";
  document.getElementById("email").value = h.email || "";
  document.getElementById("gst").value = h.gst || "";

  editIndex = index;
};

// 🔹 Delete hospital
window.deleteHospitalUI = async function (index) {
  if (!confirm("Are you sure you want to delete this hospital?")) return;
  const hospital = hospitals[index];
  if (!hospital) return;

  hospitals.splice(index, 1);
  localStorage.setItem("hospitals", JSON.stringify(hospitals));

  try {
    if (hospital.id) await deleteHospitalFromService(hospital.id);
  } catch (err) {
    console.error("Delete failed:", err);
  }

  renderTable();
};

// 🔹 Initial load
renderTable();

