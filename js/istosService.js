// Import everything from your firebase.js wrapper
import { 
  auth, 
  db, 
  storage, 
  doc, 
  setDoc, 
  ref, 
  uploadBytes, 
  getDownloadURL,
  serverTimestamp
} from "./firebase.js";

// --- Helper: decode JWT payload for debugging ---
function decodeToken(token) {
  try {
    const parts = token.split(".");
    const payload = JSON.parse(atob(parts[1]));
    console.log("Decoded token payload:", payload);
    return payload;
  } catch (err) {
    console.error("Failed to decode token:", err);
    return null;
  }
}

// --- Helper: log ID token for debugging ---
async function logAuthToken() {
  if (!auth.currentUser) {
    console.error("No user is signed in!");
    return null;
  }
  try {
    const token = await auth.currentUser.getIdToken(/* forceRefresh */ true);
    console.log("Firebase ID Token:", token);
    decodeToken(token);
    return token;
  } catch (err) {
    console.error("Failed to fetch ID token:", err);
    return null;
  }
}

// --- Helper: get serial number (handles dropdown + new input) ---
function getSerialNumber() {
  // Check dropdown first
  const serialDropdown = document.getElementById("serialDropdown");
  const newSerialInput = document.getElementById("newSerialInput");
  
  if (!serialDropdown) {
    console.error("Serial dropdown not found");
    return null;
  }

  const dropdownValue = serialDropdown.value.trim();
  
  // If "new serial" selected, use the text input
  if (dropdownValue === "__new") {
    if (!newSerialInput || !newSerialInput.value.trim()) {
      throw new Error("Please enter a new serial number.");
    }
    return newSerialInput.value.trim();
  }
  
  // Otherwise use dropdown value
  if (!dropdownValue) {
    throw new Error("Please select a serial number.");
  }
  
  return dropdownValue;
}

// --- Helper: get equipment name ---
function getEquipmentName() {
  const equipmentSelect = document.getElementById("equipmentName");
  if (!equipmentSelect) {
    console.error("Equipment dropdown not found");
    return null;
  }
  const value = equipmentSelect.value.trim();
  if (!value) {
    throw new Error("Please select equipment.");
  }
  return value;
}

// --- Helper: upload photos to Firebase Storage ---
// --- FIXED: Verbose photo upload with debugging ---
async function uploadPhotos(equipmentName, serial, visitId, files) {
  console.log("🖼️ Uploading photos:", files?.length || 0, "files");
  
  if (!files?.length) {
    console.log("⚠️ No files to upload");
    return [];
  }

  const urls = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`📁 Uploading file ${i + 1}/${files.length}:`, file.name, file.size, "bytes");
    
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const path = `service-photos/${equipmentName}/${serial}/${visitId}/${safeName}`;
    const storageRef = ref(storage, path);

    const metadata = {
      contentType: file.type || 'image/jpeg',
      customMetadata: {
        engineerId: auth.currentUser.uid,
        equipmentName,
        serial,
        visitId,
        uploadedAt: new Date().toISOString()
      }
    };

    try {
      console.log(`🔄 Uploading to path: ${path}`);
      const snapshot = await uploadBytes(storageRef, file, metadata);
      console.log("✅ Upload snapshot:", snapshot);
      
      const url = await getDownloadURL(storageRef);
      console.log("🔗 Download URL:", url);
      urls.push(url);
    } catch (err) {
      console.error(`❌ Failed to upload ${file.name}:`, err);
      // Continue with other files
    }
  }
  
  console.log("📊 Upload complete. Final URLs:", urls);
  return urls;
}

// --- Helper: save service visit to Firestore ---
async function saveServiceVisit(formData) {
  if (!auth.currentUser) {
    throw new Error("User must be signed in.");
  }

  await logAuthToken();

  const visitId = `visit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const photoUrls = await uploadPhotos(
    formData.equipmentName, 
    formData.serial, 
    visitId, 
    formData.files
  );

  const visitDoc = {
    equipmentName: formData.equipmentName,
    instrumentSerial: formData.serial,
    diagnostics: formData.diagnostics,
    actionsTaken: formData.actionsTaken,
    engineerName: formData.engineerName,
    engineerId: auth.currentUser.uid,
    photos: photoUrls,
    createdAt: serverTimestamp()
  };

  await setDoc(doc(db, "serviceVisits", visitId), visitDoc);
  return visitId;
}

// --- Public initializer: attach form logic ---
export function initServiceForm() {
  const form = document.getElementById("serviceVisitForm");
  if (!form) {
    console.warn("Service Visit Form not found.");
    return;
  }

  // Photo preview
  const photosInput = document.getElementById("photosInput");
  const photosPreview = document.getElementById("photosPreview");
  
  if (photosInput && photosPreview) {
    photosInput.addEventListener("change", (e) => {
      photosPreview.innerHTML = "";
      Array.from(e.target.files).forEach(file => {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.className = "photo-gallery img";
        photosPreview.appendChild(img);
      });
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    try {
      // Safely extract form data
      const equipmentName = getEquipmentName();
      const serial = getSerialNumber();
      const diagnostics = document.getElementById("diagnostics")?.value?.trim() || "";
      const actionsTaken = document.getElementById("actionsTaken")?.value?.trim() || "";
      const engineerName = document.getElementById("engineerName")?.value?.trim() || "";
      const files = document.getElementById("photosInput")?.files || [];

      if (!actionsTaken) {
        alert("Actions taken is required.");
        return;
      }

      const formData = {
        equipmentName,
        serial,
        diagnostics,
        actionsTaken,
        engineerName,
        files
      };

      console.log("Saving service visit:", formData);

      const visitId = await saveServiceVisit(formData);
      
      alert(`✅ Service visit ${visitId.slice(-8)} saved successfully!`);
      
      // Reset form
      form.reset();
      photosPreview.innerHTML = "";
      
    } catch (err) {
      console.error("Error saving visit:", err);
      alert(`❌ Error: ${err.message}`);
    }
  });

  console.log("✅ Service form handlers attached.");
}
