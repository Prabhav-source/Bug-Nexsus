import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('bugnexus_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const ws = localStorage.getItem('bugnexus_workspace');
  if (ws && config.headers) {
    config.headers['X-Workspace-Id'] = ws;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('bugnexus_token');
      localStorage.removeItem('bugnexus_workspace');
      if (onUnauthorized) onUnauthorized();
    }
    return Promise.reject(error);
  },
);

export interface ApiError {
  code: string;
  message: string;
  details?: { path: string; message: string }[];
}

export function extractError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: ApiError } | undefined;
    if (data?.error?.message) return data.error.message;
    return err.message;
  }
  return err instanceof Error ? err.message : 'An unexpected error occurred';
}

export default api;
