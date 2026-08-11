import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { api, clearToken, getToken, setToken } from '../api/client';
import { User } from '../types';

/** Auth state and actions exposed to the rest of the app. */
interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Provides the authenticated user and auth actions.
 * On mount it restores the session from the stored JWT; if the token is
 * rejected by the server it is cleared so the user is logged out.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(({ user }) => {
        if (!cancelled) setUser(user);
      })
      .catch(() => clearToken())
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Stores the token and user after a successful login. */
  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await api.login({ email, password });
    setToken(token);
    setUser(user);
  }, []);

  /** Stores the token and user after a successful registration. */
  const register = useCallback(async (name: string, email: string, password: string) => {
    const { token, user } = await api.register({ name, email, password });
    setToken(token);
    setUser(user);
  }, []);

  /** Clears the stored token and local user state. */
  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Accesses the auth context; throws when used outside an `AuthProvider`. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}