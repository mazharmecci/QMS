import { auth, db } from './firebase.js';
import { doc, getDoc } from 'firebase/firestore';

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  try {
    const userDoc = await getDoc(doc(db, 'users', user.displayName || user.uid));
    const data = userDoc.data();

    if (data.role !== 'manager') {
      // Redirect employees based on permissions
      if (data.permissions.includes('task-manager') && data.permissions.includes('service-form')) {
        window.location.href = 'workflow-selector.html';
      } else if (data.permissions.includes('task-manager')) {
        window.location.href = 'http://task.istosmedical.com/index.html';
      } else if (data.permissions.includes('service-form')) {
        window.location.href = 'https://qms.istosmedical.com/forms/service-form.html';
      } else {
        window.location.href = 'unauthorized.html';
      }
    }

    // Manager is allowed to stay on index.html
  } catch (err) {
    console.error('Access check failed:', err);
    window.location.href = 'unauthorized.html';
  }
});
