import { auth, db, storage } from './js/firebase.js';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

async function uploadPhotos(serial, visitId, files) {
  const urls = [];
  for (const file of files) {
    const path = `service-photos/${serial}/${visitId}/${file.name.replace(/\s+/g, '_')}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    urls.push(url);
  }
  return urls;
}

document.getElementById('serviceVisitForm').addEventListener('submit', async e => {
  e.preventDefault();
  const serial = document.getElementById('instrumentSerial').value.trim();
  const diagnostics = document.getElementById('diagnostics').value.trim();
  const actions = document.getElementById('actionsTaken').value.trim();
  const files = document.getElementById('photosInput').files;

  const visitId = `visit-${Date.now()}`;
  const photoUrls = await uploadPhotos(serial, visitId, Array.from(files));

  await setDoc(doc(db, 'serviceVisits', visitId), {
    instrumentSerial: serial,
    diagnostics,
    actionsTaken: actions,
    photos: photoUrls,
    engineerId: auth.currentUser?.uid,
    createdAt: new Date()
  });

  alert('Visit saved successfully!');
});
