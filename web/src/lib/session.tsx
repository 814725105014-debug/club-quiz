import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from './api';
import type { AdminUser, Role, SessionResponse } from './types';

const ROLE_RANK: Record<Role, number> = {
  super_admin: 40,
  quiz_admin: 30,
  quiz_host: 20,
  results_viewer: 10,
};

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Super administrator',
  quiz_admin: 'Quiz administrator',
  quiz_host: 'Quiz host',
  results_viewer: 'Results viewer',
};

interface SessionContextValue {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AdminUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (minimum: Role) => boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const session = await api.get<SessionResponse>('/admin/auth/me');
      setUser(session.user);
    } catch (err) {
      if (err instanceof ApiError && err.status !== 401) {
        // Transient failures shouldn't bounce the operator to the login screen.
        console.warn('session refresh failed', err.message);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const session = await api.post<SessionResponse>('/admin/auth/login', { email, password });
    setUser(session.user);
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/admin/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const can = useCallback(
    (minimum: Role) => {
      if (!user) return false;
      return ROLE_RANK[user.role] >= ROLE_RANK[minimum];
    },
    [user],
  );

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh, can }),
    [user, loading, login, logout, refresh, can],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
