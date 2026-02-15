import axios from 'axios';

import { ORDER_STATUS_META, PODOLSK_CENTER } from './constants';
import type { ApiAddress, MarkerTone, OrderStatus } from './types';

export function normalizeOrderStatus(status: string): OrderStatus {
  if (status in ORDER_STATUS_META) {
    return status as OrderStatus;
  }
  return 'Draft';
}

export function parseAmount(value: number | string): number {
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);
}

export function initials(name: string): string {
  const chunks = name.trim().split(/\s+/).filter(Boolean);
  if (!chunks.length) {
    return 'U';
  }
  if (chunks.length === 1) {
    return chunks[0].slice(0, 1).toUpperCase();
  }
  return `${chunks[0][0]}${chunks[1][0]}`.toUpperCase();
}

export function byId<T extends { id: number }>(items: T[]): Map<number, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function randomSpread(seed: number): number {
  const raw = Math.sin(seed * 12.9898) * 43758.5453;
  return raw - Math.floor(raw);
}

export function fallbackCoords(seed: number): { lat: number; lng: number } {
  const lat = PODOLSK_CENTER[0] + (randomSpread(seed + 1.7) - 0.5) * 0.08;
  const lng = PODOLSK_CENTER[1] + (randomSpread(seed + 5.9) - 0.5) * 0.16;
  return { lat, lng };
}

export function statusClass(status: string): string {
  const normalized = normalizeOrderStatus(status);
  return ORDER_STATUS_META[normalized].className;
}

export function statusLabel(status: string): string {
  const normalized = normalizeOrderStatus(status);
  return ORDER_STATUS_META[normalized].label;
}

export function orderSectionLabel(status: OrderStatus): string {
  if (status === 'InProgress') return 'В работе';
  if (status === 'Review') return 'Ждут проверки';
  if (status === 'Payment') return 'Ждут оплаты';
  if (status === 'Assigned') return 'Назначено';
  if (status === 'Completed') return 'Закрытые';
  return 'Черновики';
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
  }
  return fallback;
}

export function isAxiosStatus(error: unknown, statuses: number[]): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }
  const status = error.response?.status;
  return typeof status === 'number' && statuses.includes(status);
}

export function buildAddressLabel(address: ApiAddress): string {
  return `${address.street}, ${address.building}`;
}

export function pickFirst<T>(items: T[]): T | null {
  return items.length ? items[0] : null;
}

export function markerToneColor(tone: MarkerTone): string {
  if (tone === 'green') return '#43bc78';
  if (tone === 'yellow') return '#e5b637';
  return '#4c9cff';
}
