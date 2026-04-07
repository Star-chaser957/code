import type {
  ApprovalActionRequest,
  AuditLogEntry,
  AuditLogFilters,
  BatchExportRequest,
  DepartmentOption,
  LoginRequest,
  LoginResponse,
  OperationDefinition,
  ProcessCardListFilters,
  ProcessCardListItem,
  ProcessCardPayload,
  ProductPrefillCandidate,
  UserAccount,
  UserAccountCreateRequest,
  UserAccountUpdateRequest,
  UserActiveToggleRequest,
  UserPasswordResetRequest,
  UserSummary,
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

  getUsers: async () => request<{ items: UserSummary[] }>('/api/meta/users'),

  getUserAccounts: async () => request<{ items: UserAccount[] }>('/api/admin/users'),

  createUserAccount: async (payload: UserAccountCreateRequest) =>
    request<{ items: UserAccount[] }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateUserAccount: async (id: string, payload: UserAccountUpdateRequest) =>
    request<{ items: UserAccount[] }>(`/api/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  resetUserPassword: async (id: string, payload: UserPasswordResetRequest) =>
    request<{ success: boolean }>(`/api/admin/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  setUserActive: async (id: string, payload: UserActiveToggleRequest) =>
    request<{ items: UserAccount[] }>(`/api/admin/users/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  listAuditLogs: async (filters: AuditLogFilters) => {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
      if (value?.trim()) {
        query.set(key, value.trim());
      }
    }

    return request<{ items: AuditLogEntry[] }>(
      `/api/admin/audit-logs${query.size > 0 ? `?${query.toString()}` : ''}`,
    );
  },

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

  getProductPrefill: async (productName: string) =>
    request<{ items: ProductPrefillCandidate[] }>(
      `/api/process-cards/prefill/by-product-name?productName=${encodeURIComponent(productName)}`,
    ),

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

  performApprovalAction: async (id: string, payload: ApprovalActionRequest) =>
    request<ProcessCardPayload>(`/api/process-cards/${id}/actions`, {
      method: 'POST',
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
