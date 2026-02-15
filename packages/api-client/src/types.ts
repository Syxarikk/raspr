import type { components } from './generated';

export type ApiRole = components['schemas']['Role'];
export type ApiOrderStatus = components['schemas']['OrderStatus'];
export type ApiPayoutStatus = components['schemas']['PayoutStatus'];

export interface ApiHealthResponse {
  status: 'ok';
}

export type ApiAuthTokens = components['schemas']['TokenOut'];
export type ApiUser = components['schemas']['UserOut'];
export type ApiAuthResponse = components['schemas']['AuthOut'];
export type ApiPromoterAvailabilityIn = components['schemas']['PromoterAvailabilityIn'];

export type ApiAddress = components['schemas']['AddressOut'];
export type ApiWorkType = components['schemas']['WorkTypeOut'];

export type ApiOrder = components['schemas']['OrderOut'];
export type ApiOrderDetail = components['schemas']['OrderDetailOut'];
export type ApiOrderCreatePayload = components['schemas']['OrderCreate'];
export type ApiOrderCreateItem = components['schemas']['OrderItemCreate'];

export type ApiPayout = components['schemas']['PayoutOut'];
export type ApiPhoto = components['schemas']['PhotoOut'];
export type ApiPhotoUploadOut = components['schemas']['PhotoUploadOut'];
