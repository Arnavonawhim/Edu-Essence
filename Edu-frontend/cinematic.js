(function () {
  const section = document.querySelector('[data-cine]');
  if (!section) return;

  const layers = [...section.querySelectorAll('[data-cine-layer]')];
  const beats = [...section.querySelectorAll('[data-cine-beat]')];
  const ticks = [...section.querySelectorAll('[data-cine-tick]')];
  const progress = section.querySelector('[data-cine-progress]');
  const stage = section.querySelector('[data-cine-stage]');
  const total = beats.length;
  if (!total) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const segment = 1 / total;
  const fade = segment * 0.16;
  const gap = segment * 0.1;

  section.style.setProperty('--beats', total);

  function sample(input, output, t) {
    if (t <= input[0]) return output[0];
    const last = input.length - 1;
    if (t >= input[last]) return output[last];
    for (let i = 1; i <= last; i++) {
      if (t <= input[i]) {
        const span = input[i] - input[i - 1];
        const k = span <= 0 ? 1 : (t - input[i - 1]) / span;
        return output[i - 1] + (output[i] - output[i - 1]) * k;
      }
    }
    return output[last];
  }

  function beatTrack(index) {
    const start = index * segment;
    const end = start + segment;
    const isFirst = index === 0;
    const isLast = index === total - 1;

    const inFrom = Math.min(start + gap, end);
    const inTo = Math.min(inFrom + fade, end);
    const outTo = Math.max(end - gap, inTo);
    const outFrom = Math.max(outTo - fade, inTo);

    const input = [0];
    const opacity = [isFirst ? 1 : 0];
    const shift = [isFirst ? 0 : 7];

    if (!isFirst) {
      input.push(inFrom, inTo);
      opacity.push(0, 1);
      shift.push(7, 0);
    }
    if (!isLast) {
      input.push(outFrom, outTo);
      opacity.push(1, 0);
      shift.push(0, -7);
    }

    input.push(1);
    opacity.push(isLast ? 1 : 0);
    shift.push(isLast ? 0 : -7);

    return { input, opacity, shift };
  }

  function layerTrack(index) {
    const from = index * segment;
    const to = from + segment;

    if (index === 0) return { input: [0, 1], opacity: [1, 1], from, to };

    return {
      input: [0, Math.max(0.0001, from - fade), Math.min(1, from + fade), 1],
      opacity: [0, 0, 1, 1],
      from,
      to,
    };
  }

  const beatTracks = beats.map((_, i) => beatTrack(i));
  const layerTracks = layers.map((_, i) => layerTrack(i));

  let activeTick = -1;
  let queued = false;

  function render() {
    queued = false;
    const range = section.offsetHeight - window.innerHeight;
    if (range <= 0) return;

    const travelled = -section.getBoundingClientRect().top;
    const p = Math.min(1, Math.max(0, travelled / range));

    beats.forEach((beat, i) => {
      const track = beatTracks[i];
      const opacity = sample(track.input, track.opacity, p);
      const shift = sample(track.input, track.shift, p);
      beat.style.opacity = opacity;
      beat.style.transform = `translateY(${shift}%)`;
      beat.classList.toggle('is-live', opacity > 0.6);
    });

    layers.forEach((layer, i) => {
      const track = layerTracks[i];
      layer.style.opacity = sample(track.input, track.opacity, p);
      const zoom = sample([0, Math.max(0.0001, track.from), track.to, 1], [1.07, 1.07, 1, 1], p);
      layer.style.transform = `scale(${zoom})`;
    });

    if (stage) {
      stage.style.transform = `scale(${1 + 0.22 * p})`;
    }

    if (progress) {
      progress.style.transform = `scaleX(${p})`;
    }

    const index = Math.min(total - 1, Math.floor(p * total));
    if (index !== activeTick) {
      activeTick = index;
      ticks.forEach((tick, i) => tick.classList.toggle('is-active', i === index));
    }
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(render);
  }

  function beatScrollPosition(index) {
    const range = section.offsetHeight - window.innerHeight;
    return section.offsetTop + range * (index * segment + segment * 0.45);
  }

  ticks.forEach((tick, i) => {
    tick.addEventListener('click', () => {
      if (reduceMotion) {
        beats[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      const to = beatScrollPosition(i);
      if (window.smoothScrollTo) window.smoothScrollTo(to, 0.9);
      else window.scrollTo({ top: to, behavior: 'smooth' });
    });
  });

  function showStageNote(frame, message) {
    if (frame.querySelector('.cine-stage-note')) return;
    const note = document.createElement('p');
    note.className = 'cine-stage-note';
    note.innerHTML = message;
    frame.appendChild(note);
    console.warn('3D teacher stage:', note.textContent);
  }

  function mountTeacherModel() {
    const frame = section.querySelector('[data-model-src]');
    if (!frame) return;
    const src = (frame.dataset.modelSrc || '').trim();
    if (!src) return;

    const placeholder = frame.querySelector('.cine-stage-placeholder');

    if (/sketchfab\.com/i.test(src)) {
      const embed = document.createElement('iframe');
      embed.src = src;
      embed.title = '3D vernacular teacher';
      embed.allow = 'autoplay; fullscreen; xr-spatial-tracking';
      embed.setAttribute('allowfullscreen', '');
      frame.prepend(embed);
      if (placeholder) placeholder.remove();
      return;
    }

    const servedOverHttp = /^https?:$/.test(window.location.protocol);
    if (!servedOverHttp) {
      showStageNote(frame, 'The 3D teacher needs a local server &mdash; open this page over http:// instead of double-clicking the file.');
      return;
    }

    if (!customElements.get('model-viewer')) {
      const loader = document.createElement('script');
      loader.type = 'module';
      loader.src = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js';
      loader.onerror = () => showStageNote(frame, 'Could not reach the 3D viewer library.');
      document.head.appendChild(loader);
    }

    setTimeout(() => {
      if (!customElements.get('model-viewer')) {
        showStageNote(frame, 'The 3D viewer library did not load.');
      }
    }, 9000);

    const viewer = document.createElement('model-viewer');
    viewer.setAttribute('src', src);
    viewer.setAttribute('alt', '3D vernacular teacher');
    viewer.setAttribute('camera-controls', '');
    viewer.setAttribute('touch-action', 'pan-y');
    viewer.setAttribute('disable-zoom', '');
    viewer.setAttribute('shadow-intensity', '0.85');
    viewer.setAttribute('shadow-softness', '1');
    viewer.setAttribute('exposure', '1.15');
    viewer.setAttribute('environment-image', 'neutral');
    viewer.setAttribute('camera-orbit', frame.dataset.modelOrbit || '15deg 88deg auto');
    if (frame.dataset.modelTarget) viewer.setAttribute('camera-target', frame.dataset.modelTarget);
    if (frame.dataset.modelFov) viewer.setAttribute('field-of-view', frame.dataset.modelFov);
    viewer.setAttribute('interaction-prompt', 'none');
    viewer.setAttribute('loading', 'eager');
    viewer.setAttribute('reveal', 'auto');
    viewer.setAttribute('disable-pan', '');
    viewer.style.setProperty('--poster-color', 'transparent');
    if (frame.dataset.modelAnimation) viewer.setAttribute('animation-name', frame.dataset.modelAnimation);
    viewer.setAttribute('autoplay', '');
    if (!reduceMotion && frame.dataset.modelAutorotate === 'true') {
      viewer.setAttribute('auto-rotate', '');
      viewer.setAttribute('auto-rotate-delay', '1200');
      viewer.setAttribute('rotation-per-second', '10deg');
    }
    viewer.addEventListener('load', () => {
      if (placeholder) placeholder.remove();
      const note = frame.querySelector('.cine-stage-note');
      if (note) note.remove();
    });
    viewer.addEventListener('error', event => {
      showStageNote(frame, 'The 3D model could not be loaded.');
      console.warn('model-viewer failed to load', src, event.detail);
    });
    frame.prepend(viewer);
  }

  mountTeacherModel();

  if (reduceMotion) return;

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  render();
})();
