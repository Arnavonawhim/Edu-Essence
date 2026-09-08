import Lenis from 'lenis';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const sections = [...document.querySelectorAll('[data-section]')];
const tutorWrap = document.getElementById('tutor-wrap');
const translatorWrap = document.getElementById('translator-wrap');
const featurePanels = [...document.querySelectorAll('[data-feature]')];
const featureTabs = [...document.querySelectorAll('[data-feature-tab]')];

sections.forEach(section => {
  section.querySelectorAll('[data-stagger]').forEach((el, i) => el.style.setProperty('--i', i));
});

function setActiveSection(section) {
  sections.forEach(s => s.classList.toggle('is-active', s === section));
  section.classList.add('has-entered');
}

let currentFeature = -1;
function setFeature(index) {
  if (index === currentFeature) return;
  currentFeature = index;
  featurePanels.forEach((panel, i) => {
    panel.classList.toggle('is-active', i === index);
    panel.classList.toggle('is-past', i < index);
  });
  featureTabs.forEach((tab, i) => {
    tab.classList.toggle('is-active', i === index);
    tab.setAttribute('aria-selected', String(i === index));
  });
}

if (reduceMotion) {
  sections.forEach(s => s.classList.add('is-active', 'has-entered'));
  featurePanels.forEach(p => p.classList.add('is-active'));
} else {
  setActiveSection(sections[0]);
  setFeature(0);
}

const lenis = new Lenis({
  duration: 1.05,
  easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: !reduceMotion,
  touchMultiplier: 1.6,
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

/* Snap targets: hero, the three Section-2 feature states, Section 3. */
function snapTargets() {
  const viewport = window.innerHeight;
  const tutorTop = tutorWrap.offsetTop;
  const featureStep = (tutorWrap.offsetHeight - viewport) / 2;
  return [
    0,
    tutorTop,
    tutorTop + featureStep,
    tutorTop + featureStep * 2,
    translatorWrap.offsetTop,
  ];
}

let targets = snapTargets();

/* On short viewports a pinned panel can overflow; let it scroll natively. */
const pinnedPanels = [...document.querySelectorAll('.stack-pin')];
function syncPinnedOverflow() {
  pinnedPanels.forEach(panel => {
    panel.toggleAttribute('data-lenis-prevent', panel.scrollHeight > panel.clientHeight + 1);
  });
}
syncPinnedOverflow();
const canSnap = () =>
  !reduceMotion &&
  window.innerWidth >= 768 &&
  window.matchMedia('(pointer: fine)').matches;

function updateState(scroll) {
  const viewport = window.innerHeight;

  const translatorTop = translatorWrap.offsetTop;
  const tutorTop = tutorWrap.offsetTop;
  if (scroll >= translatorTop - viewport * 0.35) {
    setActiveSection(sections[2]);
  } else if (scroll >= tutorTop - viewport * 0.35) {
    setActiveSection(sections[1]);
  } else {
    setActiveSection(sections[0]);
  }

  const progress = (scroll - tutorTop) / Math.max(1, tutorWrap.offsetHeight - viewport);
  const index = Math.min(2, Math.max(0, Math.floor(progress * 3 + 0.001)));
  setFeature(index);
}

let snapTimer;
let snapping = false;

function scheduleSnap(scroll) {
  clearTimeout(snapTimer);
  if (!canSnap() || snapping) return;
  snapTimer = setTimeout(() => {
    const limit = translatorWrap.offsetTop + window.innerHeight * 0.6;
    if (scroll > limit) return;
    const nearest = targets.reduce((a, b) =>
      Math.abs(b - scroll) < Math.abs(a - scroll) ? b : a
    );
    if (Math.abs(nearest - scroll) < 2) return;
    snapping = true;
    lenis.scrollTo(nearest, {
      duration: 0.85,
      easing: t => 1 - Math.pow(1 - t, 3),
      onComplete: () => { snapping = false; },
    });
  }, 130);
}

lenis.on('scroll', ({ scroll }) => {
  updateState(scroll);
  scheduleSnap(scroll);
});

updateState(window.scrollY);

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    targets = snapTargets();
    syncPinnedOverflow();
    updateState(lenis.scroll);
  }, 150);
});

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', event => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    clearTimeout(snapTimer);
    snapping = true;
    lenis.scrollTo(target === sections[0] ? 0 : target.closest('.stack-wrap') || target, {
      duration: 1.2,
      onComplete: () => { snapping = false; },
    });
  });
});

featureTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const index = Number(tab.dataset.featureTab);
    if (canSnap()) {
      clearTimeout(snapTimer);
      snapping = true;
      lenis.scrollTo(targets[index + 1], {
        duration: 0.9,
        onComplete: () => { snapping = false; },
      });
    } else {
      setFeature(index);
    }
  });
});
