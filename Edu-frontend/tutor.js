import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { API_BASE_URL, Translation, getAccessToken } from 'api.js';

const AVATAR_MODEL_PATH = 'assets/teacher.glb';
const TUTOR_TURN_ENDPOINT = null;

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

const TutorAvatar = (() => {
  let renderer, scene, camera, clock;
  let mouthMesh = null;
  let mouthIndex = -1;
  let placeholderMouth = null;
  let currentAmplitude = 0;

  const MORPH_TARGET_CANDIDATES = [
    'jawOpen', 'mouthOpen', 'viseme_aa', 'viseme_AA', 'mouthFunnel', 'MouthOpen',
  ];

  function findMorphTarget(root) {
    let found = null;
    root.traverse((node) => {
      if (found) return;
      if (node.isMesh && node.morphTargetDictionary) {
        const key = Object.keys(node.morphTargetDictionary).find((name) =>
          MORPH_TARGET_CANDIDATES.some((candidate) => name.toLowerCase().includes(candidate.toLowerCase()))
        );
        if (key) {
          found = { mesh: node, index: node.morphTargetDictionary[key] };
        }
      }
    });
    return found;
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
    return group;
  }

  function init(container, statusEl) {
    clock = new THREE.Clock();
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(32, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0.15, 4.2);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2, 3, 4);
    scene.add(key);

    const loader = new GLTFLoader();
    loader.load(
      AVATAR_MODEL_PATH,
      (gltf) => {
        scene.add(gltf.scene);
        const morph = findMorphTarget(gltf.scene);
        if (morph) {
          mouthMesh = morph.mesh;
          mouthIndex = morph.index;
        }
        statusEl.textContent = morph ? 'Teacher ready' : 'Teacher ready (no lip-sync rig found)';
        fadeStatus(statusEl);
      },
      undefined,
      () => {
        scene.add(buildPlaceholder());
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
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    if (mouthMesh && mouthIndex >= 0) {
      mouthMesh.morphTargetInfluences[mouthIndex] = currentAmplitude;
    } else if (placeholderMouth) {
      placeholderMouth.scale.y = 1 + currentAmplitude * 4;
    }

    scene.rotation.y = Math.sin(t * 0.3) * 0.05;
    renderer.render(scene, camera);
  }

  function setAmplitude(value) {
    currentAmplitude = Math.min(1, Math.max(0, value));
  }

  return { init, setAmplitude };
})();

function base64ToObjectUrl(base64, format) {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i += 1) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: `audio/${format}` });
  return URL.createObjectURL(blob);
}

function speakAudio(base64, format) {
  return new Promise((resolve) => {
    const url = base64ToObjectUrl(base64, format || 'mp3');
    const audioEl = new Audio(url);
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaElementSource(audioEl);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyser.connect(audioContext.destination);

    const data = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      analyser.getByteFrequencyData(data);
      const average = data.reduce((sum, value) => sum + value, 0) / data.length;
      TutorAvatar.setAmplitude(average / 160);
      if (!audioEl.paused && !audioEl.ended) {
        requestAnimationFrame(tick);
      }
    }

    audioEl.addEventListener('play', () => requestAnimationFrame(tick));
    audioEl.addEventListener('ended', () => {
      TutorAvatar.setAmplitude(0);
      URL.revokeObjectURL(url);
      resolve();
    });

    audioEl.play();
  });
}

function localPedagogyReply(studentText) {
  const text = studentText.toLowerCase();
  if (/hello|hi|namaste/.test(text)) {
    return "Hello! I'm glad you're here. What would you like to understand better today?";
  }
  if (/add|plus|sum|subtract|multiply|divide|math/.test(text)) {
    return "Let's break that down one small step at a time, the same way we did it on the board.";
  }
  return "That's a good question. Let's go through it slowly, one idea at a time.";
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
      return { text: data.text, audioBase64: data.audio, audioFormat: data.audio_format || 'mp3' };
    } catch (err) {
      console.warn('Tutor endpoint unavailable, falling back to translate + speech', err);
    }
  }

  const replyEnglish = localPedagogyReply(studentText);
  let replyText = replyEnglish;

  if (languageCode !== 'en') {
    try {
      const translated = await Translation.translateText({
        text: replyEnglish,
        source_language: 'en',
        target_language: languageCode,
      });
      replyText = translated.translated_text;
    } catch (err) {
      console.warn('Translation unavailable, speaking English reply instead', err);
    }
  }

  const speech = await Translation.synthesizeSpeech({
    text: replyText,
    language: languageCode,
  });

  return { text: replyText, audioBase64: speech.audio_base64, audioFormat: speech.audio_format };
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
}

async function populateLanguages(select) {
  let languages = FALLBACK_LANGUAGES;
  try {
    const fetched = await Translation.listLanguages();
    if (Array.isArray(fetched) && fetched.length) {
      languages = fetched;
    }
  } catch (err) {
    console.warn('Falling back to the built-in language list', err);
  }
  languages.forEach((lang) => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = `${lang.name} · ${lang.native_name}`;
    select.appendChild(option);
  });
}

function setupSpeechInput(micBtn, questionInput, languageSelect, onAutoSubmit) {
  const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionClass) return;

  micBtn.hidden = false;
  const recognition = new SpeechRecognitionClass();
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  micBtn.addEventListener('click', () => {
    recognition.lang = languageSelect.value || 'en';
    micBtn.setAttribute('data-recording', 'true');
    recognition.start();
  });

  recognition.addEventListener('result', (event) => {
    questionInput.value = event.results[0][0].transcript;
    onAutoSubmit();
  });

  recognition.addEventListener('end', () => micBtn.setAttribute('data-recording', 'false'));
  recognition.addEventListener('error', () => micBtn.setAttribute('data-recording', 'false'));
}

function init() {
  const viewport = document.getElementById('avatarViewport');
  const statusEl = document.getElementById('stageStatus');
  const transcript = document.getElementById('transcript');
  const form = document.getElementById('askForm');
  const questionInput = document.getElementById('questionInput');
  const languageSelect = document.getElementById('languageSelect');
  const askNote = document.getElementById('askNote');
  const submitBtn = document.getElementById('askSubmitBtn');
  const micBtn = document.getElementById('micBtn');

  TutorAvatar.init(viewport, statusEl);
  populateLanguages(languageSelect);

  async function handleSubmit() {
    const studentText = questionInput.value.trim();
    if (!studentText) return;

    appendBubble(transcript, 'student', studentText);
    questionInput.value = '';
    submitBtn.disabled = true;
    askNote.textContent = 'The teacher is thinking…';

    try {
      const reply = await getTeacherReply(studentText, languageSelect.value);
      appendBubble(transcript, 'teacher', reply.text);
      askNote.textContent = '';
      await speakAudio(reply.audioBase64, reply.audioFormat);
    } catch (err) {
      console.error(err);
      askNote.textContent = "Couldn't reach the teacher right now — check the API is running.";
    } finally {
      submitBtn.disabled = false;
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handleSubmit();
  });

  setupSpeechInput(micBtn, questionInput, languageSelect, handleSubmit);
}

init();