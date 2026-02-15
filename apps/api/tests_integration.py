import os
import tempfile
from datetime import datetime
from pathlib import Path

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("REFRESH_SECRET_KEY", "test-refresh-secret")
os.environ.setdefault("DATABASE_URL", f"sqlite+pysqlite:///{Path(tempfile.gettempdir()) / 'adcontrol-api-integration.sqlite3'}")
os.environ.setdefault("CORS_ALLOW_ORIGINS", "http://localhost")
os.environ.setdefault("ALLOW_TELEGRAM_MOCK", "true")
os.environ.setdefault("REFRESH_COOKIE_SECURE", "false")

from fastapi.testclient import TestClient

from app.auth import get_password_hash
from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import Address, Role, User, WorkType, Workspace


def _reset_db() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def _create_user(
    *,
    workspace_id: int,
    role: Role,
    full_name: str,
    username: str,
    password: str,
    telegram_id: int | None = None,
) -> User:
    return User(
        workspace_id=workspace_id,
        role=role,
        full_name=full_name,
        username=username,
        phone=None,
        telegram_id=telegram_id,
        is_ready=True,
        suspicious_note=None,
        password_hash=get_password_hash(password),
    )


def test_auth_refresh_lifecycle():
    _reset_db()
    db = SessionLocal()
    try:
        ws = Workspace(name="WS auth")
        db.add(ws)
        db.flush()
        db.add(
            _create_user(
                workspace_id=ws.id,
                role=Role.operator,
                full_name="Operator",
                username="operator",
                password="operator123",
            )
        )
        db.commit()
    finally:
        db.close()

    with TestClient(app) as client:
        login = client.post("/api/v1/auth/login", json={"username": "operator", "password": "operator123"})
        assert login.status_code == 200
        token_1 = login.json()["tokens"]["refresh_token"]
        assert token_1

        refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": token_1})
        assert refresh.status_code == 200
        token_2 = refresh.json()["tokens"]["refresh_token"]
        assert token_2
        assert token_2 != token_1

        logout = client.post("/api/v1/auth/logout", json={"refresh_token": token_2})
        assert logout.status_code == 200
        assert logout.json() == {"ok": True}

        refresh_after_logout = client.post("/api/v1/auth/refresh", json={"refresh_token": token_2})
        assert refresh_after_logout.status_code == 401


def test_create_order_denies_foreign_workspace_promoter():
    _reset_db()
    db = SessionLocal()
    operator_username = "operator1"
    operator_password = "operator123"
    try:
        ws1 = Workspace(name="WS1")
        ws2 = Workspace(name="WS2")
        db.add_all([ws1, ws2])
        db.flush()

        operator = _create_user(
            workspace_id=ws1.id,
            role=Role.operator,
            full_name="Operator",
            username="operator1",
            password="operator123",
        )
        promoter1 = _create_user(
            workspace_id=ws1.id,
            role=Role.promoter,
            full_name="Promoter1",
            username="promoter1",
            password="promoter123",
            telegram_id=1001,
        )
        promoter2 = _create_user(
            workspace_id=ws2.id,
            role=Role.promoter,
            full_name="Promoter2",
            username="promoter2",
            password="promoter456",
            telegram_id=2002,
        )
        db.add_all([operator, promoter1, promoter2])
        db.flush()

        addr1 = Address(workspace_id=ws1.id, district=None, street="Main", building="1", lat=None, lng=None, comment=None)
        wt1 = WorkType(workspace_id=ws1.id, name="Flyer", price_per_unit=10, is_active=True)
        db.add_all([addr1, wt1])
        db.commit()
        promoter2_id = promoter2.id
        addr1_id = addr1.id
        wt1_id = wt1.id
    finally:
        db.close()

    with TestClient(app) as client:
        login = client.post("/api/v1/auth/login", json={"username": operator_username, "password": operator_password})
        token = login.json()["tokens"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        payload = {
            "title": "Cross workspace promoter",
            "promoter_id": promoter2_id,
            "comment": None,
            "deadline_at": datetime.utcnow().isoformat(),
            "status": "Draft",
            "items": [{"address_id": addr1_id, "work_type_ids": [wt1_id], "comment": None}],
        }
        response = client.post("/api/v1/orders", json=payload, headers=headers)
        assert response.status_code == 404
        assert response.json()["detail"] == "Promoter not found"


def test_create_order_denies_foreign_workspace_addresses_and_work_types():
    _reset_db()
    db = SessionLocal()
    operator_username = "operator2"
    operator_password = "operator123"
    try:
        ws1 = Workspace(name="WS1b")
        ws2 = Workspace(name="WS2b")
        db.add_all([ws1, ws2])
        db.flush()

        operator = _create_user(
            workspace_id=ws1.id,
            role=Role.operator,
            full_name="Operator",
            username="operator2",
            password="operator123",
        )
        promoter = _create_user(
            workspace_id=ws1.id,
            role=Role.promoter,
            full_name="Promoter",
            username="promoter3",
            password="promoter123",
            telegram_id=3003,
        )
        db.add_all([operator, promoter])
        db.flush()

        addr1 = Address(workspace_id=ws1.id, district=None, street="Main", building="1", lat=None, lng=None, comment=None)
        wt1 = WorkType(workspace_id=ws1.id, name="Flyer", price_per_unit=10, is_active=True)
        addr2 = Address(workspace_id=ws2.id, district=None, street="Side", building="2", lat=None, lng=None, comment=None)
        wt2 = WorkType(workspace_id=ws2.id, name="Poster", price_per_unit=20, is_active=True)
        db.add_all([addr1, wt1, addr2, wt2])
        db.commit()
        promoter_id = promoter.id
        addr1_id = addr1.id
        addr2_id = addr2.id
        wt1_id = wt1.id
        wt2_id = wt2.id
    finally:
        db.close()

    with TestClient(app) as client:
        login = client.post("/api/v1/auth/login", json={"username": operator_username, "password": operator_password})
        token = login.json()["tokens"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        payload_with_foreign_address = {
            "title": "Cross workspace address",
            "promoter_id": promoter_id,
            "comment": None,
            "deadline_at": None,
            "status": "Draft",
            "items": [{"address_id": addr2_id, "work_type_ids": [wt1_id], "comment": None}],
        }
        foreign_address_response = client.post("/api/v1/orders", json=payload_with_foreign_address, headers=headers)
        assert foreign_address_response.status_code == 422
        assert foreign_address_response.json()["detail"] == "one or more addresses do not belong to workspace"

        payload_with_foreign_work_type = {
            "title": "Cross workspace worktype",
            "promoter_id": promoter_id,
            "comment": None,
            "deadline_at": None,
            "status": "Draft",
            "items": [{"address_id": addr1_id, "work_type_ids": [wt2_id], "comment": None}],
        }
        foreign_work_type_response = client.post("/api/v1/orders", json=payload_with_foreign_work_type, headers=headers)
        assert foreign_work_type_response.status_code == 422
        assert foreign_work_type_response.json()["detail"] == "one or more work_types do not belong to workspace"
