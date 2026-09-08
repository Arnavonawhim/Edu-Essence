import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  API_BASE_URL,
  Auth,
  Translation,
  clearTokens,
  getAccessToken,
  isSignedIn,
  setTokens,
} from 'api.js';

const AVATAR_MODEL_PATH = 'assets/teacher.glb';
const TUTOR_TURN_ENDPOINT = null;
const PIVOT_LANGUAGE = 'en';

const FALLBACK_LANGUAGES = [
  { code: 'hi', name: 'Hindi', native_name: 'हिन्दी' },
  { code: 'mr', name: 'Marathi', native_name: 'मराठी' },
  { code: 'bn', name: 'Bengali', native_name: 'বাংলা' },
  { code: 'ta', name: 'Tamil', native_name: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native_name: 'తెలుగు' },
  { code: 'kn', name: 'Kannada', native_name: 'ಕನ್ನಡ' },
  { code: 'gu', name: 'Gujarati', native_name: 'ગુજરાતી' },
  { code: 'en', name: 'English', native_name: 'English' },
];

const state = {
  language: 'hi',
  sessionId: null,
  sessionLanguage: null,
  user: null,
  backendReachable: false,
};

function adoptTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (!token) return;
  setTokens({ access: token });
  params.delete('token');
  const rest = params.toString();
  window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
}

const TutorAvatar = (() => {
  let renderer, scene, camera, clock, root;
  const mouths = [];
  let placeholderMouth = null;
  let currentAmplitude = 0;
  let smoothedAmplitude = 0;

  const MORPH_TARGET_CANDIDATES = [
    'jawopen', 'mouthopen', 'viseme_aa', 'mouthfunnel', 'jaw_open', 'a_open',
  ];

  function collectMorphTargets(node) {
    node.traverse((child) => {
      if (!child.isMesh || !child.morphTargetDictionary) return;
      const key = Object.keys(child.morphTargetDictionary).find((name) =>
        MORPH_TARGET_CANDIDATES.some((candidate) => name.toLowerCase().includes(candidate))
      );
      if (key) {
        mouths.push({ mesh: child, index: child.morphTargetDictionary[key] });
      }
    });
    return mouths.length > 0;
  }

  function frameHead(object) {
    object.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());

    const height = size.y > 0.5 ? size.y : 1.8;
    const topY = size.y > 0.5 ? box.max.y : 1.8;

    object.position.x -= centre.x;
    object.position.z -= centre.z;

    const targetY = topY - height * 0.13;
    const visibleHeight = height * 0.46;
    const distance = (visibleHeight / 2) / Math.tan((camera.fov * Math.PI) / 360);

    camera.position.set(0, targetY, distance);
    camera.lookAt(new THREE.Vector3(0, targetY, 0));
    camera.updateProjectionMatrix();

    window.__tutorStage = {
      boxMin: box.min.toArray().map((v) => +v.toFixed(3)),
      boxMax: box.max.toArray().map((v) => +v.toFixed(3)),
      targetY: +targetY.toFixed(3),
      distance: +distance.toFixed(3),
    };
  }

  function buildPlaceholder() {
    const group = new THREE.Group();
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xfff8d3, roughness: 0.6 })
    );
    group.add(head);

    const eyeGeometry = new THREE.SphereGeometry(0.08, 16, 16);
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x1f2421 });
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.32, 0.15, 0.88);
    const rightEye = leftEye.clone();
    rightEye.position.x = 0.32;
    group.add(leftEye, rightEye);

    const mouth = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x1f2421, side: THREE.DoubleSide })
    );
    mouth.position.set(0, -0.32, 0.9);
    group.add(mouth);

    placeholderMouth = mouth;
    camera.position.set(0, 0, 4.2);
    camera.lookAt(0, 0, 0);
    return group;
  }

  function init(container, statusEl) {
    clock = new THREE.Clock();
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(32, container.clientWidth / container.clientHeight, 0.01, 100);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.7));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(1.5, 2.5, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xc7b4d8, 1.1);
    rim.position.set(-2, 1.5, -2);
    scene.add(rim);

    const loader = new GLTFLoader();
    loader.load(
      AVATAR_MODEL_PATH,
      (gltf) => {
        root = gltf.scene;
        scene.add(root);
        frameHead(root);
        const rigged = collectMorphTargets(root);
        statusEl.textContent = rigged ? 'Teacher ready' : 'Teacher ready (no mouth rig in this model yet)';
        fadeStatus(statusEl);
      },
      undefined,
      () => {
        root = buildPlaceholder();
        scene.add(root);
        statusEl.textContent = 'Teacher ready (placeholder avatar)';
        fadeStatus(statusEl);
      }
    );

    window.addEventListener('resize', () => onResize(container));
    animate();
  }

  function fadeStatus(statusEl) {
    setTimeout(() => statusEl.setAttribute('data-hidden', 'true'), 1600);
  }

  function onResize(container) {
    if (!renderer || !container.clientWidth) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    smoothedAmplitude += (currentAmplitude - smoothedAmplitude) * 0.35;

    if (mouths.length) {
      mouths.forEach(({ mesh, index }) => {
        mesh.morphTargetInfluences[index] = smoothedAmplitude;
      });
    } else if (placeholderMouth) {
      placeholderMouth.scale.y = 1 + smoothedAmplitude * 4;
    }

    if (root) {
      root.rotation.y = Math.sin(elapsed * 0.3) * 0.05;
    }
    renderer.render(scene, camera);
  }

  function setAmplitude(value) {
    currentAmplitude = Math.min(1, Math.max(0, value));
  }

  return { init, setAmplitude, hasMouthRig: () => mouths.length > 0 };
})();

const AudioEngine = (() => {
  let context = null;
  let analyser = null;
  const wired = new WeakSet();

  function ensureContext() {
    if (!context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      context = new AudioContextClass();
      analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      analyser.connect(context.destination);
    }
    if (context.state === 'suspended') context.resume();
    return context;
  }

  function play(base64, format) {
    return new Promise((resolve, reject) => {
      let url;
      try {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        const mime = format && format.includes('/') ? format : `audio/${format || 'mpeg'}`;
        url = URL.createObjectURL(new Blob([bytes], { type: mime }));
      } catch (error) {
        reject(error);
        return;
      }

      ensureContext();
      const element = new Audio(url);

      if (!wired.has(element)) {
        const source = context.createMediaElementSource(element);
        source.connect(analyser);
        wired.add(element);
      }

      const data = new Uint8Array(analyser.frequencyBinCount);

      function tick() {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) sum += data[i];
        TutorAvatar.setAmplitude(sum / data.length / 90);
        if (!element.paused && !element.ended) requestAnimationFrame(tick);
      }

      element.addEventListener('playing', () => requestAnimationFrame(tick));
      element.addEventListener('ended', () => {
        TutorAvatar.setAmplitude(0);
        URL.revokeObjectURL(url);
        resolve();
      });
      element.addEventListener('error', () => {
        TutorAvatar.setAmplitude(0);
        URL.revokeObjectURL(url);
        reject(new Error('Audio playback failed'));
      });

      element.play().catch(reject);
    });
  }

  return { play, unlock: ensureContext };
})();

function localPedagogyReply(studentText) {
  const text = studentText.toLowerCase();
  if (/hello|hi\b|namaste|vanakkam/.test(text)) {
    return 'Namaste! I am glad you are here. Which part of the lesson would you like to go over?';
  }
  if (/add|plus|sum|subtract|minus|multiply|divide|table|math/.test(text)) {
    return 'Let us do it one small step at a time. Tell me the two numbers, and we will work through them together the way we did on the board.';
  }
  if (/photosynth|plant|leaf|sunlight/.test(text)) {
    return 'A plant makes its own food using sunlight, water and the air around it. The green colour in the leaf is what catches the sunlight.';
  }
  if (/water cycle|rain|cloud|evapor/.test(text)) {
    return 'Water from rivers and seas warms up and rises as vapour, cools into clouds high above, and falls back down as rain. The same water goes round and round.';
  }
  if (/why|how|what/.test(text)) {
    return 'That is a good question. Let us build the answer slowly, one idea at a time, and you stop me the moment something feels unclear.';
  }
  return 'I hear you. Tell me which part is confusing, and we will take it step by step.';
}

async function ensureSession(language) {
  if (state.sessionId && state.sessionLanguage === language) return state.sessionId;

  const session = await Translation.createSession({
    title: '3D vernacular teacher',
    topic: 'Tutor session',
    source_language: language,
    target_language: language === PIVOT_LANGUAGE ? 'hi' : PIVOT_LANGUAGE,
    mode: 'in_person',
  });

  state.sessionId = session.id;
  state.sessionLanguage = language;
  return session.id;
}

async function transcribeWithBackend(blob, language) {
  const sessionId = await ensureSession(language);
  const result = await Translation.sendUtterance(sessionId, blob, false);
  const chunk = result.chunk || result;
  return {
    spoken: chunk.original_text || '',
    english: chunk.translated_text || chunk.original_text || '',
  };
}

async function getTeacherReply(studentText, languageCode) {
  if (TUTOR_TURN_ENDPOINT) {
    try {
      const response = await fetch(`${API_BASE_URL}${TUTOR_TURN_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
        },
        body: JSON.stringify({ text: studentText, language: languageCode }),
      });
      if (!response.ok) throw new Error(`Tutor endpoint responded ${response.status}`);
      const data = await response.json();
      return { text: data.text, audioBase64: data.audio, audioFormat: data.audio_format || 'audio/mpeg' };
    } catch (error) {
      console.warn('Tutor endpoint unavailable, using translate + speech instead', error);
    }
  }

  const replyEnglish = localPedagogyReply(studentText);
  let replyText = replyEnglish;

  if (languageCode !== 'en') {
    const translated = await Translation.translateText({
      text: replyEnglish,
      source_language: 'en',
      target_language: languageCode,
    });
    replyText = translated.translated_text || replyEnglish;
  }

  const speech = await Translation.synthesizeSpeech({
    text: replyText,
    language: languageCode,
  });

  return {
    text: replyText,
    audioBase64: speech.audio_base64,
    audioFormat: speech.audio_format || 'audio/mpeg',
  };
}

function appendBubble(container, role, text) {
  const bubble = document.createElement('div');
  bubble.className = `tutor-bubble tutor-bubble--${role}`;
  const label = document.createElement('span');
  label.className = 'tutor-bubble-role';
  label.textContent = role === 'student' ? 'You' : 'Teacher';
  const paragraph = document.createElement('p');
  paragraph.className = 'italic';
  paragraph.textContent = text;
  bubble.append(label, paragraph);
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

async function populateLanguages(select) {
  let languages = FALLBACK_LANGUAGES;
  try {
    const fetched = await Translation.listLanguages();
    if (Array.isArray(fetched) && fetched.length) {
      languages = fetched;
      state.backendReachable = true;
    }
  } catch (error) {
    console.warn('Falling back to the built-in language list', error);
  }
  select.innerHTML = '';
  languages.forEach((lang) => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = `${lang.name} · ${lang.native_name}`;
    select.appendChild(option);
  });
  select.value = languages.some((item) => item.code === state.language) ? state.language : languages[0].code;
  state.language = select.value;
}

function setStatusPill(pill, mode, text) {
  pill.dataset.mode = mode;
  pill.textContent = text;
}

async function refreshIdentity(pill, signOutBtn) {
  if (!isSignedIn()) {
    state.user = null;
    setStatusPill(pill, 'signed-out', 'Not signed in — sign in on the home page to use the backend');
    signOutBtn.hidden = true;
    return;
  }
  try {
    const me = await Auth.me();
    state.user = me;
    state.backendReachable = true;
    const name = me.full_name || me.first_name || me.email;
    setStatusPill(pill, 'signed-in', `Signed in as ${name} (${me.role})`);
    signOutBtn.hidden = false;
  } catch (error) {
    state.user = null;
    setStatusPill(pill, 'error', 'Signed in, but the API did not accept the token');
    signOutBtn.hidden = false;
  }
}

function createRecorder(onBlob) {
  let recorder = null;
  let chunks = [];

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size) chunks.push(event.data);
    });
    recorder.addEventListener('stop', () => {
      stream.getTracks().forEach((track) => track.stop());
      if (chunks.length) onBlob(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
    });
    recorder.start();
  }

  function stop() {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    recorder = null;
  }

  function isRecording() {
    return Boolean(recorder && recorder.state === 'recording');
  }

  return { start, stop, isRecording };
}

function init() {
  adoptTokenFromUrl();

  const viewport = document.getElementById('avatarViewport');
  const statusEl = document.getElementById('stageStatus');
  const transcript = document.getElementById('transcript');
  const form = document.getElementById('askForm');
  const questionInput = document.getElementById('questionInput');
  const languageSelect = document.getElementById('languageSelect');
  const askNote = document.getElementById('askNote');
  const submitBtn = document.getElementById('askSubmitBtn');
  const micBtn = document.getElementById('micBtn');
  const authPill = document.getElementById('authPill');
  const signOutBtn = document.getElementById('signOutBtn');
  const apiBaseLabel = document.getElementById('apiBaseLabel');

  if (apiBaseLabel) apiBaseLabel.textContent = API_BASE_URL;

  TutorAvatar.init(viewport, statusEl);
  populateLanguages(languageSelect);
  refreshIdentity(authPill, signOutBtn);

  languageSelect.addEventListener('change', () => {
    state.language = languageSelect.value;
  });

  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      clearTokens();
      state.sessionId = null;
      refreshIdentity(authPill, signOutBtn);
    });
  }

  async function ask(studentText, spokenOriginal) {
    appendBubble(transcript, 'student', spokenOriginal || studentText);
    questionInput.value = '';
    submitBtn.disabled = true;
    askNote.textContent = 'The teacher is thinking…';

    try {
      const reply = await getTeacherReply(studentText, state.language);
      appendBubble(transcript, 'teacher', reply.text);
      askNote.textContent = '';
      if (reply.audioBase64) {
        await AudioEngine.play(reply.audioBase64, reply.audioFormat);
      }
    } catch (error) {
      console.error(error);
      const detail = error.status === 401
        ? 'You need to sign in on the home page first.'
        : 'Could not reach the backend — check the Django server is running.';
      askNote.textContent = detail;
    } finally {
      submitBtn.disabled = false;
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    AudioEngine.unlock();
    const text = questionInput.value.trim();
    if (text) ask(text);
  });

  if (micBtn && navigator.mediaDevices && window.MediaRecorder) {
    micBtn.hidden = false;
    const recorder = createRecorder(async (blob) => {
      askNote.textContent = 'Listening to what you said…';
      try {
        const heard = await transcribeWithBackend(blob, state.language);
        if (!heard.english) {
          askNote.textContent = 'I could not catch that — try again.';
          return;
        }
        await ask(heard.english, heard.spoken);
      } catch (error) {
        console.error(error);
        askNote.textContent = 'Speech recognition needs the backend and a signed-in account.';
      }
    });

    micBtn.addEventListener('click', async () => {
      AudioEngine.unlock();
      if (recorder.isRecording()) {
        micBtn.setAttribute('data-recording', 'false');
        askNote.textContent = '';
        recorder.stop();
        return;
      }
      try {
        await recorder.start();
        micBtn.setAttribute('data-recording', 'true');
        askNote.textContent = 'Listening… tap the mic again when you finish.';
      } catch (error) {
        console.error(error);
        askNote.textContent = 'Microphone permission was refused.';
      }
    });
  }
}

init();
