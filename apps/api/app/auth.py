from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _create_token(data: dict, expires_delta: timedelta, secret: str, token_type: str, token_id: str | None = None) -> tuple[str, datetime]:
    expires_at = datetime.utcnow() + expires_delta
    payload = data.copy()
    payload.update({"exp": expires_at, "type": token_type})
    if token_id:
        payload["jti"] = token_id
    encoded = jwt.encode(payload, secret, algorithm=settings.jwt_algorithm)
    return encoded, expires_at


def create_access_token(user_id: int) -> tuple[str, datetime]:
    return _create_token(
        {"sub": str(user_id)},
        timedelta(minutes=settings.access_token_expire_minutes),
        settings.secret_key,
        ACCESS_TOKEN_TYPE,
    )


def create_refresh_token(user_id: int) -> tuple[str, str, datetime]:
    token_id = str(uuid.uuid4())
    token, expires_at = _create_token(
        {"sub": str(user_id)},
        timedelta(days=settings.refresh_token_expire_days),
        settings.refresh_secret_key,
        REFRESH_TOKEN_TYPE,
        token_id=token_id,
    )
    return token, token_id, expires_at


def decode_access_token(token: str) -> dict:
    return _decode_token(token, settings.secret_key, ACCESS_TOKEN_TYPE)


def decode_refresh_token(token: str) -> dict:
    return _decode_token(token, settings.refresh_secret_key, REFRESH_TOKEN_TYPE)


def _decode_token(token: str, secret: str, expected_type: str) -> dict:
    payload = jwt.decode(token, secret, algorithms=[settings.jwt_algorithm])
    token_type = payload.get("type")
    if token_type != expected_type:
        raise JWTError("invalid token type")
    return payload


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise credentials_exception

    user = db.get(User, user_id)
    if not user:
        raise credentials_exception
    return user


def require_role(*roles):
    def checker(user=Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user

    return checker
