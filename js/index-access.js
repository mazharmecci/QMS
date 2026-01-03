// index-access.js (QMS) – gate index.html based on role/permissions

import {
  auth,
  db,
  doc,
  getDoc,
  onAuthStateChanged
} from './firebase.js';

// NOTE: this runs on qms.istosmedical.com, not on task.istosmedical.com
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  try {
    const profileRef = doc(db, 'users', user.displayName || user.uid);
    const userDoc = await getDoc(profileRef);

    if (!userDoc.exists()) {
      console.error('User profile not found for', user.uid);
      window.location.href = 'unauthorized.html';
      return;
    }

    const data = userDoc.data();

    if (data.role !== 'manager') {
      const perms = data.permissions || [];

      if (perms.includes('task-manager') && perms.includes('service-form')) {
        window.location.href = 'workflow-selector.html';
      } else if (perms.includes('task-manager')) {
        window.location.href = 'http://task.istosmedical.com/index.html';
      } else if (perms.includes('service-form')) {
        window.location.href = 'https://qms.istosmedical.com/forms/service-form.html';
      } else {
        window.location.href = 'unauthorized.html';
      }
      return;
    }

    // Manager is allowed to stay on index.html
  } catch (err) {
    console.error('Access check failed:', err);
    window.location.href = 'unauthorized.html';
  }
});
