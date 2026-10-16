/*const registerForm = document.getElementById('registerForm');
const firstNameInput = document.getElementById('firstName');
const lastNameInput = document.getElementById('lastName');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');

const togglePasswordBtn = document.getElementById('togglePassword');
const toggleConfirmPasswordBtn = document.getElementById('toggleConfirmPassword');

const firstNameError = document.getElementById('firstNameError');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const confirmPasswordError = document.getElementById('confirmPasswordError');
const registerSubmitBtn = document.getElementById('registerSubmitBtn');

// Helper to toggle password fields
function setupPasswordToggle(button, input) {
  button.addEventListener('click', () => {
    const isPassword = input.getAttribute('type') === 'password';
    input.setAttribute('type', isPassword ? 'text' : 'password');
    button.textContent = isPassword ? 'Hide' : 'Show';
  });
}

setupPasswordToggle(togglePasswordBtn, passwordInput);
setupPasswordToggle(toggleConfirmPasswordBtn, confirmPasswordInput);

// Clear errors on typing
const clearError = (input, errorEl) => {
  input.addEventListener('input', () => {
    errorEl.textContent = '';
    input.classList.remove('input-invalid');
  });
};

clearError(firstNameInput, firstNameError);
clearError(emailInput, emailError);
clearError(passwordInput, passwordError);
clearError(confirmPasswordInput, confirmPasswordError);

// Validation on submit
registerForm.addEventListener('submit', (e) => {
  e.preventDefault();

  let isValid = true;
  const firstNameVal = firstNameInput.value.trim();
  const emailVal = emailInput.value.trim();
  const passwordVal = passwordInput.value;
  const confirmPasswordVal = confirmPasswordInput.value;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // First Name validation
  if (!firstNameVal) {
    firstNameError.textContent = 'First name is required';
    firstNameInput.classList.add('input-invalid');
    isValid = false;
  }

  // Email validation
  if (!emailVal) {
    emailError.textContent = 'Email is required';
    emailInput.classList.add('input-invalid');
    isValid = false;
  } else if (!emailRegex.test(emailVal)) {
    emailError.textContent = 'Please enter a valid email address';
    emailInput.classList.add('input-invalid');
    isValid = false;
  }

  // Password validation
  if (!passwordVal) {
    passwordError.textContent = 'Password is required';
    passwordInput.classList.add('input-invalid');
    isValid = false;
  } else if (passwordVal.length < 8) {
    passwordError.textContent = 'Password must be at least 8 characters';
    passwordInput.classList.add('input-invalid');
    isValid = false;
  }

  // Confirm Password validation
  if (!confirmPasswordVal) {
    confirmPasswordError.textContent = 'Please confirm your password';
    confirmPasswordInput.classList.add('input-invalid');
    isValid = false;
  } else if (passwordVal !== confirmPasswordVal) {
    confirmPasswordError.textContent = 'Passwords do not match';
    confirmPasswordInput.classList.add('input-invalid');
    isValid = false;
  }

  if (!isValid) return;

  registerSubmitBtn.disabled = true;
  registerSubmitBtn.textContent = 'Creating account...';

  setTimeout(() => {
    alert('Account created successfully!');
    window.location.href = 'login.html';
  }, 1000);
});*/
const API_BASE_URL = 'https://edu-essence.onrender.com';

const registerForm = document.getElementById('registerForm');
const firstNameInput = document.getElementById('firstName');
const lastNameInput = document.getElementById('lastName');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');

const togglePasswordBtn = document.getElementById('togglePassword');
const toggleConfirmPasswordBtn = document.getElementById('toggleConfirmPassword');

const firstNameError = document.getElementById('firstNameError');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const confirmPasswordError = document.getElementById('confirmPasswordError');
const registerSubmitBtn = document.getElementById('registerSubmitBtn');

function setupPasswordToggle(button, input) {
  button.addEventListener('click', () => {
    const isPassword = input.getAttribute('type') === 'password';
    input.setAttribute('type', isPassword ? 'text' : 'password');
    button.textContent = isPassword ? 'Hide' : 'Show';
  });
}

setupPasswordToggle(togglePasswordBtn, passwordInput);
setupPasswordToggle(toggleConfirmPasswordBtn, confirmPasswordInput);

const clearError = (input, errorEl) => {
  input.addEventListener('input', () => {
    errorEl.textContent = '';
    input.classList.remove('input-invalid');
  });
};

clearError(firstNameInput, firstNameError);
clearError(emailInput, emailError);
clearError(passwordInput, passwordError);
clearError(confirmPasswordInput, confirmPasswordError);

// Registration API integration
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const firstNameVal = firstNameInput.value.trim();
  const lastNameVal = lastNameInput.value.trim();
  const emailVal = emailInput.value.trim();
  const passwordVal = passwordInput.value;
  const confirmPasswordVal = confirmPasswordInput.value;

  let isValid = true;

  if (!firstNameVal) {
    firstNameError.textContent = 'First name is required';
    firstNameInput.classList.add('input-invalid');
    isValid = false;
  }

  if (!emailVal) {
    emailError.textContent = 'Email is required';
    emailInput.classList.add('input-invalid');
    isValid = false;
  }

  if (!passwordVal) {
    passwordError.textContent = 'Password is required';
    passwordInput.classList.add('input-invalid');
    isValid = false;
  } else if (passwordVal.length < 8) {
    passwordError.textContent = 'Password must be at least 8 characters';
    passwordInput.classList.add('input-invalid');
    isValid = false;
  }

  if (!confirmPasswordVal) {
    confirmPasswordError.textContent = 'Please confirm your password';
    confirmPasswordInput.classList.add('input-invalid');
    isValid = false;
  } else if (passwordVal !== confirmPasswordVal) {
    confirmPasswordError.textContent = 'Passwords do not match';
    confirmPasswordInput.classList.add('input-invalid');
    isValid = false;
  }

  if (!isValid) return;

  registerSubmitBtn.disabled = true;
  registerSubmitBtn.textContent = 'Creating account...';

  // Build the DRF payload
  const payload = {
    username: emailVal.split('@')[0],
    first_name: firstNameVal,
    last_name: lastNameVal,
    email: emailVal,
    password: passwordVal,
    confirm_password: confirmPasswordVal,
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok) {
      alert('Registration successful! Redirecting to login...');
      window.location.href = 'login.html';
    } else {
      if (data.email) emailError.textContent = Array.isArray(data.email) ? data.email[0] : data.email;
      if (data.password) passwordError.textContent = Array.isArray(data.password) ? data.password[0] : data.password;
      if (data.detail) alert(data.detail);
      if (!data.email && !data.password && !data.detail) {
        alert('Registration failed. Please check your information.');
      }
    }
  } catch (err) {
    console.error('Actual Fetch Error:', err);
    alert('Server is unreachable or spinning up. If on Render free tier, wait 60s for wake-up.');
    alert('Server is unreachable. Please try again later.');
  } finally {
    registerSubmitBtn.disabled = false;
    registerSubmitBtn.textContent = 'Create Account';
  }
});