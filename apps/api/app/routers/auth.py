from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from jose import JWTError
from sqlalchemy.orm import Session

from ..auth import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    verify_password,
)
from ..config import settings
from ..database import get_db
from ..models import RefreshSession, User
from ..schemas import AuthOut, LoginIn, LogoutIn, OkOut, RefreshIn, TelegramLoginIn, TokenOut, UserOut
from ..services.telegram_auth import validate_and_extract_telegram_user_id

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=refresh_token,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=settings.refresh_cookie_name, path="/")


def _build_auth_response(user: User, access_token: str, refresh_token: str) -> AuthOut:
    return AuthOut(
        tokens=TokenOut(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.access_token_expire_minutes * 60,
        ),
        user=UserOut.model_validate(user),
    )


def _issue_tokens(db: Session, user: User) -> tuple[str, str]:
    access_token, _ = create_access_token(user.id)
    refresh_token, token_id, refresh_expires_at = create_refresh_token(user.id)

    db.add(RefreshSession(user_id=user.id, token_id=token_id, expires_at=refresh_expires_at))
    db.commit()

    return access_token, refresh_token


def _resolve_refresh_token(payload_token: str | None, request: Request) -> str:
    token = payload_token or request.cookies.get(settings.refresh_cookie_name)
    if not token:
        raise HTTPException(status_code=401, detail="refresh token is required")
    return token


def _revoke_refresh_session(db: Session, token: str) -> None:
    try:
        token_payload = decode_refresh_token(token)
        token_id = token_payload.get("jti")
        user_id = int(token_payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        return

    if not token_id:
        return

    session = (
        db.query(RefreshSession)
        .filter(RefreshSession.user_id == user_id, RefreshSession.token_id == token_id, RefreshSession.revoked_at.is_(None))
        .first()
    )
    if session:
        session.revoked_at = datetime.utcnow()
        db.commit()


@router.post("/login", response_model=AuthOut)
def login(payload: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token, refresh_token = _issue_tokens(db, user)
    _set_refresh_cookie(response, refresh_token)
    return _build_auth_response(user, access_token, refresh_token)


@router.post("/telegram", response_model=AuthOut)
def telegram_login(payload: TelegramLoginIn, response: Response, db: Session = Depends(get_db)):
    telegram_user_id = validate_and_extract_telegram_user_id(payload.init_data)
    user = db.query(User).filter(User.telegram_id == telegram_user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Unknown telegram user")

    access_token, refresh_token = _issue_tokens(db, user)
    _set_refresh_cookie(response, refresh_token)
    return _build_auth_response(user, access_token, refresh_token)


@router.post("/refresh", response_model=AuthOut)
def refresh(payload: RefreshIn, request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_token = _resolve_refresh_token(payload.refresh_token, request)

    try:
        refresh_payload = decode_refresh_token(refresh_token)
        user_id = int(refresh_payload.get("sub"))
        token_id = refresh_payload.get("jti")
    except (JWTError, TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if not token_id:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    refresh_session = (
        db.query(RefreshSession)
        .filter(RefreshSession.user_id == user_id, RefreshSession.token_id == token_id, RefreshSession.revoked_at.is_(None))
        .first()
    )
    if not refresh_session or refresh_session.expires_at < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Refresh session is expired")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    refresh_session.revoked_at = datetime.utcnow()
    db.commit()

    access_token, new_refresh_token = _issue_tokens(db, user)
    _set_refresh_cookie(response, new_refresh_token)
    return _build_auth_response(user, access_token, new_refresh_token)


@router.post("/logout", response_model=OkOut)
def logout(payload: LogoutIn, request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_token = request.cookies.get(settings.refresh_cookie_name) or payload.refresh_token
    if refresh_token:
        _revoke_refresh_session(db, refresh_token)
    _clear_refresh_cookie(response)
    return OkOut(ok=True)
