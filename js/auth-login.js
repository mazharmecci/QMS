// js/auth-login.js
// Username + password login using Firestore users collection + Firebase Auth

import {
  auth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  db,
  collection,
  query,
  where,
  getDocs
} from './firebase.js';

/* ========== DOM References ========== */
const form = document.getElementById('loginForm');
const identifierEl = document.getElementById('identifier');   // Username field
const passwordEl = document.getElementById('password');
const togglePwdBtn = document.getElementById('togglePwd');
const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
const rememberMeEl = document.getElementById('rememberMe');
const authErrorEl = document.getElementById('authError');
const authInfoEl = document.getElementById('authInfo');

/* ========== Helpers ========== */
function setError(msg) {
  authErrorEl.textContent = msg;
  authErrorEl.hidden = false;
  authInfoEl.hidden = true;
}

function setInfo(msg) {
  authInfoEl.textContent = msg;
  authInfoEl.hidden = false;
  authErrorEl.hidden = true;
}

function clearMessages() {
  authErrorEl.hidden = true;
  authInfoEl.hidden = true;
}

/* ========== Password visibility ========== */
togglePwdBtn.addEventListener('click', () => {
  const currentType = passwordEl.getAttribute('type');
  const nextType = currentType === 'password' ? 'text' : 'password';
  passwordEl.setAttribute('type', nextType);
  togglePwdBtn.textContent = nextType === 'password' ? '👁' : '🙈';
});

/* ========== Username → email lookup ========== */
async function findUserByUsername(username) {
  const q = query(collection(db, 'users'), where('username', '==', username));
  const snap = await getDocs(q);

  if (snap.empty) {
    const err = new Error('auth/user-not-found');
    err.code = 'auth/user-not-found';
    throw err;
  }

  const docSnap = snap.docs[0];
  const data = docSnap.data();

  if (!data.email) {
    const err = new Error('auth/invalid-user');
    err.code = 'auth/invalid-user';
    throw err;
  }

  return {
    email: data.email,
    username: data.username || username,
    role: data.role || 'employee',
    permissions: data.permissions || [],
    id: docSnap.id
  };
}

/* ========== Auto-fill "remembered" username ========== */
onAuthStateChanged(auth, (user) => {
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

  if (!username || !password) {
    setError('Enter your username and password.');
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Signing in...';
  submitBtn.disabled = true;

  try {
    console.log('Attempting username login for:', username);

    // 1) Look up Firestore user by username
    const userMeta = await findUserByUsername(username);

    // 2) Use mapped email for Firebase Auth sign-in
    await signInWithEmailAndPassword(auth, userMeta.email, password);

    // 3) Persist profile locally
    const remember = rememberMeEl.checked;
    if (remember) {
      localStorage.setItem('qmsRememberUser', JSON.stringify({
        username: userMeta.username,
        remember: true,
        ts: Date.now()
      }));
    } else {
      localStorage.removeItem('qmsRememberUser');
    }

    localStorage.setItem('qmsCurrentUser', JSON.stringify({
      username: userMeta.username,
      role: userMeta.role,
      permissions: userMeta.permissions,
      ts: Date.now()
    }));

    // 4) Redirect based on role/permissions
    setInfo('Login successful. Redirecting...');

    if (userMeta.role === 'manager') {
      // Manager → full QMS dashboard
      window.location.href = 'index.html';
    } else if (userMeta.permissions.includes('task-manager') && userMeta.permissions.includes('service-form')) {
      // Employee like Praveen → Task + Service
      window.location.href = 'workflow-selector.html'; // optional selector page
    } else if (userMeta.permissions.includes('task-manager')) {
      // Pooja & Chaitra → Task Manager only
      window.location.href = 'http://task.istosmedical.com/index.html';
    } else if (userMeta.permissions.includes('service-form')) {
      // Service-only employee
      window.location.href = 'https://qms.istosmedical.com/forms/service-form.html';
    } else {
      // Unauthorized
      window.location.href = 'unauthorized.html';
    }

  } catch (error) {
    console.error('Login error:', error.code || error.message, error);
    const code = error.code || error.message;

    if (code === 'auth/user-not-found') {
      setError('Username not found. Contact admin if this is unexpected.');
    } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      setError('Incorrect password. Please try again.');
    } else if (code === 'auth/user-disabled') {
      setError('Account disabled. Contact admin.');
    } else if (code === 'auth/too-many-requests') {
      setError('Too many attempts. Please wait a minute and try again.');
    } else if (code === 'auth/network-request-failed') {
      setError('Network error. Check your internet connection.');
    } else if (code === 'auth/invalid-user') {
      setError('User record is misconfigured. Contact admin.');
    } else {
      setError('Login failed. Please try again.');
    }
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});

/* ========== Forgot password (by username) ========== */
forgotPasswordBtn.addEventListener('click', async () => {
  clearMessages();
  const username = identifierEl.value.trim();

  if (!username) {
    setError('Enter your username so a reset link can be sent.');
    return;
  }

  const originalText = forgotPasswordBtn.textContent;
  forgotPasswordBtn.textContent = 'Sending...';
  forgotPasswordBtn.disabled = true;

  try {
    const userMeta = await findUserByUsername(username);
    await sendPasswordResetEmail(auth, userMeta.email);
    setInfo('Password reset link sent to ' + userMeta.email + '. Check your inbox and spam folder.');
  } catch (error) {
    console.error('Password reset error:', error.code || error.message);
    const code = error.code || error.message;

    if (code === 'auth/user-not-found') {
      setError('Username not found. Contact admin.');
    } else if (code === 'auth/invalid-email') {
      setError('User email is invalid. Contact admin.');
    } else if (code === 'auth/too-many-requests') {
      setError('Too many reset attempts. Try again later.');
    } else {
      setError('Could not send reset email. Try again.');
    }
  } finally {
    forgotPasswordBtn.textContent = originalText;
    forgotPasswordBtn.disabled = false;
  }
});

/* ========== Small UX tweaks ========== */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target === identifierEl) {
    passwordEl.focus();
  }
});

/* ========== Expose for debugging ========== */
window.__qmsAuth = auth;
window.__qmsDebugFindUser = findUserByUsername;
