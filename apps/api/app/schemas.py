from datetime import datetime
from pydantic import BaseModel

from .models import OrderStatus, PayoutStatus, Role


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginIn(BaseModel):
    username: str
    password: str


class TelegramLoginIn(BaseModel):
    telegram_id: int


class UserOut(BaseModel):
    id: int
    full_name: str
    role: Role
    username: str | None = None
    phone: str | None = None
    is_ready: bool
    suspicious_note: str | None = None

    class Config:
        from_attributes = True


class WorkTypeIn(BaseModel):
    name: str
    price_per_unit: float
    is_active: bool = True


class WorkTypeOut(WorkTypeIn):
    id: int

    class Config:
        from_attributes = True


class AddressIn(BaseModel):
    district: str | None = None
    street: str
    building: str
    lat: float | None = None
    lng: float | None = None
    comment: str | None = None


class AddressOut(AddressIn):
    id: int

    class Config:
        from_attributes = True


class OrderItemCreate(BaseModel):
    address_id: int
    work_type_ids: list[int]
    comment: str | None = None


class OrderCreate(BaseModel):
    title: str
    promoter_id: int
    comment: str | None = None
    deadline_at: datetime | None = None
    status: OrderStatus = OrderStatus.draft
    items: list[OrderItemCreate]


class PhotoReviewIn(BaseModel):
    status: str
    reject_reason: str | None = None


class OrderStatusIn(BaseModel):
    status: OrderStatus


class PayoutOut(BaseModel):
    order_id: int
    amount_preliminary: float
    amount_final: float
    status: PayoutStatus

    class Config:
        from_attributes = True
