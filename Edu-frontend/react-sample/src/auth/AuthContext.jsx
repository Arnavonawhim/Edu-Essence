import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from '../api/auth.js';
import { tokens } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  /* localStorage can be edited by hand, so the role always comes from /me. */
  const refreshUser = useCallback(async () => {
    if (!tokens.access) {
      setUser(null);
      setStatus('anonymous');
      return null;
    }
    try {
      const fresh = await authApi.me();
      tokens.saveUserHints(fresh);
      setUser(fresh);
      setStatus('authenticated');
      return fresh;
    } catch (error) {
      /* Only a rejected token ends the session. A network or CORS failure must
         not throw away credentials that are still perfectly valid. */
      if (error.status === 401 || error.status === 403) tokens.clear();
      setUser(null);
      setStatus('anonymous');
      return null;
    }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  const value = useMemo(() => ({
    user,
    status,
    isAuthenticated: status === 'authenticated',
    role: user?.role?.toLowerCase() ?? null,
    isTeacher: user?.role?.toLowerCase() === 'teacher',
    isStudent: user?.role?.toLowerCase() === 'student',
    refreshUser,
    async login(credentials) {
      const loggedIn = await authApi.login(credentials);
      setUser(loggedIn);
      setStatus('authenticated');
      return loggedIn;
    },
    async register(payload) {
      const created = await authApi.register(payload);
      setUser(created);
      setStatus('authenticated');
      return created;
    },
    async logout() {
      await authApi.logout();
      setUser(null);
      setStatus('anonymous');
    },
  }), [user, status, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
