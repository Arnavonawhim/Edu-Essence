const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const sections = [...document.querySelectorAll('[data-section]')];
const tutorWrap = document.getElementById('tutor-wrap');
const translatorWrap = document.getElementById('translator-wrap');
const featurePanels = [...document.querySelectorAll('[data-feature]')];
const featureTabs = [...document.querySelectorAll('[data-feature-tab]')];

let lenis = null;
let snapTimer;
let releaseTimer;
let snapping = false;
let direction = 0;
let lastScroll = 0;

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

function updateState() {
  const scroll = window.scrollY;
  if (scroll !== lastScroll) {
    direction = scroll > lastScroll ? 1 : -1;
    lastScroll = scroll;
  }
  const viewport = window.innerHeight;
  const tutorTop = tutorWrap.offsetTop;
  const translatorTop = translatorWrap.offsetTop;

  if (scroll >= translatorTop - viewport * 0.35) {
    setActiveSection(sections[2]);
  } else if (scroll >= tutorTop - viewport * 0.35) {
    setActiveSection(sections[1]);
  } else {
    setActiveSection(sections[0]);
  }

  const progress = (scroll - tutorTop) / Math.max(1, tutorWrap.offsetHeight - viewport);
  setFeature(Math.min(2, Math.max(0, Math.floor(progress * 3 + 0.001))));
}

/* Snap targets: hero, the three Section-2 feature states, Section 3. */
function snapTargets() {
  const tutorTop = tutorWrap.offsetTop;
  const featureStep = (tutorWrap.offsetHeight - window.innerHeight) / 2;
  return [
    0,
    tutorTop,
    tutorTop + featureStep,
    tutorTop + featureStep * 2,
    translatorWrap.offsetTop,
  ];
}

let targets = snapTargets();

const canSnap = () =>
  lenis &&
  window.innerWidth >= 768 &&
  window.matchMedia('(pointer: fine)').matches;

function releaseSnap() {
  clearTimeout(releaseTimer);
  snapping = false;
}

function smoothScrollTo(position, duration) {
  clearTimeout(snapTimer);
  if (lenis) {
    snapping = true;
    clearTimeout(releaseTimer);
    /* onComplete never fires when the user interrupts the tween, so release regardless. */
    releaseTimer = setTimeout(releaseSnap, duration * 1000 + 120);
    lenis.scrollTo(position, {
      duration,
      easing: t => 1 - Math.pow(1 - t, 3),
      onComplete: releaseSnap,
    });
  } else {
    window.scrollTo({ top: position, behavior: 'smooth' });
  }
}

/*function scheduleSnap() {
  clearTimeout(snapTimer);
  if (!canSnap() || snapping) return;
  snapTimer = setTimeout(() => {
    const scroll = window.scrollY;
    if (scroll > translatorWrap.offsetTop + window.innerHeight * 0.6) return;

    const nearest = targets.reduce((a, b) =>
      Math.abs(b - scroll) < Math.abs(a - scroll) ? b : a
    );
    /* Snapping backwards against the scroll direction would trap the reader on a
       state they are trying to leave, so resolve forwards instead. */
   /* const ahead = direction > 0
      ? targets.find(t => t > scroll + 2)
      : [...targets].reverse().find(t => t < scroll - 2);
    const target = (direction !== 0 && (nearest - scroll) * direction < 0 && ahead !== undefined)
      ? ahead
      : nearest;

    if (Math.abs(target - scroll) < 2) return;
    smoothScrollTo(target, 0.85);
  }, 130);
}*/
function scheduleSnap() {
  clearTimeout(snapTimer);
  return;
}

function sectionOffset(section) {
  const wrap = section.closest('.stack-wrap');
  return wrap ? wrap.offsetTop : section.offsetTop;
}

/* Motion is opt-in: without it the page stays a plain, fully visible document. */
if (!reduceMotion) {
  document.documentElement.classList.add('js-motion');
  setActiveSection(sections[0]);
  setFeature(0);
  updateState();

  window.addEventListener('scroll', updateState, { passive: true });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      targets = snapTargets();
      updateState();
    }, 150);
  });

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', event => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      smoothScrollTo(target === sections[0] ? 0 : sectionOffset(target), 1.2);
    });
  });

  featureTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const index = Number(tab.dataset.featureTab);
      if (canSnap()) smoothScrollTo(targets[index + 1], 0.9);
      else setFeature(index);
    });
  });
}

/* Called once Lenis resolves — as an ES module when served, or via the UMD fallback. */
window.startScrollExperience = function (Lenis) {
  if (window.scrollExperienceReady || reduceMotion || typeof Lenis !== 'function') return;
  window.scrollExperienceReady = true;

  lenis = new Lenis({
    duration: 1.05,
    easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    touchMultiplier: 1.6,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  lenis.on('scroll', () => {
    updateState();
    scheduleSnap();
  });
};
