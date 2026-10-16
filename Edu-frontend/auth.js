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