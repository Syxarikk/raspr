from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import OrderStatus, PayoutStatus, Role


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_in: int


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=255)


class TelegramLoginIn(BaseModel):
    init_data: str = Field(min_length=1)


class RefreshIn(BaseModel):
    refresh_token: str | None = None


class LogoutIn(BaseModel):
    refresh_token: str | None = None


class OkOut(BaseModel):
    ok: bool = True


class IdOut(BaseModel):
    id: int


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    role: Role
    username: str | None = None
    phone: str | None = None
    is_ready: bool
    suspicious_note: str | None = None


class AuthOut(BaseModel):
    tokens: TokenOut
    user: UserOut


class PromoterAvailabilityIn(BaseModel):
    is_ready: bool
    suspicious_note: str | None = None


class WorkTypeIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    price_per_unit: float
    is_active: bool = True


class WorkTypeOut(WorkTypeIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class AddressIn(BaseModel):
    district: str | None = Field(default=None, max_length=120)
    street: str = Field(min_length=1, max_length=120)
    building: str = Field(min_length=1, max_length=40)
    lat: float | None = None
    lng: float | None = None
    comment: str | None = None


class AddressOut(AddressIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class OrderItemCreate(BaseModel):
    address_id: int
    work_type_ids: list[int]
    comment: str | None = None

    @field_validator("work_type_ids")
    @classmethod
    def ensure_work_type_ids_not_empty(cls, value: list[int]) -> list[int]:
        normalized = sorted(set(value))
        if not normalized:
            raise ValueError("work_type_ids cannot be empty")
        return normalized


class OrderCreate(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    promoter_id: int
    comment: str | None = None
    deadline_at: datetime | None = None
    status: OrderStatus = OrderStatus.draft
    items: list[OrderItemCreate]

    @field_validator("items")
    @classmethod
    def ensure_items_not_empty(cls, value: list[OrderItemCreate]) -> list[OrderItemCreate]:
        if not value:
            raise ValueError("items cannot be empty")
        return value


class OrderItemOut(BaseModel):
    id: int
    address_id: int
    work_type_ids: list[int]
    comment: str | None = None


class OrderOut(BaseModel):
    id: int
    title: str
    status: OrderStatus
    promoter_id: int | None
    deadline_at: datetime | None = None
    comment: str | None = None


class OrderDetailOut(BaseModel):
    id: int
    title: str
    status: OrderStatus
    promoter_id: int | None
    items: list[OrderItemOut]


class PhotoReviewStatus(str, Enum):
    accepted = "accepted"
    rejected = "rejected"


class PhotoReviewIn(BaseModel):
    status: PhotoReviewStatus
    reject_reason: str | None = None


class PhotoUploadOut(BaseModel):
    id: int
    uploaded_at: datetime


class PhotoOut(BaseModel):
    id: int
    order_item_id: int
    work_type_id: int
    status: str
    reject_reason: str | None = None
    url: str


class OrderStatusIn(BaseModel):
    status: OrderStatus


class OrderStatusOut(OkOut):
    status: OrderStatus


class PayoutOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    order_id: int
    amount_preliminary: float
    amount_final: float
    status: PayoutStatus


class CsvImportOut(BaseModel):
    imported: int
