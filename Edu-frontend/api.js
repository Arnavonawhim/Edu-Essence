const HOSTED_API = 'https://edu-essence.onrender.com';
const LOCAL_API = 'http://127.0.0.1:8000';

function resolveApiBase() {
  const requested = new URLSearchParams(window.location.search).get('api');
  if (requested) {
    localStorage.setItem('api_base', requested);
  }
  const choice = requested || localStorage.getItem('api_base') || 'hosted';
  if (choice === 'local') return LOCAL_API;
  if (choice === 'hosted') return HOSTED_API;
  return choice.replace(/\/$/, '');
}

export const API_BASE_URL = resolveApiBase();

const TOKEN_KEYS = { access: 'access_token', refresh: 'refresh_token' };

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEYS.access);
}

export function getRefreshToken() {
  return localStorage.getItem(TOKEN_KEYS.refresh);
}

export function setTokens(tokens) {
  const access = tokens?.tokens?.access || tokens?.access;
  const refresh = tokens?.tokens?.refresh || tokens?.refresh;
  if (access) localStorage.setItem(TOKEN_KEYS.access, access);
  if (refresh) localStorage.setItem(TOKEN_KEYS.refresh, refresh);
  if (access) localStorage.setItem('isLoggedIn', 'true');
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEYS.access);
  localStorage.removeItem(TOKEN_KEYS.refresh);
  localStorage.removeItem('isLoggedIn');
}

export function isSignedIn() {
  return Boolean(getAccessToken());
}

export class ApiError extends Error {
  constructor(status, data) {
    super(data?.detail || `Request failed with status ${status}`);
    this.status = status;
    this.data = data;
  }
}

async function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) throw new ApiError(401, { detail: 'No refresh token stored' });

  const response = await fetch(`${API_BASE_URL}/api/auth/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });

  if (!response.ok) {
    clearTokens();
    throw new ApiError(response.status, await safeJson(response));
  }

  const data = await response.json();
  setTokens({ access: data.access, refresh: data.refresh || refresh });
  return data.access;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function request(path, { method = 'GET', json, form, auth = true, retry = true } = {}) {
  const headers = {};
  if (json !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: json !== undefined ? JSON.stringify(json) : form,
  });

  if (response.status === 401 && auth && retry && getRefreshToken()) {
    await refreshAccessToken();
    return request(path, { method, json, form, auth, retry: false });
  }

  if (response.status === 204) return null;

  const data = await safeJson(response);
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}

function audioForm(audioBlob, speak = true) {
  const form = new FormData();
  form.append('audio', audioBlob, 'utterance.webm');
  form.append('speak', String(speak));
  return form;
}

export const Auth = {
  register: (payload) => request('/api/auth/register/', { method: 'POST', json: payload, auth: false }),
  login: (payload) => request('/api/auth/login/', { method: 'POST', json: payload, auth: false }),
  logout: (refresh) => request('/api/auth/logout/', { method: 'POST', json: { refresh } }),
  refreshToken: () => refreshAccessToken(),
  verifyToken: (token) => request('/api/auth/token/verify/', { method: 'POST', json: { token }, auth: false }),
  me: () => request('/api/auth/me/'),
  changePassword: (payload) => request('/api/auth/change-password/', { method: 'POST', json: payload }),
};

export const Translation = {
  listLanguages: () => request('/api/translation/languages/'),
  listSessions: () => request('/api/translation/sessions/'),
  createSession: (payload) => request('/api/translation/sessions/', { method: 'POST', json: payload }),
  getSession: (sessionId) => request(`/api/translation/sessions/${sessionId}/`),
  endSession: (sessionId) => request(`/api/translation/sessions/${sessionId}/end/`, { method: 'POST' }),
  sendUtterance: (sessionId, audioBlob, speak = true) =>
    request(`/api/translation/sessions/${sessionId}/utterances/`, {
      method: 'POST',
      form: audioForm(audioBlob, speak),
    }),
  translateText: (payload) => request('/api/translation/translate/', { method: 'POST', json: payload }),
  synthesizeSpeech: (payload) => request('/api/translation/speech/', { method: 'POST', json: payload }),
};

export const Classroom = {
  listClasses: () => request('/api/classroom/classes/'),
  createClass: (payload) => request('/api/classroom/classes/', { method: 'POST', json: payload }),
  joinClass: (payload) => request('/api/classroom/classes/join/', { method: 'POST', json: payload }),
  getClass: (classId) => request(`/api/classroom/classes/${classId}/`),
  startClass: (classId) => request(`/api/classroom/classes/${classId}/start/`, { method: 'POST' }),
  endClass: (classId) => request(`/api/classroom/classes/${classId}/end/`, { method: 'POST' }),
  leaveClass: (classId) => request(`/api/classroom/classes/${classId}/leave/`, { method: 'POST' }),
  changeLanguage: (classId, payload) =>
    request(`/api/classroom/classes/${classId}/language/`, { method: 'POST', json: payload }),
  getRoomToken: (classId) => request(`/api/classroom/classes/${classId}/token/`),
  sendUtterance: (classId, audioBlob, speak = true) =>
    request(`/api/classroom/classes/${classId}/utterances/`, {
      method: 'POST',
      form: audioForm(audioBlob, speak),
    }),
  pollStream: (classId, after = 0) => request(`/api/classroom/classes/${classId}/stream/?after=${after}`),
  getTranscript: (classId) => request(`/api/classroom/classes/${classId}/transcript/`),
};