import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Role(str, enum.Enum):
    operator = "operator"
    promoter = "promoter"


class OrderStatus(str, enum.Enum):
    draft = "Draft"
    assigned = "Assigned"
    in_progress = "InProgress"
    review = "Review"
    payment = "Payment"
    completed = "Completed"


class PhotoStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class PayoutStatus(str, enum.Enum):
    review = "on_review"
    to_pay = "to_pay"
    paid = "paid"


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), index=True)
    role: Mapped[Role] = mapped_column(Enum(Role), index=True)
    full_name: Mapped[str] = mapped_column(String(200))
    username: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    telegram_id: Mapped[int | None] = mapped_column(Integer, nullable=True, unique=True)
    is_ready: Mapped[bool] = mapped_column(Boolean, default=True)
    suspicious_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255))


class WorkType(Base):
    __tablename__ = "work_types"
    __table_args__ = (UniqueConstraint("workspace_id", "name", name="uq_worktype_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    price_per_unit: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Address(Base):
    __tablename__ = "addresses"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), index=True)
    district: Mapped[str | None] = mapped_column(String(120), nullable=True)
    street: Mapped[str] = mapped_column(String(120), index=True)
    building: Mapped[str] = mapped_column(String(40))
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), index=True)
    promoter_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(180))
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.draft, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    items = relationship("OrderItem", cascade="all,delete")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    address_id: Mapped[int] = mapped_column(ForeignKey("addresses.id"), index=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)


class OrderItemWorkType(Base):
    __tablename__ = "order_item_work_types"
    __table_args__ = (UniqueConstraint("order_item_id", "work_type_id", name="uq_order_item_worktype"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    order_item_id: Mapped[int] = mapped_column(ForeignKey("order_items.id", ondelete="CASCADE"), index=True)
    work_type_id: Mapped[int] = mapped_column(ForeignKey("work_types.id"), index=True)


class Photo(Base):
    __tablename__ = "photos"
    __table_args__ = (UniqueConstraint("workspace_id", "sha256_hash", name="uq_photo_hash"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), index=True)
    order_item_id: Mapped[int] = mapped_column(ForeignKey("order_items.id"), index=True)
    work_type_id: Mapped[int] = mapped_column(ForeignKey("work_types.id"), index=True)
    uploader_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    file_path: Mapped[str] = mapped_column(String(255))
    sha256_hash: Mapped[str] = mapped_column(String(64), index=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    geo_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    geo_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[PhotoStatus] = mapped_column(Enum(PhotoStatus), default=PhotoStatus.pending)
    reject_reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class Payout(Base):
    __tablename__ = "payouts"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    promoter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    amount_preliminary: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    amount_final: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    status: Mapped[PayoutStatus] = mapped_column(Enum(PayoutStatus), default=PayoutStatus.review)
