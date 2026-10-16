import { apiFetch, tokens, verifyToken } from './client.js';

export async function register(payload) {
  const data = await apiFetch('/api/auth/register/', { method: 'POST', body: payload });
  tokens.save(data.tokens);
  tokens.saveUserHints(data.user);
  return data.user;
}

export async function login({ email, password }) {
  const data = await apiFetch('/api/auth/login/', { method: 'POST', body: { email, password } });
  tokens.save(data.tokens);
  tokens.saveUserHints(data.user);
  return data.user;
}

/* The server blacklists the refresh token; the local session is cleared either way. */
export async function logout() {
  const refresh = tokens.refresh;
  try {
    if (refresh) await apiFetch('/api/auth/logout/', { method: 'POST', body: { refresh }, auth: true });
  } finally {
    tokens.clear();
  }
}

export function me() {
  return apiFetch('/api/auth/me/', { auth: true });
}

/* True when the stored access token is still live. */
export function hasValidAccess() {
  return verifyToken(tokens.access);
}

export function changePassword(payload) {
  return apiFetch('/api/auth/change-password/', { method: 'POST', body: payload, auth: true });
}
