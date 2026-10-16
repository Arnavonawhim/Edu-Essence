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
    }

    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    updateAuthButton();
  }

  window.syncAuthButton = updateAuthButton;
  updateAuthButton();
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
}