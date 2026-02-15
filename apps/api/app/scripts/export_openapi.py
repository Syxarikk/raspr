from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def _prepare_import_path() -> None:
    api_root = Path(__file__).resolve().parents[2]
    if str(api_root) not in sys.path:
        sys.path.insert(0, str(api_root))


def _set_default_env() -> None:
    os.environ.setdefault("SECRET_KEY", "openapi-access-secret")
    os.environ.setdefault("REFRESH_SECRET_KEY", "openapi-refresh-secret")
    os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    os.environ.setdefault("CORS_ALLOW_ORIGINS", "http://localhost")
    os.environ.setdefault("ALLOW_TELEGRAM_MOCK", "true")


def main() -> None:
    output_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("openapi.json")

    _prepare_import_path()
    _set_default_env()

    from app.main import app

    schema = app.openapi()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(schema, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OpenAPI schema exported to {output_path}")


if __name__ == "__main__":
    main()
