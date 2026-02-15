import os

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("REFRESH_SECRET_KEY", "test-refresh-secret")
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("CORS_ALLOW_ORIGINS", "http://localhost")

from fastapi.testclient import TestClient

from app.main import app


def test_health():
    client = TestClient(app)
    resp = client.get('/api/v1/health')
    assert resp.status_code == 200
    assert resp.json()['status'] == 'ok'


def test_metrics():
    client = TestClient(app)
    client.get('/api/v1/health')

    resp = client.get('/api/v1/metrics')
    assert resp.status_code == 200

    payload = resp.json()
    assert payload["requests_total"] >= 1
    assert "status_counts" in payload
    assert isinstance(payload["top_paths"], list)
