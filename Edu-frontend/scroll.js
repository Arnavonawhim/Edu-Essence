/* ==========================================================================
   EduEssence — Smooth Scroll & Pin Slideshow Controller
   ========================================================================== */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let lenis = null;

// Initialize Lenis Smooth Scroll
function initLenis() {
  if (reduceMotion || typeof Lenis === 'undefined') return;

  lenis = new Lenis({
    duration: 1.0,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    touchMultiplier: 1.4,
    smoothWheel: true,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
}

// Pinned Slideshow Controller
function initPinnedSlideshow() {
  const track = document.getElementById('page2');
  if (!track) return;

  const spacer = track.querySelector('.pin-spacer');
  const panels = [...track.querySelectorAll('.slide-panel')];
  const tabs = [...track.querySelectorAll('.slide-tab')];
  const progressBar = track.querySelector('.slide-progress-bar');
  const numSlides = panels.length;

  if (!spacer || numSlides === 0) return;

  // Multiplier to allow natural scroll progression between slides
  const SCROLL_PER_SLIDE = 1.25;

  function updateSpacerHeight() {
    const vh = window.innerHeight;
    spacer.style.height = `${vh + (numSlides - 1) * (vh * SCROLL_PER_SLIDE)}px`;
  }

  let currentIndex = -1;

  function setActive(index) {
    if (index === currentIndex) return;
    panels.forEach((panel, i) => {
      panel.classList.toggle('active', i === index);
      panel.classList.toggle('prev-slide', i < index);
    });
    tabs.forEach((tab, i) => tab.classList.toggle('active', i === index));
    currentIndex = index;
  }

  function updateSlides() {
    const rect = track.getBoundingClientRect();
    const vh = window.innerHeight;
    const totalDistance = spacer.offsetHeight - vh;

    if (totalDistance <= 0) return;

    let progress = -rect.top / totalDistance;
    progress = Math.max(0, Math.min(1, progress));

    if (progressBar) {
      progressBar.style.width = `${progress * 100}%`;
    }

    // Maps progress evenly across slides (0, 1, 2)
    let index = Math.floor(progress * numSlides);
    if (index >= numSlides) index = numSlides - 1;
    setActive(index);
  }

  updateSpacerHeight();
  setActive(0);
  updateSlides();

  window.addEventListener('resize', () => {
    updateSpacerHeight();
    updateSlides();
  });

  if (lenis) {
    lenis.on('scroll', updateSlides);
  }
  window.addEventListener('scroll', updateSlides, { passive: true });

  // Tab Navigation Click Jump
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const trackAbsoluteTop = track.getBoundingClientRect().top + (window.scrollY || window.pageYOffset);
      const totalDistance = spacer.offsetHeight - window.innerHeight;
      const targetProgress = i / (numSlides - 1);
      const targetY = trackAbsoluteTop + targetProgress * totalDistance;

      if (lenis) {
        lenis.scrollTo(targetY, { duration: 0.8 });
      } else {
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      }
    });
  });
}

// Setup smooth scrolling for hash links
function initAnchorLinks() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();

      const targetY = target.getBoundingClientRect().top + (window.scrollY || window.pageYOffset);
      if (lenis) {
        lenis.scrollTo(targetY, { duration: 0.9 });
      } else {
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      }
    });
  });
}

// Lifecycle boot
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initLenis();
    initPinnedSlideshow();
    initAnchorLinks();
  });
} else {
  initLenis();
  initPinnedSlideshow();
  initAnchorLinks();
}