import type {
  BatchExportRequest,
  OperationDefinition,
  ProcessCardListFilters,
  ProcessCardListItem,
  ProcessCardPayload,
} from '../../shared/types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${input}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || '请求失败');
  }

  return response.json() as Promise<T>;
}

export const api = {
  getOperationDefinitions: async () =>
    request<{ items: OperationDefinition[] }>('/api/meta/operations'),

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
