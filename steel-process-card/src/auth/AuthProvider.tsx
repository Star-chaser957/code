import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { AuthUser, LoginRequest, WorkflowRole } from '../../shared/types';
import { api } from '../lib/api';
import { clearAuthToken, getAuthToken, setAuthToken } from '../lib/auth-store';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  hasWorkflowRole: (role: WorkflowRole) => boolean;
  login: (payload: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearAuthToken();
      setUser(null);
      setLoading(false);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);

    const restoreSession = async () => {
      const token = getAuthToken();

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.getCurrentUser();
        setUser(response.user);
      } catch {
        clearAuthToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void restoreSession();

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === 'admin',
      hasWorkflowRole: (role) => Boolean(user && (user.role === 'admin' || user.workflowRoles.includes(role))),
      login: async (payload) => {
        const response = await api.login(payload);
        setAuthToken(response.token);
        setUser(response.user);
      },
      logout: async () => {
        try {
          if (getAuthToken()) {
            await api.logout();
          }
        } catch {
          // Ignore logout transport errors and clear the local session anyway.
        } finally {
          clearAuthToken();
          setUser(null);
        }
      },
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
