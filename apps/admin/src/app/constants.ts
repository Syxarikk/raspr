import CampaignOutlined from '@mui/icons-material/CampaignOutlined';
import DashboardRounded from '@mui/icons-material/DashboardRounded';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';

import type { MarkerTone, MenuItem, OrderStatus, OrderTabKey } from './types';

export const MENU_ITEMS: MenuItem[] = [
  { key: 'analytics', label: 'Аналитика', icon: DashboardRounded },
  { key: 'addresses', label: 'Адреса', icon: LocationOnOutlined },
  { key: 'orders', label: 'Наряды', icon: DescriptionOutlined },
  { key: 'employees', label: 'Исполнители', icon: GroupsOutlined },
  { key: 'types', label: 'Типы рекламы', icon: CampaignOutlined },
  { key: 'guides', label: 'Гайды', icon: MenuBookOutlined },
];

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; className: string; tone: MarkerTone }> = {
  Draft: { label: 'Черновик', className: 'is-draft', tone: 'blue' },
  Assigned: { label: 'Назначен', className: 'is-assigned', tone: 'yellow' },
  InProgress: { label: 'В работе', className: 'is-progress', tone: 'blue' },
  Review: { label: 'Проверка', className: 'is-review', tone: 'yellow' },
  Payment: { label: 'К оплате', className: 'is-payment', tone: 'green' },
  Completed: { label: 'Архив', className: 'is-completed', tone: 'green' },
};

export const ORDER_STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: 'Draft', label: 'Черновик' },
  { value: 'Assigned', label: 'Назначен' },
  { value: 'InProgress', label: 'В работе' },
  { value: 'Review', label: 'Проверка' },
  { value: 'Payment', label: 'К оплате' },
  { value: 'Completed', label: 'Архив' },
];

export const ORDER_TABS: Array<{ key: OrderTabKey; label: string; statuses: OrderStatus[] }> = [
  { key: 'todo', label: 'Сделать', statuses: ['InProgress', 'Review'] },
  { key: 'waiting', label: 'Ожидаем', statuses: ['Assigned', 'Payment'] },
  { key: 'draft', label: 'Черновик', statuses: ['Draft'] },
  { key: 'archive', label: 'Архив', statuses: ['Completed'] },
];

export const PODOLSK_CENTER: [number, number] = [55.4297, 37.5443];
