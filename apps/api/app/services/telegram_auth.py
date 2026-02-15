from __future__ import annotations

import hashlib
import hmac
import json
from urllib.parse import parse_qsl

from fastapi import HTTPException

from ..config import settings


def validate_and_extract_telegram_user_id(init_data: str) -> int:
    payload = (init_data or "").strip()
    if not payload:
        raise HTTPException(status_code=401, detail="telegram init_data is required")

    if settings.allow_telegram_mock and payload.isdigit():
        return int(payload)

    pairs = dict(parse_qsl(payload, keep_blank_values=True))
    hash_value = pairs.pop("hash", None)
    if not hash_value:
        raise HTTPException(status_code=401, detail="telegram init_data hash is missing")

    if not settings.telegram_bot_token:
        raise HTTPException(status_code=500, detail="telegram auth is not configured")

    data_check_string = "\n".join(f"{k}={pairs[k]}" for k in sorted(pairs))
    secret_key = hmac.new(b"WebAppData", settings.telegram_bot_token.encode("utf-8"), hashlib.sha256).digest()
    calculated_hash = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(calculated_hash, hash_value):
        raise HTTPException(status_code=401, detail="telegram init_data is invalid")

    user_raw = pairs.get("user")
    if not user_raw:
        raise HTTPException(status_code=401, detail="telegram user payload is missing")

    try:
        user_data = json.loads(user_raw)
        user_id = int(user_data["id"])
    except (KeyError, ValueError, TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=401, detail="telegram user payload is invalid")

    return user_id
