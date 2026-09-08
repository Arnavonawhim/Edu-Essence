export const API_BASE_URL = 'https://edu-essence.onrender.com';

export const REFRESH_PATH = '/api/auth/token/refresh/';
export const VERIFY_PATH = '/api/auth/token/verify/';

const STORAGE = {
  access: 'access_token',
  refresh: 'refresh_token',
  loggedIn: 'isLoggedIn',
  role: 'user_role',
  name: 'user_name',
};

export const tokens = {
  get access() {
    return localStorage.getItem(STORAGE.access) || '';
  },
  get refresh() {
    return localStorage.getItem(STORAGE.refresh) || '';
  },
  save({ access, refresh }) {
    localStorage.setItem(STORAGE.access, access || '');
    localStorage.setItem(STORAGE.refresh, refresh || '');
    localStorage.setItem(STORAGE.loggedIn, 'true');
  },
  saveUserHints(user) {
    if (!user) return;
    localStorage.setItem(STORAGE.role, user.role || 'student');
    localStorage.setItem(STORAGE.name, user.full_name || user.username || '');
  },
  clear() {
    Object.values(STORAGE).forEach(key => localStorage.removeItem(key));
  },
};

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

/* Django REST returns errors as {field: [messages]} or {detail: "..."}. */
function readError(data, status) {
  if (!data) return `Request failed (${status})`;
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  const firstField = Object.keys(data)[0];
  if (!firstField) return `Request failed (${status})`;
  const value = data[firstField];
  return Array.isArray(value) ? value[0] : String(value);
}

let refreshInFlight = null;

/* One shared refresh: parallel 401s wait on the same request instead of each
   spending the refresh token, which rotation would invalidate. */
function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refresh = tokens.refresh;
    if (!refresh) return false;
    try {
      const response = await fetch(`${API_BASE_URL}${REFRESH_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (!response.ok) return false;
      const data = await response.json();
      /* SimpleJWT returns a new refresh token too when rotation is on. */
      tokens.save({ access: data.access, refresh: data.refresh || refresh });
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function request(path, { method, body, auth }) {
  /* multipart uploads must set their own boundary, so leave the header off. */
  const isForm = body instanceof FormData;
  const headers = isForm ? {} : { 'Content-Type': 'application/json' };
  if (auth && tokens.access) headers.Authorization = `Bearer ${tokens.access}`;

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection.', 0, null);
  }
}

export async function apiFetch(path, { method = 'GET', body, auth = false } = {}) {
  let response = await request(path, { method, body, auth });

  /* An expired access token is recoverable: refresh once, then replay. */
  if (response.status === 401 && auth && tokens.refresh) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await request(path, { method, body, auth });
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    if (response.status === 401 && auth) tokens.clear();
    throw new ApiError(readError(data, response.status), response.status, data);
  }
  return data;
}

/* Cheap liveness check for a token; says nothing about what it may be used for. */
export async function verifyToken(token) {
  if (!token) return false;
  try {
    const response = await fetch(`${API_BASE_URL}${VERIFY_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
