<<<<<<< HEAD
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
=======
/**
 * EduEssence Unified Script
 * Handles Backend Routing, Dynamic Authentication Buttons, 3D Teacher Link,
 * Real-Time Translator Modes, and Canvas Micro-Interactions.
 */

/* ==========================================================================
   1. Backend & Environment Configuration
   ========================================================================== */
const IS_LOCAL = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

/* Offline mode — the real-time translator[cite: 1] */
const TRANSLATOR_URL = IS_LOCAL
  ? 'http://localhost:5173/'
  : 'https://edu-essencee.vercel.app/';

/* Online mode — the LiveKit classroom[cite: 1] */
const CLASSROOM_URL = IS_LOCAL
  ? 'http://localhost:5175/app/'
  : 'https://edu-essence2.vercel.app/';

/* ==========================================================================
   2. Navigation & Redirection Logic
   ========================================================================== */

/**
 * Real-Time Translator: Offline Mode
 */
function goToOfflineMode() {
  const token = localStorage.getItem('access_token');
  const targetUrl = token 
    ? `${TRANSLATOR_URL}?token=${encodeURIComponent(token)}` 
    : TRANSLATOR_URL;
  window.location.href = targetUrl;
}

/**
 * Real-Time Translator: Online LiveKit Mode
 */
function goToOnlineMode() {
  const token = localStorage.getItem('access_token');
  const targetUrl = token 
    ? `${CLASSROOM_URL}?token=${encodeURIComponent(token)}` 
    : CLASSROOM_URL;
  window.location.href = targetUrl;
}

/**
 * 3D Teacher Direct Redirection
 */
function goToTutor() {
  const token = localStorage.getItem('access_token');
  window.location.href = token
    ? `tutor.html?token=${encodeURIComponent(token)}`
    : 'tutor.html';
}

/* ==========================================================================
   3. Initialization & Event Handlers
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initAuthNavButton();
  initTutorLinks();
  initVernacularPills();
  initSpeechBubbleInteractions();
  initChalkboardTicker();
});

/**
 * Navbar Login / Logout Button Synchronizer
 */
function initAuthNavButton() {
  const authNavBtn = document.getElementById('authNavBtn');
  if (!authNavBtn) return;

>>>>>>> origin/test
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
<<<<<<< HEAD
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
/*document.addEventListener('DOMContentLoaded', () => {
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
=======
    if (typeof window.openAuthModal === 'function') {
      window.openAuthModal('login');
    } else {
      const modal = document.getElementById('authModal');
      if (modal) modal.hidden = false;
    }
  }

  function handleLogout() {
    const proceed = confirm('Would you like to log out of EduEssence?');
    if (!proceed) return;

    const refreshToken = localStorage.getItem('refresh_token');

    if (refreshToken) {
      fetch('https://edu-essence.onrender.com/api/auth/logout/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken }),
      }).catch(() => {});
>>>>>>> origin/test
    }

    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
<<<<<<< HEAD

=======
>>>>>>> origin/test
    updateAuthButton();
  }

  window.syncAuthButton = updateAuthButton;
  updateAuthButton();
<<<<<<< HEAD
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
*/
// Real-Time Translator Click Popup Logic
document.addEventListener('DOMContentLoaded', () => {
  const translatorBtn = document.getElementById('translatorBtn');
  const translatorPopup = document.getElementById('translatorPopup');
  const translatorChevron = document.getElementById('translatorChevron');
  const translatorWrapper = document.getElementById('translatorWrapper');

  if (translatorBtn && translatorPopup) {
    translatorBtn.addEventListener('click', (e) => {
      e.preventDefault(); // Prevents <a> tag jumps and smooth-scrolling triggers
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

    document.addEventListener('click', (e) => {
      if (translatorWrapper && !translatorWrapper.contains(e.target)) {
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

  if (mode === 'offline') {
    // Redirect directly to your running React App server
    window.location.href = 'http://localhost:5173/';
  } else if (mode === 'online') {
    console.log('Online Mode selected');
  }
}
function goToOfflineMode() {
  const token = localStorage.getItem('access_token');
  const targetUrl = token 
    ? `http://localhost:5175/?token=${encodeURIComponent(token)}` 
    : 'http://localhost:5175/';
  window.location.href = targetUrl;
=======
}

/**
 * Connect 3D Teacher Buttons and Contextual Links
 */
function initTutorLinks() {
  const teacherBtn = document.getElementById('teacherBtn');
  if (teacherBtn) {
    teacherBtn.addEventListener('click', goToTutor);
  }

  const tutorLinks = document.querySelectorAll('[data-tutor-link]');
  tutorLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      goToTutor();
    });
  });
}

/**
 * Vernacular pills playful micro-interaction
 */
function initVernacularPills() {
  const pills = document.querySelectorAll('.vernacular-pill');
  pills.forEach((pill) => {
    pill.addEventListener('click', () => {
      pill.classList.add('scale-110');
      setTimeout(() => {
        pill.classList.remove('scale-110');
      }, 250);
    });
  });
}

/**
 * Speech Bubble interaction
 */
function initSpeechBubbleInteractions() {
  const bubble = document.getElementById('speechBubble');
  if (!bubble) return;

  bubble.addEventListener('click', () => {
    bubble.classList.add('ring-2', 'ring-emerald-400', 'ring-offset-2');
    setTimeout(() => {
      bubble.classList.remove('ring-2', 'ring-emerald-400', 'ring-offset-2');
    }, 600);
  });
}

/**
 * Multilingual Blackboard cycling animation (Slide 2)
 */
function initChalkboardTicker() {
  const board = document.getElementById('chalkBoardText');
  if (!board) return;

  const phrases = [
    "नमस्ते बच्चों! चलो सीखें 🌱",
    "வணக்கம் மாணவர்களே! 📖",
    "Let's explore together! ✨",
    "নমস্কার বন্ধুরা! 🚀"
  ];

  let phraseIndex = 0;

  setInterval(() => {
    board.style.opacity = '0';
    board.style.transform = 'scale(0.95)';

    setTimeout(() => {
      phraseIndex = (phraseIndex + 1) % phrases.length;
      board.textContent = phrases[phraseIndex];
      board.style.opacity = '1';
      board.style.transform = 'scale(1)';
    }, 400);
  }, 3200);
>>>>>>> origin/test
}