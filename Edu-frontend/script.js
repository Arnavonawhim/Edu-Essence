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

  // dialect chip selection
  document.querySelectorAll('[data-chip]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-chip]').forEach(c => {
        c.classList.remove('bg-beam', 'text-slate');
        c.classList.add('border', 'border-beam/30');
      });
      chip.classList.add('bg-beam', 'text-slate');
      chip.classList.remove('border', 'border-beam/30');
    });
  });

  // online/offline mode switch
  const toggle = document.getElementById('mode-toggle');
  const dot = document.getElementById('switch-dot');
  const track = document.getElementById('switch-track');
  let online = false;
  toggle.addEventListener('click', () => {
    online = !online;
    toggle.setAttribute('aria-pressed', String(online));
    dot.style.transform = online ? 'translateX(20px)' : 'translateX(0)';
    track.style.backgroundColor = online ? '#1F2421' : 'rgba(255,248,211,0.2)';
    track.style.boxShadow = online ? 'inset 0 0 0 1px rgba(255,248,211,0.4)' : 'none';
  });
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
    window.location.href = '../login%20page/login.html';
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
    window.location.href = '../login%20page/login.html';
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
    window.location.href = '../login page/login.html';
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

  updateAuthButton();
});
// Real-Time Translator Click Popup Logic
document.addEventListener('DOMContentLoaded', () => {
  const translatorBtn = document.getElementById('translatorBtn');
  const translatorPopup = document.getElementById('translatorPopup');
  const translatorChevron = document.getElementById('translatorChevron');
  const translatorWrapper = document.getElementById('translatorWrapper');

  if (translatorBtn && translatorPopup) {
    // Toggle popup visibility on click
    translatorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = translatorPopup.classList.contains('hidden');

      if (isHidden) {
        translatorPopup.classList.remove('hidden');
        if (translatorChevron) translatorChevron.style.transform = 'rotate(180deg)';
      } else {
        translatorPopup.classList.add('hidden');
        if (translatorChevron) translatorChevron.style.transform = 'rotate(0deg)';
      }
    });

    // Close popup if clicking anywhere outside the button/card
    document.addEventListener('click', (e) => {
      if (!translatorWrapper.contains(e.target)) {
        translatorPopup.classList.add('hidden');
        if (translatorChevron) translatorChevron.style.transform = 'rotate(0deg)';
      }
    });
  }
});

// Mode Selection Handler
function selectMode(mode) {
  const popup = document.getElementById('translatorPopup');
  const chevron = document.getElementById('translatorChevron');
  
  if (popup) popup.classList.add('hidden');
  if (chevron) chevron.style.transform = 'rotate(0deg)';

  // Action based on selected mode
  alert(`Selected: ${mode} Mode`);
}