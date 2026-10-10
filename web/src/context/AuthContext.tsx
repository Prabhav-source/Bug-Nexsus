import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import api from '../api/client';
import type { User, Workspace } from '../lib/types';

interface AuthState {
  user: User | null;
  token: string | null;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, workspaceName: string) => Promise<void>;
  logout: () => Promise<void>;
  setActiveWorkspace: (ws: Workspace) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('bugnexus_token'));
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      const data = res.data.data;
      setUser(data.user);
      setWorkspaces(data.workspaces);
      const savedWs = localStorage.getItem('bugnexus_workspace');
      const first = data.workspaces.find((w: Workspace) => w.id === savedWs) ?? data.workspaces[0];
      if (first) {
        setActiveWorkspaceState(first);
        localStorage.setItem('bugnexus_workspace', first.id);
      }
    } catch {
      setUser(null);
      setWorkspaces([]);
      setActiveWorkspaceState(null);
      localStorage.removeItem('bugnexus_token');
      localStorage.removeItem('bugnexus_workspace');
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      refreshUser();
    } else {
      setLoading(false);
    }
  }, [token, refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const data = res.data.data;
    localStorage.setItem('bugnexus_token', data.token);
    setToken(data.token);
    setUser(data.user);
    if (data.workspace) {
      setWorkspaces([data.workspace]);
      setActiveWorkspaceState(data.workspace);
      localStorage.setItem('bugnexus_workspace', data.workspace.id);
    }
    await refreshUser();
  }, [refreshUser]);

  const register = useCallback(async (name: string, email: string, password: string, workspaceName: string) => {
    const res = await api.post('/auth/register', { name, email, password, workspaceName });
    const data = res.data.data;
    localStorage.setItem('bugnexus_token', data.token);
    setToken(data.token);
    setUser(data.user);
    if (data.workspace) {
      setWorkspaces([data.workspace]);
      setActiveWorkspaceState(data.workspace);
      localStorage.setItem('bugnexus_workspace', data.workspace.id);
    }
    await refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    localStorage.removeItem('bugnexus_token');
    localStorage.removeItem('bugnexus_workspace');
    setToken(null);
    setUser(null);
    setWorkspaces([]);
    setActiveWorkspaceState(null);
  }, []);

  const setActiveWorkspace = useCallback((ws: Workspace) => {
    setActiveWorkspaceState(ws);
    localStorage.setItem('bugnexus_workspace', ws.id);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        workspaces,
        activeWorkspace,
        loading,
        login,
        register,
        logout,
        setActiveWorkspace,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
