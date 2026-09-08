const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const sections = [...document.querySelectorAll('[data-section]')];
const pinnedTracks = [
  document.querySelector('[data-cine]'),
  document.querySelector('[data-door]'),
].filter(Boolean);

let lenis = null;
let snapTimer;
let releaseTimer;
let snapping = false;
let direction = 0;
let lastScroll = 0;

sections.forEach(section => {
  section.querySelectorAll('[data-stagger]').forEach((el, i) => el.style.setProperty('--i', i));
});

function trackEnd(track) {
  return track.offsetTop + track.offsetHeight - window.innerHeight;
}

function lastTrackEnd() {
  return pinnedTracks.length ? trackEnd(pinnedTracks[pinnedTracks.length - 1]) : 0;
}

function updateState() {
  const scroll = window.scrollY;
  if (scroll !== lastScroll) {
    direction = scroll > lastScroll ? 1 : -1;
    lastScroll = scroll;
  }
  sections.forEach(s => {
    s.classList.add('is-active', 'has-entered');
  });
}

function snapTargets() {
  return [0, ...pinnedTracks.map(t => t.offsetTop)];
}

let targets = snapTargets();

const canSnap = () =>
  lenis &&
  window.innerWidth >= 768 &&
  window.matchMedia('(pointer: fine)').matches;

function insidePinnedTrack(scroll) {
  return pinnedTracks.some(track => scroll > track.offsetTop + 4 && scroll < trackEnd(track) - 4);
}

function releaseSnap() {
  clearTimeout(releaseTimer);
  snapping = false;
}

function smoothScrollTo(position, duration) {
  clearTimeout(snapTimer);
  if (lenis) {
    snapping = true;
    clearTimeout(releaseTimer);
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

window.smoothScrollTo = smoothScrollTo;

function scheduleSnap() {
  clearTimeout(snapTimer);
  if (!canSnap() || snapping) return;
  snapTimer = setTimeout(() => {
    const scroll = window.scrollY;
    if (scroll > lastTrackEnd() - window.innerHeight * 0.2) return;
    if (insidePinnedTrack(scroll)) return;

    const nearest = targets.reduce((a, b) =>
      Math.abs(b - scroll) < Math.abs(a - scroll) ? b : a
    );
    const ahead = direction > 0
      ? targets.find(t => t > scroll + 2)
      : [...targets].reverse().find(t => t < scroll - 2);
    const target = (direction !== 0 && (nearest - scroll) * direction < 0 && ahead !== undefined)
      ? ahead
      : nearest;

    if (Math.abs(target - scroll) < 2) return;
    if (insidePinnedTrack(target)) return;
    smoothScrollTo(target, 0.85);
  }, 130);
}*/
function scheduleSnap() {
  clearTimeout(snapTimer);
  return;
}

if (!reduceMotion) {
  document.documentElement.classList.add('js-motion');
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
      smoothScrollTo(target === sections[0] ? 0 : target.offsetTop, 1.2);
    });
  });
}

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
