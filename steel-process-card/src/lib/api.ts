import type {
  BatchExportRequest,
  DepartmentOption,
  LoginRequest,
  LoginResponse,
  OperationDefinition,
  ProcessCardListFilters,
  ProcessCardListItem,
  ProcessCardPayload,
} from '../../shared/types';
import { clearAuthToken, getAuthToken } from './auth-store';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(init?.headers ?? {});

  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${input}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const message = await response.text();

    if (response.status === 401 && typeof window !== 'undefined') {
      clearAuthToken();
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    throw new Error(message || '请求失败');
  }

  return response.json() as Promise<T>;
}

export const api = {
  login: async (payload: LoginRequest) =>
    request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getCurrentUser: async () => request<{ user: LoginResponse['user'] }>('/api/auth/me'),

  logout: async () =>
    request<{ success: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),

  getOperationDefinitions: async () =>
    request<{ items: OperationDefinition[] }>('/api/meta/operations'),

  getDepartmentOptions: async () =>
    request<{ items: DepartmentOption[] }>('/api/meta/departments'),

  saveDepartmentOptions: async (payload: DepartmentOption[]) =>
    request<{ items: DepartmentOption[] }>('/api/meta/departments', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  listProcessCards: async (filters: ProcessCardListFilters) => {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
      if (value?.trim()) {
        query.set(key, value.trim());
      }
    }

    return request<{ items: ProcessCardListItem[] }>(
      `/api/process-cards${query.size > 0 ? `?${query.toString()}` : ''}`,
    );
  },

  getProcessCard: async (id: string) => request<ProcessCardPayload>(`/api/process-cards/${id}`),

  createProcessCard: async (payload: ProcessCardPayload) =>
    request<ProcessCardPayload>('/api/process-cards', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateProcessCard: async (id: string, payload: ProcessCardPayload) =>
    request<ProcessCardPayload>(`/api/process-cards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteProcessCard: async (id: string) =>
    request<{ success: boolean }>(`/api/process-cards/${id}`, {
      method: 'DELETE',
    }),

  batchExport: async (payload: BatchExportRequest) =>
    request<{ items: Array<{ id: string; planNumber: string; printUrl: string; exportHint: string }> }>(
      '/api/process-cards/export/batch',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),
};
