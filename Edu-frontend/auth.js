const AUTH_API_BASE_URL = 'https://edu-essence.onrender.com';

// Opening the page as a file sends `Origin: null`, which the API rejects, so the
// request never leaves the browser and looks like an unreachable server.
function networkErrorMessage(err) {
  console.error('Auth request failed:', err);
  if (window.location.protocol === 'file:') {
    return 'Open the site at http://localhost:5175 — logging in does not work from a file:// page.';
  }
  return 'Server is unreachable. On the Render free tier it may need 60s to wake up.';
}

const authModal = document.getElementById('authModal');
const loginPanel = document.getElementById('loginPanel');
const registerPanel = document.getElementById('registerPanel');

const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginEmailError = document.getElementById('loginEmailError');
const loginPasswordError = document.getElementById('loginPasswordError');
const loginNote = document.getElementById('loginNote');
const loginSubmitBtn = document.getElementById('loginSubmitBtn');

const registerForm = document.getElementById('registerForm');
const regFirstName = document.getElementById('regFirstName');
const regLastName = document.getElementById('regLastName');
const regEmail = document.getElementById('regEmail');
const regRole = document.getElementById('regRole');
const regPassword = document.getElementById('regPassword');
const regConfirmPassword = document.getElementById('regConfirmPassword');
const regFirstNameError = document.getElementById('regFirstNameError');
const regEmailError = document.getElementById('regEmailError');
const regPasswordError = document.getElementById('regPasswordError');
const regConfirmPasswordError = document.getElementById('regConfirmPasswordError');
const registerNote = document.getElementById('registerNote');
const registerSubmitBtn = document.getElementById('registerSubmitBtn');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setupPasswordToggle(buttonId, input) {
  const button = document.getElementById(buttonId);
  if (!button || !input) return;

  button.addEventListener('click', () => {
    const hidden = input.getAttribute('type') === 'password';
    input.setAttribute('type', hidden ? 'text' : 'password');
    button.textContent = hidden ? 'Hide' : 'Show';
  });
}

function clearOnInput(input, errorEl) {
  if (!input || !errorEl) return;

  input.addEventListener('input', () => {
    errorEl.textContent = '';
    input.classList.remove('input-invalid');
  });
}

function showError(input, errorEl, message) {
  errorEl.textContent = message;
  input.classList.add('input-invalid');
}

function setNote(element, message, isSuccess) {
  element.textContent = message;
  element.classList.toggle('is-success', Boolean(isSuccess));
}

function resetForm(form, panel) {
  form.reset();
  panel.querySelectorAll('.field-error').forEach((node) => {
    node.textContent = '';
  });
  panel.querySelectorAll('.input-invalid').forEach((node) => {
    node.classList.remove('input-invalid');
  });
  panel.querySelectorAll('.form-note').forEach((node) => {
    setNote(node, '', false);
  });
}

function showPanel(name) {
  const wantsRegister = name === 'register';
  loginPanel.hidden = wantsRegister;
  registerPanel.hidden = !wantsRegister;

  const activeInput = wantsRegister ? regFirstName : loginEmail;
  window.requestAnimationFrame(() => activeInput.focus());
}

function openAuthModal(panel) {
  resetForm(loginForm, loginPanel);
  resetForm(registerForm, registerPanel);
  showPanel(panel || 'login');

  authModal.hidden = false;
  document.body.style.overflow = 'hidden';
  window.requestAnimationFrame(() => authModal.classList.add('is-open'));
}

function closeAuthModal() {
  authModal.classList.remove('is-open');
  document.body.style.overflow = '';

  window.setTimeout(() => {
    authModal.hidden = true;
  }, 250);
}

function storeSession(data) {
  const tokens = data.tokens || {};
  localStorage.setItem('access_token', tokens.access || '');
  localStorage.setItem('refresh_token', tokens.refresh || '');
  localStorage.setItem('isLoggedIn', 'true');

  if (data.user) {
    localStorage.setItem('user_role', data.user.role || 'student');
    localStorage.setItem('user_name', data.user.full_name || data.user.username || '');
  }

  window.syncAuthButton?.();
}

function firstMessage(value) {
  return Array.isArray(value) ? value[0] : value;
}

setupPasswordToggle('loginTogglePassword', loginPassword);
setupPasswordToggle('regTogglePassword', regPassword);
setupPasswordToggle('regToggleConfirmPassword', regConfirmPassword);

clearOnInput(loginEmail, loginEmailError);
clearOnInput(loginPassword, loginPasswordError);
clearOnInput(regFirstName, regFirstNameError);
clearOnInput(regEmail, regEmailError);
clearOnInput(regPassword, regPasswordError);
clearOnInput(regConfirmPassword, regConfirmPasswordError);

document.getElementById('authCloseBtn').addEventListener('click', closeAuthModal);
document.getElementById('goToRegister').addEventListener('click', () => showPanel('register'));
document.getElementById('goToLogin').addEventListener('click', () => showPanel('login'));

authModal.addEventListener('click', (event) => {
  if (event.target === authModal) closeAuthModal();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !authModal.hidden) closeAuthModal();
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  let isValid = true;

  setNote(loginNote, '', false);

  if (!email) {
    showError(loginEmail, loginEmailError, 'Email is required');
    isValid = false;
  }

  if (!password) {
    showError(loginPassword, loginPasswordError, 'Password is required');
    isValid = false;
  }

  if (!isValid) return;

  loginSubmitBtn.disabled = true;
  loginSubmitBtn.textContent = 'Logging in...';

  try {
    const response = await fetch(`${AUTH_API_BASE_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      storeSession(data);
      closeAuthModal();
    } else {
      const message =
        firstMessage(data.detail) ||
        firstMessage(data.non_field_errors) ||
        'Invalid email or password.';
      showError(loginPassword, loginPasswordError, message);
    }
  } catch (err) {
    setNote(loginNote, networkErrorMessage(err), false);
  } finally {
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.textContent = 'Login';
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const firstName = regFirstName.value.trim();
  const lastName = regLastName.value.trim();
  const email = regEmail.value.trim();
  const password = regPassword.value;
  const confirmPassword = regConfirmPassword.value;
  let isValid = true;

  setNote(registerNote, '', false);

  if (!firstName) {
    showError(regFirstName, regFirstNameError, 'First name is required');
    isValid = false;
  }

  if (!email) {
    showError(regEmail, regEmailError, 'Email is required');
    isValid = false;
  } else if (!EMAIL_PATTERN.test(email)) {
    showError(regEmail, regEmailError, 'Enter a valid email address');
    isValid = false;
  }

  if (!password) {
    showError(regPassword, regPasswordError, 'Password is required');
    isValid = false;
  } else if (password.length < 8) {
    showError(regPassword, regPasswordError, 'Password must be at least 8 characters');
    isValid = false;
  }

  if (!confirmPassword) {
    showError(regConfirmPassword, regConfirmPasswordError, 'Please confirm your password');
    isValid = false;
  } else if (password !== confirmPassword) {
    showError(regConfirmPassword, regConfirmPasswordError, 'Passwords do not match');
    isValid = false;
  }

  if (!isValid) return;

  registerSubmitBtn.disabled = true;
  registerSubmitBtn.textContent = 'Creating account...';

  const payload = {
    username: email.split('@')[0],
    first_name: firstName,
    last_name: lastName,
    email,
    role: regRole.value,
    password,
    confirm_password: confirmPassword,
  };

  try {
    const response = await fetch(`${AUTH_API_BASE_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok) {
      storeSession(data);
      closeAuthModal();
    } else {
      if (data.email) showError(regEmail, regEmailError, firstMessage(data.email));
      if (data.password) showError(regPassword, regPasswordError, firstMessage(data.password));
      if (data.confirm_password) {
        showError(regConfirmPassword, regConfirmPasswordError, firstMessage(data.confirm_password));
      }
      if (data.first_name) showError(regFirstName, regFirstNameError, firstMessage(data.first_name));
      if (data.username && !data.email) {
        showError(regEmail, regEmailError, firstMessage(data.username));
      }
      if (data.detail) setNote(registerNote, firstMessage(data.detail), false);
    }
  } catch (err) {
    setNote(registerNote, networkErrorMessage(err), false);
  } finally {
    registerSubmitBtn.disabled = false;
    registerSubmitBtn.textContent = 'Create Account';
  }
});

window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
