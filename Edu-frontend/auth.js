<<<<<<< HEAD
const AUTH_API_BASE_URL = 'https://edu-essence.onrender.com';

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

/*function storeSession(data) {
  // Handles both nested { tokens: { access, refresh } } and flat { access, refresh } responses
  const accessToken = data.tokens?.access || data.access || data.token || '';
  const refreshToken = data.tokens?.refresh || data.refresh || '';

  if (accessToken) {
    localStorage.setItem('access_token', accessToken);
  }
  if (refreshToken) {
    localStorage.setItem('refresh_token', refreshToken);
  }
  localStorage.setItem('isLoggedIn', 'true');

  const userData = data.user || data;
  if (userData.role || userData.full_name || userData.username) {
    localStorage.setItem('user_role', userData.role || 'student');
    localStorage.setItem('user_name', userData.full_name || userData.username || '');
  }

  window.syncAuthButton?.();
}
*/
function storeSession(data) {
  // Handles both nested { tokens: { access, refresh } } and flat { access, refresh } responses
  const accessToken = data.tokens?.access || data.access || data.token || '';
  const refreshToken = data.tokens?.refresh || data.refresh || '';

  if (accessToken) {
    localStorage.setItem('access_token', accessToken);
  }
  if (refreshToken) {
    localStorage.setItem('refresh_token', refreshToken);
  }
  localStorage.setItem('isLoggedIn', 'true');

  const userData = data.user || data;
  if (userData.role || userData.full_name || userData.username) {
    localStorage.setItem('user_role', userData.role || 'student');
    localStorage.setItem('user_name', userData.full_name || userData.username || '');
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
      const accessToken = data.tokens?.access || data.access || data.token || '';
      window.location.href = `http://localhost:5175/?token=${accessToken}`;
    } else {
      const message =
        firstMessage(data.detail) ||
        firstMessage(data.non_field_errors) ||
        'Invalid email or password.';
      showError(loginPassword, loginPasswordError, message);
    }
  } catch (err) {
    setNote(loginNote, 'Server is unreachable. On the Render free tier it may need 60s to wake up.', false);
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
    setNote(registerNote, 'Server is unreachable. On the Render free tier it may need 60s to wake up.', false);
  } finally {
    registerSubmitBtn.disabled = false;
    registerSubmitBtn.textContent = 'Create Account';
  }
});

window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
=======
/**
 * EduEssence Authentication Controller
 * Handles Login, Registration, JWT Sessions, and Panel Toggling.
 */

const API_BASE_URL = 'https://edu-essence.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('authModal');
  const closeBtn = document.getElementById('authCloseBtn');
  const loginPanel = document.getElementById('loginPanel');
  const registerPanel = document.getElementById('registerPanel');
  const goToRegister = document.getElementById('goToRegister');
  const goToLogin = document.getElementById('goToLogin');

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  const loginTogglePassword = document.getElementById('loginTogglePassword');
  const regTogglePassword = document.getElementById('regTogglePassword');
  const regToggleConfirmPassword = document.getElementById('regToggleConfirmPassword');

  // Open modal
  window.openAuthModal = function (panel = 'login') {
    if (!modal) return;
    modal.hidden = false;
    if (panel === 'register') {
      showRegister();
    } else {
      showLogin();
    }
  };

  // Close modal
  function closeModal() {
    if (modal) modal.hidden = true;
    clearErrors();
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Panel Switches
  function showLogin() {
    if (loginPanel) loginPanel.hidden = false;
    if (registerPanel) registerPanel.hidden = true;
    clearErrors();
  }

  function showRegister() {
    if (loginPanel) loginPanel.hidden = true;
    if (registerPanel) registerPanel.hidden = false;
    clearErrors();
  }

  if (goToRegister) goToRegister.addEventListener('click', showRegister);
  if (goToLogin) goToLogin.addEventListener('click', showLogin);

  // Password Toggles
  function setupPasswordToggle(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (btn && input) {
      btn.addEventListener('click', () => {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.textContent = isPassword ? 'Hide' : 'Show';
      });
    }
  }

  setupPasswordToggle('loginTogglePassword', 'loginPassword');
  setupPasswordToggle('regTogglePassword', 'regPassword');
  setupPasswordToggle('regToggleConfirmPassword', 'regConfirmPassword');

  function clearErrors() {
    document.querySelectorAll('.field-error').forEach((el) => (el.textContent = ''));
    const loginNote = document.getElementById('loginNote');
    const registerNote = document.getElementById('registerNote');
    if (loginNote) {
      loginNote.textContent = '';
      loginNote.className = 'form-note';
    }
    if (registerNote) {
      registerNote.textContent = '';
      registerNote.className = 'form-note';
    }
  }

  // Handle Login Submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const note = document.getElementById('loginNote');
      const submitBtn = document.getElementById('loginSubmitBtn');

      if (!email || !password) {
        if (note) {
          note.textContent = 'Please provide both email and password.';
          note.className = 'form-note error';
        }
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';

      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/login/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (res.ok) {
          localStorage.setItem('isLoggedIn', 'true');
          if (data.access) localStorage.setItem('access_token', data.access);
          if (data.refresh) localStorage.setItem('refresh_token', data.refresh);

          if (note) {
            note.textContent = 'Login successful!';
            note.className = 'form-note success';
          }

          setTimeout(() => {
            closeModal();
            if (typeof window.syncAuthButton === 'function') {
              window.syncAuthButton();
            }
          }, 600);
        } else {
          if (note) {
            note.textContent = data.detail || 'Invalid email or password.';
            note.className = 'form-note error';
          }
        }
      } catch (err) {
        if (note) {
          note.textContent = 'Unable to reach the server. Please try again.';
          note.className = 'form-note error';
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Login';
      }
    });
  }

  // Handle Registration Submission
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      const firstName = document.getElementById('regFirstName').value.trim();
      const lastName = document.getElementById('regLastName').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const role = document.getElementById('regRole').value;
      const password = document.getElementById('regPassword').value;
      const confirmPassword = document.getElementById('regConfirmPassword').value;

      const note = document.getElementById('registerNote');
      const submitBtn = document.getElementById('registerSubmitBtn');

      if (password !== confirmPassword) {
        const confirmErr = document.getElementById('regConfirmPasswordError');
        if (confirmErr) confirmErr.textContent = 'Passwords do not match.';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account...';

      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/register/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            email,
            role,
            password,
          }),
        });

        const data = await res.json();

        if (res.ok) {
          if (note) {
            note.textContent = 'Account created successfully! You can now log in.';
            note.className = 'form-note success';
          }
          setTimeout(() => showLogin(), 1000);
        } else {
          if (note) {
            note.textContent = data.detail || 'Registration failed. Check your information.';
            note.className = 'form-note error';
          }
        }
      } catch (err) {
        if (note) {
          note.textContent = 'Unable to reach the server. Please try again.';
          note.className = 'form-note error';
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
      }
    });
  }
});
>>>>>>> origin/test
