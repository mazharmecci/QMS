import {
  auth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  db,
  collection,
  query,
  where,
  getDocs
} from './firebase.js';

/* ========== Username → email lookup ========== */
async function findUserByUsername(username) {
  const q = query(collection(db, 'users'), where('username', '==', username));
  const snap = await getDocs(q);
  if (snap.empty) throw Object.assign(new Error('auth/user-not-found'), { code: 'auth/user-not-found' });

  const docSnap = snap.docs[0];
  const data = docSnap.data();
  if (!data.email) throw Object.assign(new Error('auth/invalid-user'), { code: 'auth/invalid-user' });

  return {
    uid: docSnap.id, // Firestore doc ID
    email: data.email,
    username: data.username || username,
    role: data.role || 'employee',
    permissions: data.permissions || []
  };
}

/* ========== Auto-fill remembered username ========== */
document.addEventListener('DOMContentLoaded', () => {
  const remembered = localStorage.getItem('qmsRememberUser');
  if (remembered) {
    try {
      const data = JSON.parse(remembered);
      if (data.username) {
        identifierEl.value = data.username;
        rememberMeEl.checked = !!data.remember;
      }
    } catch {
      localStorage.removeItem('qmsRememberUser');
    }
  }
});

/* ========== Submit: username + password login ========== */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();

  const username = identifierEl.value.trim();
  const password = passwordEl.value;
  if (!username || !password) return setError('Enter your username and password.');

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Signing in...';
  submitBtn.disabled = true;

  try {
    const userMeta = await findUserByUsername(username);

    // Persistence based on "Remember Me"
    const persistence = rememberMeEl.checked ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistence);

    // Firebase Auth login
    await signInWithEmailAndPassword(auth, userMeta.email, password);

    // Persist profile locally
    if (rememberMeEl.checked) {
      localStorage.setItem('qmsRememberUser', JSON.stringify({ username: userMeta.username, remember: true, ts: Date.now() }));
    } else {
      localStorage.removeItem('qmsRememberUser');
    }

    localStorage.setItem('qmsCurrentUser', JSON.stringify({
      username: userMeta.username,
      role: userMeta.role,
      permissions: userMeta.permissions,
      ts: Date.now()
    }));

    setInfo('Login successful. Redirecting...');

    // ✅ Redirect only after auth state confirms user
    onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('Firebase user logged in:', user.uid);

        if (userMeta.role === 'manager') {
          window.location.href = 'index.html';
        } else if (userMeta.permissions.includes('task-manager') && userMeta.permissions.includes('service-form')) {
          window.location.href = 'workflow-selector.html';
        } else if (userMeta.permissions.includes('task-manager')) {
          window.location.href = 'http://task.istosmedical.com/index.html';
        } else if (userMeta.permissions.includes('service-form')) {
          window.location.href = 'https://qms.istosmedical.com/forms/service-form.html';
        } else {
          window.location.href = 'unauthorized.html';
        }
      } else {
        console.error('Auth state listener fired with no user after login');
        setError('Login failed to persist. Please try again.');
      }
    });

  } catch (error) {
    console.error('Login error:', error.code || error.message, error);
    const code = error.code || error.message;
    if (code === 'auth/user-not-found') setError('Username not found. Contact admin.');
    else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') setError('Incorrect password. Please try again.');
    else if (code === 'auth/user-disabled') setError('Account disabled. Contact admin.');
    else if (code === 'auth/too-many-requests') setError('Too many attempts. Please wait a minute and try again.');
    else if (code === 'auth/network-request-failed') setError('Network error. Check your internet connection.');
    else if (code === 'auth/invalid-user') setError('User record is misconfigured. Contact admin.');
    else setError('Login failed. Please try again.');
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});

/* ========== Auth state listener (for dashboards) ========== */
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('Firebase user logged in (global listener):', user.uid);
  } else {
    console.log('No Firebase user logged in (global listener)');
  }
});
