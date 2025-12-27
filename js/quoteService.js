// Import db, auth, storage, and Firestore/Storage helpers from your CDN-based firebase.js
import {
  auth,
  db,
  storage,
  doc,
  setDoc,
  collection,
  ref,
  uploadBytes,
  getDownloadURL
} from "../js/firebase.js"; // adjust path if needed

// Reference to serviceVisits collection
const serviceVisitsRef = collection(db, "serviceVisits");

// --- Helper: generate unique visitId ---
function makeVisitId() {
  return `visit-${Date.now()}`;
}

// --- Upload photos to Firebase Storage ---
async function uploadVisitPhotos(instrumentSerial, visitId, files) {
  const urls = [];
  for (const file of files) {
    const cleanName = file.name.replace(/\s+/g, "_");
    const path = `service-photos/${instrumentSerial}/${visitId}/${cleanName}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    urls.push(url);
  }
  return urls;
}

// --- Save service visit to Firestore ---
export async function saveServiceVisit(data, files) {
  const visitId = makeVisitId();
  const photoUrls = files && files.length
    ? await uploadVisitPhotos(data.instrumentSerial, visitId, Array.from(files))
    : [];

  const visitDoc = {
    ...data,
    visitId,
    photos: photoUrls,
    engineerId: auth.currentUser?.uid || "unknown",
    createdAt: new Date()
  };

  try {
    await setDoc(doc(db, "serviceVisits", visitId), visitDoc);
    console.log("Service visit saved:", visitDoc.instrumentSerial);
    return visitId;
  } catch (err) {
    console.error("Error saving service visit:", err);
    throw err;
  }
}

// --- Wire up form submission ---
document.getElementById("serviceVisitForm")?.addEventListener("submit", async e => {
  e.preventDefault();

  const instrumentSerial = document.getElementById("instrumentSerial").value.trim();
  const diagnostics = document.getElementById("diagnostics").value.trim();
  const actionsTaken = document.getElementById("actionsTaken").value.trim();
  const files = document.getElementById("photosInput").files;

  if (!instrumentSerial) {
    alert("Instrument serial is required.");
    return;
  }

  const visitBase = {
    instrumentSerial,
    diagnostics,
    actionsTaken,
    hospitalId: "", // optional: hydrate from instrument or selection
    ticketId: "",   // optional: link to a service ticket
  };

  try {
    await saveServiceVisit(visitBase, files);
    alert("Service visit saved successfully.");
  } catch (err) {
    alert("Could not save service visit. Please try again.");
  }
});
