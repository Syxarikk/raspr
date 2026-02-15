import os
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("REFRESH_SECRET_KEY", "test-refresh-secret")
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("CORS_ALLOW_ORIGINS", "http://localhost")
os.environ.setdefault("ALLOW_TELEGRAM_MOCK", "true")

from app.models import (  # noqa: E402
    Address,
    Base,
    Order,
    OrderItem,
    OrderItemWorkType,
    OrderStatus,
    Photo,
    PhotoStatus,
    Role,
    User,
    WorkType,
    Workspace,
)
from app.routers.orders import ALLOWED_ORDER_TRANSITIONS, PROMOTER_ALLOWED_TRANSITIONS  # noqa: E402
from app.services.payouts import recalc_payout_for_order  # noqa: E402
from app.services.telegram_auth import validate_and_extract_telegram_user_id  # noqa: E402


def _session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    local = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    return local()


def test_payout_recalc_counts_only_order_photos():
    db = _session()

    ws = Workspace(name="WS")
    db.add(ws)
    db.flush()

    operator = User(
        workspace_id=ws.id,
        role=Role.operator,
        full_name="Operator",
        username="operator",
        phone=None,
        telegram_id=None,
        is_ready=True,
        suspicious_note=None,
        password_hash="x",
    )
    promoter = User(
        workspace_id=ws.id,
        role=Role.promoter,
        full_name="Promoter",
        username="promoter",
        phone=None,
        telegram_id=123,
        is_ready=True,
        suspicious_note=None,
        password_hash="x",
    )
    db.add_all([operator, promoter])
    db.flush()

    wt = WorkType(workspace_id=ws.id, name="Leaflet", price_per_unit=10, is_active=True)
    db.add(wt)
    db.flush()

    addr = Address(workspace_id=ws.id, district=None, street="Main", building="1", lat=None, lng=None, comment=None)
    db.add(addr)
    db.flush()

    order = Order(
        workspace_id=ws.id,
        promoter_id=promoter.id,
        created_by_id=operator.id,
        title="Order",
        comment=None,
        deadline_at=None,
        status=OrderStatus.review,
        created_at=datetime.utcnow(),
    )
    db.add(order)
    db.flush()

    order_item = OrderItem(order_id=order.id, address_id=addr.id, comment=None)
    db.add(order_item)
    db.flush()

    db.add(OrderItemWorkType(order_item_id=order_item.id, work_type_id=wt.id))

    db.add(
        Photo(
            workspace_id=ws.id,
            order_item_id=order_item.id,
            work_type_id=wt.id,
            uploader_id=promoter.id,
            file_path="1/a.jpg",
            sha256_hash="hash1",
            uploaded_at=datetime.utcnow(),
            geo_lat=None,
            geo_lng=None,
            status=PhotoStatus.accepted,
            reject_reason=None,
        )
    )

    # photo from another order should not be included
    other_order = Order(
        workspace_id=ws.id,
        promoter_id=promoter.id,
        created_by_id=operator.id,
        title="Other",
        comment=None,
        deadline_at=None,
        status=OrderStatus.review,
        created_at=datetime.utcnow(),
    )
    db.add(other_order)
    db.flush()
    other_item = OrderItem(order_id=other_order.id, address_id=addr.id, comment=None)
    db.add(other_item)
    db.flush()
    db.add(OrderItemWorkType(order_item_id=other_item.id, work_type_id=wt.id))
    db.add(
        Photo(
            workspace_id=ws.id,
            order_item_id=other_item.id,
            work_type_id=wt.id,
            uploader_id=promoter.id,
            file_path="1/b.jpg",
            sha256_hash="hash2",
            uploaded_at=datetime.utcnow(),
            geo_lat=None,
            geo_lng=None,
            status=PhotoStatus.accepted,
            reject_reason=None,
        )
    )

    db.commit()

    recalc_payout_for_order(db, order)
    db.commit()

    from app.models import Payout

    payout = db.query(Payout).filter(Payout.order_id == order.id).first()
    assert payout is not None
    assert float(payout.amount_preliminary) == 10.0
    assert float(payout.amount_final) == 10.0


def test_order_transition_policies():
    assert OrderStatus.assigned in ALLOWED_ORDER_TRANSITIONS[OrderStatus.draft]
    assert OrderStatus.completed not in ALLOWED_ORDER_TRANSITIONS[OrderStatus.draft]
    assert PROMOTER_ALLOWED_TRANSITIONS[OrderStatus.assigned] == {OrderStatus.in_progress}


def test_telegram_mock_mode():
    assert validate_and_extract_telegram_user_id("123456789") == 123456789
