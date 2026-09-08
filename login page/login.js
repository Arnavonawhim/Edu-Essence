const API_BASE_URL = 'https://edu-essence.onrender.com';

const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('togglePassword');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const submitBtn = document.getElementById('submitBtn');

// Password visibility toggle
togglePasswordBtn.addEventListener('click', () => {
  const isPassword = passwordInput.getAttribute('type') === 'password';
  passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
  togglePasswordBtn.textContent = isPassword ? 'Hide' : 'Show';
});

// Clear validation messages on typing
emailInput.addEventListener('input', () => {
  emailError.textContent = '';
  emailInput.classList.remove('input-invalid');
});

passwordInput.addEventListener('input', () => {
  passwordError.textContent = '';
  passwordInput.classList.remove('input-invalid');
});

// Login API integration
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const emailValue = emailInput.value.trim();
  const passwordValue = passwordInput.value;

  let isValid = true;
  if (!emailValue) {
    emailError.textContent = 'Email is required';
    emailInput.classList.add('input-invalid');
    isValid = false;
  }

  if (!passwordValue) {
    passwordError.textContent = 'Password is required';
    passwordInput.classList.add('input-invalid');
    isValid = false;
  }

  if (!isValid) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging in...';

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: emailValue,
        password: passwordValue,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      // Store JWT tokens & login state
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      localStorage.setItem('isLoggedIn', 'true');

      // Navigate back to homepage
      window.location.href = '../Edu-frontend/index.html';
    } else {
      const errorMsg = data.detail || data.non_field_errors?.[0] || 'Invalid email or password.';
      passwordError.textContent = errorMsg;
      passwordInput.classList.add('input-invalid');
    }
  } catch (err) {
    passwordError.textContent = 'Server is unreachable. Please try again.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Login';
  }
});