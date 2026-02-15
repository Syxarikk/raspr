import type {
  ApiAuthResponse,
  ApiOrder,
  ApiPayout,
  ApiUser,
} from '../../../../packages/api-client/src/types';

export type Tab = 'orders' | 'payouts' | 'profile';

export type Order = ApiOrder;
export type Payout = ApiPayout;
export type User = ApiUser;
export type AuthResponse = ApiAuthResponse;

export interface DashboardData {
  orders: Order[];
  payouts: Payout[];
  me: User;
}
