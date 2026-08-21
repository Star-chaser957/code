import type {
  ApprovalActionRequest,
  AuditLogEntry,
  AuditLogFilters,
  BatchExportRequest,
  DashboardOverview,
  DepartmentOption,
  LoginRequest,
  LoginResponse,
  NextPendingApprovalResponse,
  OperationDefinition,
  ProcessCardListFilters,
  ProcessCardListResponse,
  ProcessCardRevisionDiff,
  ProcessCardRevisionRequest,
  ProcessCardPayload,
  ProductionPlanAttachment,
  ProductionPlanCardRelations,
  ProductPrefillCandidate,
  NotificationOverview,
  UserAccount,
  UserAccountCreateRequest,
  UserAccountUpdateRequest,
  UserActiveToggleRequest,
  UserOwnPasswordChangeRequest,
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
    const responseText = await response.text();
    let message = responseText;

    if (responseText) {
      try {
        const parsed = JSON.parse(responseText) as { message?: string };
        if (parsed?.message) {
          message = parsed.message;
        }
      } catch {
        // Ignore JSON parse errors and keep the raw response text.
      }
    }

    if (response.status === 401 && typeof window !== 'undefined') {
      clearAuthToken();
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    throw new Error(message || '请求失败');
  }

  return response.json() as Promise<T>;
}

async function requestBlob(input: string): Promise<Blob> {
  const headers = new Headers();
  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${input}`, { headers });
  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      clearAuthToken();
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    const payload = await response.text();
    throw new Error(payload || '文件读取失败');
  }
  return response.blob();
}

export const api = {
  login: async (payload: LoginRequest) =>
    request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getCurrentUser: async () => request<{ user: LoginResponse['user'] }>('/api/auth/me'),

  getDashboardOverview: async () => request<DashboardOverview>('/api/dashboard/overview'),

  getNotificationOverview: async () =>
    request<NotificationOverview>('/api/dashboard/notifications'),

  markNotificationRead: async (id: string) =>
    request<NotificationOverview>(`/api/dashboard/notifications/${encodeURIComponent(id)}/read`, {
      method: 'POST',
    }),

  markAllNotificationsRead: async () =>
    request<NotificationOverview>('/api/dashboard/notifications/read-all', {
      method: 'POST',
    }),

  logout: async () =>
    request<{ success: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),

  changeOwnPassword: async (payload: UserOwnPasswordChangeRequest) =>
    request<{ success: boolean }>('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify(payload),
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

  deleteUserAccount: async (id: string) =>
    request<{ items: UserAccount[] }>(`/api/admin/users/${id}`, {
      method: 'DELETE',
    }),

  listAuditLogs: async (filters: AuditLogFilters) => {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
      const normalized = value === undefined || value === null ? '' : String(value).trim();
      if (normalized) {
        query.set(key, normalized);
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
      const normalized = value === undefined || value === null ? '' : String(value).trim();
      if (normalized) {
        query.set(key, normalized);
      }
    }

    return request<ProcessCardListResponse>(
      `/api/process-cards${query.size > 0 ? `?${query.toString()}` : ''}`,
    );
  },

  getProcessCard: async (id: string) => request<ProcessCardPayload>(`/api/process-cards/${id}`),

  getCardProductionPlan: async (id: string) =>
    request<{ item: ProductionPlanAttachment | null }>(`/api/process-cards/${id}/production-plan`),

  linkProductionPlanToCard: async (cardId: string, productionPlanId: string) =>
    request<{ item: ProductionPlanAttachment | null }>(`/api/process-cards/${cardId}/production-plan`, {
      method: 'PUT',
      body: JSON.stringify({ productionPlanId }),
    }),

  listProductionPlans: async (keyword = '') =>
    request<{ items: ProductionPlanAttachment[] }>(
      `/api/production-plans${keyword.trim() ? `?keyword=${encodeURIComponent(keyword.trim())}` : ''}`,
    ),

  matchProductionPlan: async (planNumber: string) =>
    request<{ item: ProductionPlanAttachment | null }>(
      `/api/production-plans/match?planNumber=${encodeURIComponent(planNumber.trim())}`,
    ),

  getProductionPlanContent: async (id: string) =>
    requestBlob(`/api/production-plans/${id}/content`),

  uploadProductionPlan: async (planNumber: string, file: File, id?: string) =>
    request<{ item: ProductionPlanAttachment }>(
      id ? `/api/production-plans/${id}/file` : '/api/production-plans',
      {
      method: id ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name),
        'X-File-Type': file.type,
        'X-Plan-Number': encodeURIComponent(planNumber),
      },
      body: file,
    }),

  getProductionPlanCards: async (id: string) =>
    request<ProductionPlanCardRelations>(`/api/production-plans/${id}/cards`),

  deleteProductionPlan: async (id: string) =>
    request<{ success: boolean }>(`/api/production-plans/${id}`, { method: 'DELETE' }),

  getProcessCardPrefills: async (filters: { customerCode: string; productName: string }) => {
    const query = new URLSearchParams();
    if (filters.customerCode.trim()) {
      query.set('customerCode', filters.customerCode.trim());
    }
    if (filters.productName.trim()) {
      query.set('productName', filters.productName.trim());
    }
    return request<{ items: ProductPrefillCandidate[] }>(
      `/api/process-cards/prefill?${query.toString()}`,
    );
  },

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

  getNextPendingWorkflowTask: async (step: 'review' | 'approve', excludeId: string) =>
    request<NextPendingApprovalResponse>(
      `/api/process-cards/workflow/next-task?step=${step}&excludeId=${encodeURIComponent(excludeId)}`,
    ),

  createProcessCardRevision: async (id: string, payload: ProcessCardRevisionRequest) =>
    request<ProcessCardPayload>(`/api/process-cards/${id}/revisions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getProcessCardRevisionDiff: async (id: string) =>
    request<ProcessCardRevisionDiff | null>(`/api/process-cards/${id}/revision-diff`),

  deleteProcessCard: async (id: string) =>
    request<{ success: boolean }>(`/api/process-cards/${id}`, {
      method: 'DELETE',
    }),

  voidProcessCard: async (id: string) =>
    request<ProcessCardPayload>(`/api/process-cards/${id}/void`, {
      method: 'POST',
    }),

  forceDeleteProcessCard: async (id: string) =>
    request<{ success: boolean }>(`/api/process-cards/${id}/force`, {
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
