// js/auth-login.js - Complete Firebase v11 Auth for ISTOS QMS (uses your firebase.js)
import { 
  auth,
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  onAuthStateChanged 
} from './firebase.js';

// DOM elements
const form = document.getElementById('loginForm');
const identifierEl = document.getElementById('identifier');
const passwordEl = document.getElementById('password');
const togglePwdBtn = document.getElementById('togglePwd');
const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
const rememberMeEl = document.getElementById('rememberMe');
const authErrorEl = document.getElementById('authError');
const authInfoEl = document.getElementById('authInfo');

// Utility functions
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

// Password visibility toggle
togglePwdBtn.addEventListener('click', () => {
  const type = passwordEl.getAttribute('type') === 'password' ? 'text' : 'password';
  passwordEl.setAttribute('type', type);
  togglePwdBtn.textContent = type === 'password' ? '👁' : '🙈';
});

// Check auth state and auto-redirect if logged in
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Load remember me if set
    const savedCreds = localStorage.getItem('qmsRemember');
    if (savedCreds) {
      try {
        const { identifier, remember } = JSON.parse(savedCreds);
        if (remember) {
          identifierEl.value = identifier;
          rememberMeEl.checked = true;
        }
      } catch (e) {
        localStorage.removeItem('qmsRemember');
      }
    }
    window.location.href = 'index.html'; // Redirect to QMS dashboard
  }
});

// Login form submit
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();

  const email = identifierEl.value.trim().toLowerCase();
  const password = passwordEl.value;
  const remember = rememberMeEl.checked;

  if (!email || !password) {
    setError('Enter your email and password.');
    return;
  }

  // Save remember me preference
  if (remember) {
    localStorage.setItem('qmsRemember', JSON.stringify({ 
      identifier: email, 
      remember: true,
      timestamp: Date.now()
    }));
  } else {
    localStorage.removeItem('qmsRemember');
  }

  // Disable submit during request
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Signing in...';
  submitBtn.disabled = true;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged handles redirect
  } catch (error) {
    console.error('Login error:', error.code, error.message);
    switch (error.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        setError('Invalid email or password.');
        break;
      case 'auth/invalid-credential':
      case 'auth/invalid-email':
        setError('Invalid email or credentials.');
        break;
      case 'auth/user-disabled':
        setError('Account disabled. Contact support.');
        break;
      case 'auth/too-many-requests':
        setError('Too many failed attempts. Try again in 60s.');
        break;
      case 'auth/network-request-failed':
        setError('Network error. Check your connection.');
        break;
      default:
        setError('Login failed. Please try again.');
    }
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});

// Forgot password
forgotPasswordBtn.addEventListener('click', async () => {
  clearMessages();
  const email = identifierEl.value.trim().toLowerCase();
  
  if (!email) {
    setError('Enter your email first to receive a reset link.');
    return;
  }

  // Disable during request
  const originalText = forgotPasswordBtn.textContent;
  forgotPasswordBtn.textContent = 'Sending...';
  forgotPasswordBtn.disabled = true;

  try {
    await sendPasswordResetEmail(auth, email);
    setInfo('Password reset link sent to ' + email + '. Check your inbox (and spam).');
  } catch (error) {
    console.error('Reset error:', error.code);
    switch (error.code) {
      case 'auth/user-not-found':
        setError('No account found with that email.');
        break;
      case 'auth/invalid-email':
        setError('Invalid email format.');
        break;
      case 'auth/too-many-requests':
        setError('Too many requests. Try again later.');
        break;
      default:
        setError('Could not send reset email. Try again.');
    }
  } finally {
    forgotPasswordBtn.textContent = originalText;
    forgotPasswordBtn.disabled = false;
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target === identifierEl) {
    passwordEl.focus();
  }
});

// Expose globally for debugging/other pages
window.__qmsAuth = auth;
window.__qmsDebugLogin = async (email, password) => {
  console.log('Debug login:', email);
  await signInWithEmailAndPassword(auth, email, password);
};
