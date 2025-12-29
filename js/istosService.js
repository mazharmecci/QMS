// Import everything from your firebase.js wrapper
import { 
  auth, 
  db, 
  storage, 
  doc, 
  setDoc, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "./firebase.js";  // adjust path if needed

async function uploadPhotos(serial, visitId, files) {
  const urls = [];
  for (const file of files) {
    const safeName = file.name.replace(/\s+/g, "_");
    const path = `service-photos/${serial}/${visitId}/${safeName}`;
    const storageRef = ref(storage, path);

    try {
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      urls.push(url);
    } catch (err) {
      console.error(`Failed to upload ${file.name}:`, err);
      throw err; // stop if upload fails
    }
  }
  return urls;
}

async function saveServiceVisit(serial, diagnostics, actions, files) {
  if (!auth.currentUser) {
    throw new Error("User must be signed in to save a service visit.");
  }

  const visitId = `visit-${Date.now()}`;
  const photoUrls = files?.length ? await uploadPhotos(serial, visitId, Array.from(files)) : [];

  const visitDoc = {
    instrumentSerial: serial,
    diagnostics,
    actionsTaken: actions,
    photos: photoUrls,
    engineerId: auth.currentUser.uid,
    createdAt: serverTimestamp()
  };

  await setDoc(doc(db, "serviceVisits", visitId), visitDoc);
  return visitId;
}

// --- Public initializer: attach form logic ---
export function initServiceForm() {
  const form = document.getElementById("serviceVisitForm");
  if (!form) {
    console.warn("Service Visit Form not found in DOM.");
    return;
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();

    const serial = document.getElementById("instrumentSerial").value.trim();
    const diagnostics = document.getElementById("diagnostics").value.trim();
    const actions = document.getElementById("actionsTaken").value.trim();
    const files = document.getElementById("photosInput").files;

    if (!serial) {
      alert("Instrument serial is required.");
      return;
    }

    try {
      const visitId = await saveServiceVisit(serial, diagnostics, actions, files);
      alert(`Visit ${visitId} saved successfully!`);
    } catch (err) {
      console.error("Error saving visit:", err);
      alert("Could not save service visit. Please try again.");
    }
  });
}
