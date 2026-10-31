import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, setAuthTokenProvider } from './api';
import type { FirebaseWebConfig } from './firebase';
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

export interface RuntimeConfig {
  authMode: 'cookie' | 'firebase';
  firebase: FirebaseWebConfig | null;
  projectId: string;
  firestoreMirror: boolean;
  providers: string[];
  phoneAuthEnabled: boolean;
  platform: { timezone: string };
}

interface SessionContextValue {
  user: AdminUser | null;
  loading: boolean;
  runtime: RuntimeConfig | null;
  authMode: 'cookie' | 'firebase';
  firebaseReady: boolean;
  login: (email: string, password: string) => Promise<AdminUser>;
  loginWithGoogle: () => Promise<AdminUser>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (minimum: Role) => boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * The Firebase SDK (~300 kB) is loaded with a dynamic import and only when the server
 * reports AUTH_MODE=firebase. Students on a slow mobile connection never download it.
 */
type FirebaseModule = typeof import('./firebase');
let firebaseModule: FirebaseModule | null = null;
async function loadFirebase(): Promise<FirebaseModule> {
  if (!firebaseModule) firebaseModule = await import('./firebase');
  return firebaseModule;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [runtime, setRuntime] = useState<RuntimeConfig | null>(null);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const session = await api.get<SessionResponse>('/admin/auth/me');
      if (mounted.current) setUser(session.user);
    } catch (err) {
      if (err instanceof ApiError && err.status !== 401 && err.status !== 403) {
        // Transient failures shouldn't bounce the operator to the login screen.
        console.warn('session refresh failed', err.message);
      }
      if (mounted.current) setUser(null);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      let config: RuntimeConfig | null = null;
      try {
        config = await api.get<RuntimeConfig>('/public/runtime');
      } catch {
        config = null;
      }
      if (cancelled) return;
      if (config) setRuntime(config);

      if (config?.authMode === 'firebase' && config.firebase) {
        const fb = await loadFirebase();
        if (!fb.initFirebase(config.firebase)) {
          await loadSession();
          return;
        }
        if (cancelled) return;
        setFirebaseReady(true);
        unsubscribe = fb.watchAuth((firebaseUser) => {
          if (!firebaseUser) {
            setAuthTokenProvider(null);
            if (mounted.current) {
              setUser(null);
              setLoading(false);
            }
            return;
          }
          setAuthTokenProvider(() => firebaseUser.getIdToken());
          void loadSession();
        });
        return;
      }

      // Cookie sessions (default, and the fallback when Firebase is not configured).
      await loadSession();
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [loadSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      if (runtime?.authMode === 'firebase') {
        const fb = await loadFirebase();
        const firebaseUser = await fb.signInWithEmail(email, password).catch((err: unknown) => {
          throw new Error(fb.firebaseAuthErrorMessage(err));
        });
        setAuthTokenProvider(() => firebaseUser.getIdToken());
        const session = await api.get<SessionResponse>('/admin/auth/me');
        setUser(session.user);
        return session.user;
      }
      const session = await api.post<SessionResponse>('/admin/auth/login', { email, password });
      setUser(session.user);
      return session.user;
    },
    [runtime],
  );

  const loginWithGoogle = useCallback(async () => {
    if (runtime?.authMode !== 'firebase') {
      throw new Error('Google sign-in requires Firebase Authentication. Set AUTH_MODE=firebase on the API.');
    }
    const fb = await loadFirebase();
    const firebaseUser = await fb.signInWithGoogle().catch((err: unknown) => {
      throw new Error(fb.firebaseAuthErrorMessage(err));
    });
    setAuthTokenProvider(() => firebaseUser.getIdToken());
    const session = await api.get<SessionResponse>('/admin/auth/me');
    setUser(session.user);
    return session.user;
  }, [runtime]);

  const resetPassword = useCallback(
    async (email: string) => {
      if (runtime?.authMode === 'firebase') {
        const fb = await loadFirebase();
        await fb.sendReset(email).catch((err: unknown) => {
          throw new Error(fb.firebaseAuthErrorMessage(err));
        });
        return;
      }
      await api.post('/admin/auth/forgot-password', { email });
    },
    [runtime],
  );

  const logout = useCallback(async () => {
    try {
      if (runtime?.authMode === 'firebase') {
        await api.post('/admin/auth/logout').catch(() => undefined);
        const fb = await loadFirebase();
        await fb.signOutFirebase().catch(() => undefined);
        setAuthTokenProvider(null);
      } else {
        await api.post('/admin/auth/logout');
      }
    } finally {
      setUser(null);
    }
  }, [runtime]);

  const can = useCallback(
    (minimum: Role) => {
      if (!user) return false;
      return ROLE_RANK[user.role] >= ROLE_RANK[minimum];
    },
    [user],
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      runtime,
      authMode: runtime?.authMode ?? 'cookie',
      firebaseReady,
      login,
      loginWithGoogle,
      resetPassword,
      logout,
      refresh: loadSession,
      can,
    }),
    [user, loading, runtime, firebaseReady, login, loginWithGoogle, resetPassword, logout, loadSession, can],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
