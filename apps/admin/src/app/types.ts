import type { SvgIconProps } from '@mui/material';
import type { ComponentType } from 'react';
import type {
  ApiAddress as SharedApiAddress,
  ApiOrder as SharedApiOrder,
  ApiOrderCreatePayload as SharedApiOrderCreatePayload,
  ApiOrderDetail as SharedApiOrderDetail,
  ApiOrderStatus as SharedApiOrderStatus,
  ApiPayout as SharedApiPayout,
  ApiPhoto as SharedApiPhoto,
  ApiUser as SharedApiUser,
  ApiWorkType as SharedApiWorkType,
} from '../../../../packages/api-client/src/types';

export type MenuKey = 'analytics' | 'addresses' | 'orders' | 'employees' | 'types' | 'guides';
export type MarkerTone = 'blue' | 'green' | 'yellow';
export type OrderStatus = SharedApiOrderStatus;
export type OrderTabKey = 'todo' | 'waiting' | 'draft' | 'archive';
export type NoticeType = 'ok' | 'error';
export type PhotoReviewStatus = 'accepted' | 'rejected';

export type IconComponent = ComponentType<SvgIconProps>;

export type ApiOrder = SharedApiOrder;
export type ApiOrderDetail = SharedApiOrderDetail;
export type ApiAddress = SharedApiAddress;
export type ApiUser = SharedApiUser;
export type ApiWorkType = SharedApiWorkType;
export type ApiPayout = Omit<SharedApiPayout, 'amount_preliminary' | 'amount_final'> & {
  amount_preliminary: number | string;
  amount_final: number | string;
};
export type ApiPhoto = SharedApiPhoto;

export interface PhotoPreview extends ApiPhoto {
  previewUrl: string | null;
}

export interface Marker {
  id: string;
  label: string;
  tone: MarkerTone;
  lat: number;
  lng: number;
}

export interface StreetGroup {
  district: string;
  street: string;
  addresses: ApiAddress[];
}

export interface MenuItem {
  key: MenuKey;
  label: string;
  icon: IconComponent;
}

export interface Notice {
  type: NoticeType;
  text: string;
}

export interface AddressCreatePayload {
  district?: string | null;
  street: string;
  building: string;
  lat?: number | null;
  lng?: number | null;
  comment?: string | null;
}

export type OrderCreatePayload = SharedApiOrderCreatePayload;
export type WorkTypeCreatePayload = Omit<ApiWorkType, 'id'>;
