export function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    Draft: 'Черновик',
    Assigned: 'Назначен',
    InProgress: 'В работе',
    Review: 'Проверка',
    Payment: 'К оплате',
    Completed: 'Завершён',
    on_review: 'На проверке',
    to_pay: 'К оплате',
    paid: 'Оплачен',
  };
  return statusMap[status] || status;
}

export function getStatusClass(status: string): string {
  const normalized = status.toLowerCase().replace('_', '-');
  return `status-${normalized}`;
}

export function formatMoney(value: number | string): string {
  const num = typeof value === 'number' ? value : parseFloat(value);
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(num);
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
