import axios, { type AxiosRequestConfig } from 'axios';

import type { AuthResponse, DashboardData, Order, Payout, User } from '../types/api';

export const TOKEN_STORAGE_KEY = 'mini_token';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api/v1' });

export function getTelegramInitData(): string {
  const initData =
    ((window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData || '').trim();
  return initData || '123456789';
}

export async function telegramLogin(): Promise<string> {
  const { data } = await api.post<AuthResponse>('/auth/telegram', { init_data: getTelegramInitData() });
  return data.tokens.access_token;
}

function withAuth(token: string): AxiosRequestConfig {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export async function fetchDashboard(token: string): Promise<DashboardData> {
  const auth = withAuth(token);
  const [ordersRes, payoutsRes, meRes] = await Promise.all([
    api.get<Order[]>('/orders', auth),
    api.get<Payout[]>('/payouts', auth).catch(() => ({ data: [] as Payout[] })),
    api.get<User>('/users/me', auth),
  ]);

  return {
    orders: ordersRes.data,
    payouts: payoutsRes.data,
    me: meRes.data,
  };
}
