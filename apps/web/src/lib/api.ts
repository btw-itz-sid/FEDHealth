// ============================================
// FedHealth — API Client
// ============================================
// Typed HTTP client for the FedHealth backend API.
// Used by both web and mobile (conceptually).

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('fedhealth_token', token);
    } else {
      localStorage.removeItem('fedhealth_token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('fedhealth_token');
    }
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {}, signal } = options;

    const requestHeaders: Record<string, string> = {
      ...headers,
    };

    const token = this.getToken();
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    if (body && !(body instanceof FormData)) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      const err = new Error(
        Array.isArray(error.message) ? error.message.join(', ') : error.message
      ) as any;
      err.statusCode = response.status;
      err.response = error;
      throw err;
    }

    return response.json();
  }

  // ---- Auth ----
  async register(data: { email: string; password: string; firstName: string; lastName: string; role?: string }) {
    return this.request<{ user: any; accessToken: string }>('/auth/register', {
      method: 'POST',
      body: data,
    });
  }

  async login(data: { email: string; password: string }) {
    return this.request<{ user: any; accessToken: string }>('/auth/login', {
      method: 'POST',
      body: data,
    });
  }

  async getProfile() {
    return this.request<any>('/auth/users/me');
  }

  // ---- Predictions ----
  async createPrediction(data: any) {
    return this.request<any>('/predictions', { method: 'POST', body: data });
  }

  async getPredictions(page = 1, limit = 20) {
    return this.request<any>(`/predictions?page=${page}&limit=${limit}`);
  }

  async getPrediction(id: string) {
    return this.request<any>(`/predictions/${id}`);
  }

  // ---- Datasets ----
  async uploadDataset(file: File, name: string, description: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    formData.append('description', description);
    return this.request<any>('/datasets', { method: 'POST', body: formData });
  }

  async getDatasets(page = 1, limit = 20) {
    return this.request<any>(`/datasets?page=${page}&limit=${limit}`);
  }

  async getDataset(id: string) {
    return this.request<any>(`/datasets/${id}`);
  }

  async getDatasetValidation(id: string) {
    return this.request<any>(`/datasets/${id}/validation`);
  }

  // ---- Experiments ----
  async createExperiment(data: any) {
    return this.request<any>('/experiments', { method: 'POST', body: data });
  }

  async getExperiments(page = 1, limit = 20, filters?: { status?: string; trainingMethod?: string }) {
    let url = `/experiments?page=${page}&limit=${limit}`;
    if (filters?.status) url += `&status=${filters.status}`;
    if (filters?.trainingMethod) url += `&trainingMethod=${filters.trainingMethod}`;
    return this.request<any>(url);
  }

  async getExperiment(id: string) {
    return this.request<any>(`/experiments/${id}`);
  }

  async getExperimentMetrics(id: string) {
    return this.request<any>(`/experiments/${id}/metrics`);
  }

  async getExperimentRounds(id: string) {
    return this.request<any>(`/experiments/${id}/rounds`);
  }

  async cancelExperiment(id: string) {
    return this.request<any>(`/experiments/${id}/cancel`, { method: 'POST' });
  }

  // ---- Models ----
  async getModels(page = 1, limit = 20) {
    return this.request<any>(`/models?page=${page}&limit=${limit}`);
  }

  async getModel(id: string) {
    return this.request<any>(`/models/${id}`);
  }

  // ---- Admin ----
  async getAuditLogs(page = 1, limit = 50) {
    return this.request<any>(`/audit-logs?page=${page}&limit=${limit}`);
  }

  async getUsers(page = 1, limit = 20) {
    return this.request<any>(`/users?page=${page}&limit=${limit}`);
  }

  async updateUserRole(userId: string, role: string) {
    return this.request<any>(`/users/${userId}/role`, {
      method: 'PATCH',
      body: { role },
    });
  }
}

export const api = new ApiClient();
export default api;
