// ============================================
// FedHealth Mobile — API Client
// ============================================
import * as SecureStore from 'expo-secure-store';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3001/api/v1';

class MobileApiClient {
  private token: string | null = null;

  async setToken(token: string | null) {
    this.token = token;
    if (token) {
      await SecureStore.setItemAsync('fedhealth_token', token);
    } else {
      await SecureStore.deleteItemAsync('fedhealth_token');
    }
  }

  async getToken(): Promise<string | null> {
    if (!this.token) {
      this.token = await SecureStore.getItemAsync('fedhealth_token');
    }
    return this.token;
  }

  private async request<T>(endpoint: string, options: {
    method?: string;
    body?: any;
  } = {}): Promise<T> {
    const { method = 'GET', body } = options;
    const headers: Record<string, string> = {};

    const token = await this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(Array.isArray(error.message) ? error.message.join(', ') : error.message);
    }

    return response.json();
  }

  async login(email: string, password: string) {
    const result = await this.request<{ user: any; accessToken: string }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    await this.setToken(result.accessToken);
    return result;
  }

  async register(data: { email: string; password: string; firstName: string; lastName: string }) {
    const result = await this.request<{ user: any; accessToken: string }>('/auth/register', {
      method: 'POST',
      body: { ...data, role: 'patient' },
    });
    await this.setToken(result.accessToken);
    return result;
  }

  async getProfile() {
    return this.request<any>('/auth/users/me');
  }

  async logout() {
    await this.setToken(null);
  }

  async createPrediction(input: {
    Pregnancies: number; Glucose: number; BloodPressure: number;
    SkinThickness: number; Insulin: number; BMI: number;
    DiabetesPedigreeFunction: number; Age: number;
  }) {
    return this.request<any>('/predictions', { method: 'POST', body: input });
  }

  async getPredictions(page = 1) {
    return this.request<any>(`/predictions?page=${page}&limit=20`);
  }

  async getPrediction(id: string) {
    return this.request<any>(`/predictions/${id}`);
  }
}

export const mobileApi = new MobileApiClient();
export default mobileApi;
