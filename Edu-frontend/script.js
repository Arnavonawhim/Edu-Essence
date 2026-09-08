// header background on scroll
  const header = document.getElementById('site-header');
  const onScroll = () => {
    if (window.scrollY > 20) {
      header.classList.add('bg-cream/90', 'backdrop-blur-md', 'shadow-[0_1px_0_rgba(31,36,33,0.08)]');
    } else {
      header.classList.remove('bg-cream/90', 'backdrop-blur-md', 'shadow-[0_1px_0_rgba(31,36,33,0.08)]');
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // mobile menu
  const menuBtn = document.getElementById('menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const iconOpen = document.getElementById('menu-icon-open');
  const iconClose = document.getElementById('menu-icon-close');
  menuBtn.addEventListener('click', () => {
    const isOpen = !mobileMenu.classList.contains('hidden');
    mobileMenu.classList.toggle('hidden');
    iconOpen.classList.toggle('hidden');
    iconClose.classList.toggle('hidden');
    menuBtn.setAttribute('aria-expanded', String(!isOpen));
  });
  mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    mobileMenu.classList.add('hidden');
    iconOpen.classList.remove('hidden');
    iconClose.classList.add('hidden');
  }));

  // Auth Toggle Button Handler
 authNavBtn = document.getElementById('authNavBtn');

if (authNavBtn) {
  function updateAuthButton() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

    if (isLoggedIn) {
      authNavBtn.textContent = 'Logout';
      authNavBtn.onclick = handleLogout;
    } else {
      authNavBtn.textContent = 'Login';
      authNavBtn.onclick = handleLogin;
    }
  }

  function handleLogin() {
    window.openAuthModal?.('login');
  }

  function handleLogout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    updateAuthButton();
  }

  // Check state when page loads
  updateAuthButton();
}
// Authentication Button Toggle & Logout Logic
/*const API_BASE_URL = 'https://edu-essence.onrender.com';
const authNavBtn = document.getElementById('authNavBtn');

if (authNavBtn) {
  function updateAuthButton() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

    if (isLoggedIn) {
      authNavBtn.textContent = 'Logout';
      authNavBtn.onclick = handleLogout;
    } else {
      authNavBtn.textContent = 'Login';
      authNavBtn.onclick = handleLogin;
    }
  }

  function handleLogin() {
    window.openAuthModal?.('login');
  }

  async function handleLogout() {
    const refreshToken = localStorage.getItem('refresh_token');

    // Notify backend to blacklist the token
    if (refreshToken) {
      try {
        await fetch(`${API_BASE_URL}/api/auth/logout/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh: refreshToken }),
        });
      } catch (err) {
        // Continue clearing local storage if network request fails
      }
    }

    // Clear saved session
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');

    // Update UI immediately
    updateAuthButton();
  }

  // Check state on page load
  updateAuthButton();
}*/
document.addEventListener('DOMContentLoaded', () => {
  const authNavBtn = document.getElementById('authNavBtn');

  if (!authNavBtn) {
    console.warn('authNavBtn not found on page');
    return;
  }

  function updateAuthButton() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

    if (isLoggedIn) {
      authNavBtn.textContent = 'Logout';
      authNavBtn.onclick = handleLogout;
    } else {
      authNavBtn.textContent = 'Login';
      authNavBtn.onclick = handleLogin;
    }
  }

  function handleLogin() {
    window.openAuthModal?.('login');
  }

  async function handleLogout() {
    const refreshToken = localStorage.getItem('refresh_token');

    if (refreshToken) {
      try {
        await fetch('https://edu-essence.onrender.com/api/auth/logout/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh: refreshToken }),
        });
      } catch (err) {
        // Continue clearing session even if logout API is unreachable
      }
    }

    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');

    updateAuthButton();
  }

  window.syncAuthButton = updateAuthButton;
  updateAuthButton();
});