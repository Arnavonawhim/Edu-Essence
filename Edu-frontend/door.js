(function () {
  const section = document.querySelector('[data-door]');
  if (!section) return;

  const leaves = [...section.querySelectorAll('[data-door-leaf]')];
  const shades = [...section.querySelectorAll('[data-door-shade]')];
  const seam = section.querySelector('[data-door-seam]');
  const reveal = section.querySelector('[data-door-reveal]');
  const beats = [...section.querySelectorAll('[data-door-beat]')];
  const progress = section.querySelector('[data-door-progress]');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  const OPEN_FROM = 0.14;
  const OPEN_TO = 0.68;
  const HINGE_DEGREES = 76;

  let queued = false;

  function span(t, from, to) {
    if (to <= from) return t >= to ? 1 : 0;
    return Math.min(1, Math.max(0, (t - from) / (to - from)));
  }

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function render() {
    queued = false;
    const range = section.offsetHeight - window.innerHeight;
    if (range <= 0) return;

    const p = Math.min(1, Math.max(0, -section.getBoundingClientRect().top / range));
    const open = easeInOut(span(p, OPEN_FROM, OPEN_TO));

    const angle = HINGE_DEGREES * open;
    const slide = 6 * open;
    const leafOpacity = 1 - span(open, 0.88, 1);

    leaves.forEach((leaf, i) => {
      const dir = i === 0 ? -1 : 1;
      leaf.style.transform = `translateX(${dir * slide}%) rotateY(${dir * angle}deg)`;
      leaf.style.opacity = leafOpacity;
    });

    shades.forEach(shade => {
      shade.style.opacity = 0.9 * open;
    });

    if (seam) {
      seam.style.opacity = 1 - span(open, 0, 0.12);
    }

    if (reveal) {
      const rise = span(open, 0.18, 1);
      reveal.style.opacity = span(open, 0.16, 0.6);
      reveal.style.transform = `scale(${0.7 + 0.3 * rise}) translateY(${(1 - rise) * 4}%)`;
    }

    beats.forEach((beat, i) => {
      const value = i === 0
        ? 1 - span(open, 0.02, 0.28)
        : span(open, 0.62, 0.9);
      beat.style.opacity = value;
      beat.style.transform = `translateY(${(1 - value) * (i === 0 ? -8 : 10)}%)`;
    });

    if (progress) {
      progress.style.transform = `scaleX(${p})`;
    }
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(render);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  render();
})();
