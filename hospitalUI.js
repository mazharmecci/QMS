import { fetchHospitals, addHospital, updateHospital, deleteHospital } from "./hospitalService.js";

// DOM references
const form = document.getElementById('hospitalForm');
const tableBody = document.querySelector('#hospitalTable tbody');
let hospitals = [];   // local cache
let editIndex = null; // track editing state

// Render table (Firebase-first, fallback to localStorage)
export async function renderTable() {
  tableBody.innerHTML = '';

  try {
    hospitals = await fetchHospitals(); // Firebase fetch (syncs localStorage too)
  } catch (error) {
    console.error("Error fetching from Firebase, using localStorage:", error);
    hospitals = JSON.parse(localStorage.getItem('hospitals') || '[]');
  }

  hospitals.forEach((h, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${h.clientCode}</td>
      <td>${h.clientName}</td>
      <td>${h.address}</td>
      <td>${h.area}</td>
      <td>${h.mobile}</td>
      <td>${h.email}</td>
      <td>${h.pan}</td>
      <td class="actions">
        <button class="edit-btn" onclick="editHospital(${index})">Edit</button>
        <button class="delete-btn" onclick="deleteHospital(${index})">Delete</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

// Generate next client code
function getNextClientCode() {
  if (!hospitals.length) return 'HOSP-01';

  const nums = hospitals
    .map(h => h.clientCode || '')
    .map(code => {
      const match = String(code).match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => !isNaN(n) && n > 0);

  const maxNum = nums.length ? Math.max(...nums) : 0;
  const nextNum = maxNum + 1;

  return 'HOSP-' + String(nextNum).padStart(2, '0');
}

// Handle form submit
form.addEventListener('submit', async function(e) {
  e.preventDefault();

  const isEdit = editIndex !== null;

  const hospital = {
    clientCode: isEdit
      ? document.getElementById('clientCode').value
      : getNextClientCode(),
    clientName: document.getElementById('clientName').value,
    address: document.getElementById('address').value,
    area: document.getElementById('area').value,
    mobile: document.getElementById('mobile').value,
    email: document.getElementById('email').value,
    pan: document.getElementById('pan').value
  };

  if (isEdit) {
    hospitals[editIndex] = hospital;
    localStorage.setItem('hospitals', JSON.stringify(hospitals));
    await updateHospital(hospitals[editIndex].id, hospital, editIndex);
    editIndex = null;
  } else {
    hospitals.push(hospital);
    localStorage.setItem('hospitals', JSON.stringify(hospitals));
    await addHospital(hospital);
  }

  form.reset();
  document.getElementById('clientCode').value = getNextClientCode();
  renderTable();
});

// Edit hospital
window.editHospital = function(index) {
  const h = hospitals[index];
  document.getElementById('clientCode').value = h.clientCode;
  document.getElementById('clientName').value = h.clientName;
  document.getElementById('address').value = h.address;
  document.getElementById('area').value = h.area;
  document.getElementById('mobile').value = h.mobile;
  document.getElementById('email').value = h.email;
  document.getElementById('pan').value = h.pan;
  editIndex = index;
};

// Delete hospital
window.deleteHospital = async function(index) {
  if (confirm('Are you sure you want to delete this hospital?')) {
    const hospital = hospitals[index];
    hospitals.splice(index, 1);
    localStorage.setItem('hospitals', JSON.stringify(hospitals));
    await deleteHospital(hospital.id, index);
    renderTable();
    document.getElementById('clientCode').value = getNextClientCode();
  }
};

// Initial render
renderTable();
document.getElementById('clientCode').value = getNextClientCode();
