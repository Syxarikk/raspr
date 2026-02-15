from __future__ import annotations

import hashlib
import os
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_role
from ..config import settings
from ..database import get_db
from ..models import Order, OrderItem, OrderItemWorkType, Photo, PhotoStatus, Role, WorkType
from ..schemas import OkOut, PhotoOut, PhotoReviewIn, PhotoUploadOut
from ..services.payouts import recalc_payout_for_order

router = APIRouter(prefix="/photos", tags=["photos"])
UPLOAD_BASE = Path(settings.uploads_dir)
UPLOAD_BASE.mkdir(parents=True, exist_ok=True)


def _store_uploaded_file(file: UploadFile, workspace_id: int) -> tuple[str, str, datetime]:
    content_type = (file.content_type or "").lower()
    if content_type not in settings.allowed_upload_mime_types_list:
        raise HTTPException(status_code=415, detail="unsupported file type")

    max_size_bytes = settings.max_upload_size_mb * 1024 * 1024
    hasher = hashlib.sha256()
    now = datetime.utcnow()

    ext = os.path.splitext(file.filename or "")[1].lower()
    if not ext:
        ext = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
        }.get(content_type, ".bin")

    temp_name = f"tmp_{now.strftime('%Y%m%d%H%M%S%f')}_{os.getpid()}{ext}"
    temp_rel_path = f"{workspace_id}/{temp_name}"
    temp_full_path = UPLOAD_BASE / temp_rel_path
    temp_full_path.parent.mkdir(parents=True, exist_ok=True)

    size = 0
    with temp_full_path.open("wb") as target:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > max_size_bytes:
                target.close()
                temp_full_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="file is too large")
            hasher.update(chunk)
            target.write(chunk)

    if size == 0:
        temp_full_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="empty file")

    sha = hasher.hexdigest()
    final_name = f"{now.strftime('%Y%m%d%H%M%S%f')}_{sha[:8]}{ext}"
    rel_path = f"{workspace_id}/{final_name}"
    full_path = UPLOAD_BASE / rel_path
    temp_full_path.replace(full_path)

    return sha, rel_path, now


@router.post('', response_model=PhotoUploadOut)
def upload_photo(
    order_item_id: int = Form(...),
    work_type_id: int = Form(...),
    geo_lat: float | None = Form(None),
    geo_lng: float | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(require_role(Role.promoter)),
):
    item = db.get(OrderItem, order_item_id)
    if not item:
        raise HTTPException(status_code=404, detail='order item not found')

    order = db.get(Order, item.order_id)
    if not order or order.workspace_id != user.workspace_id:
        raise HTTPException(status_code=404, detail='order not found')
    if order.promoter_id != user.id:
        raise HTTPException(status_code=403, detail='forbidden')

    work_type = db.get(WorkType, work_type_id)
    if not work_type or work_type.workspace_id != user.workspace_id:
        raise HTTPException(status_code=422, detail='invalid work_type_id')

    order_item_work_type = (
        db.query(OrderItemWorkType)
        .filter(OrderItemWorkType.order_item_id == order_item_id, OrderItemWorkType.work_type_id == work_type_id)
        .first()
    )
    if not order_item_work_type:
        raise HTTPException(status_code=422, detail='work_type is not assigned to the order item')

    sha, rel_path, uploaded_at = _store_uploaded_file(file, user.workspace_id)

    exists = db.query(Photo).filter(Photo.workspace_id == user.workspace_id, Photo.sha256_hash == sha).first()
    if exists:
        (UPLOAD_BASE / rel_path).unlink(missing_ok=True)
        raise HTTPException(status_code=409, detail='duplicate file')

    photo = Photo(
        workspace_id=user.workspace_id,
        order_item_id=order_item_id,
        work_type_id=work_type_id,
        uploader_id=user.id,
        file_path=rel_path,
        sha256_hash=sha,
        geo_lat=geo_lat,
        geo_lng=geo_lng,
        uploaded_at=uploaded_at,
    )
    db.add(photo)
    recalc_payout_for_order(db, order)
    db.commit()
    db.refresh(photo)
    return PhotoUploadOut(id=photo.id, uploaded_at=photo.uploaded_at)


@router.get('/order/{order_id}', response_model=list[PhotoOut])
def photos_by_order(order_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    order = db.get(Order, order_id)
    if not order or order.workspace_id != user.workspace_id:
        raise HTTPException(status_code=404, detail='Not found')
    if user.role == Role.promoter and order.promoter_id != user.id:
        raise HTTPException(status_code=403, detail='Forbidden')

    rows = db.query(Photo).join(OrderItem, Photo.order_item_id == OrderItem.id).filter(OrderItem.order_id == order_id).all()
    return [
        PhotoOut(
            id=p.id,
            order_item_id=p.order_item_id,
            work_type_id=p.work_type_id,
            status=p.status.value,
            reject_reason=p.reject_reason,
            url=f'/api/v1/photos/file/{p.id}',
        )
        for p in rows
    ]


@router.patch('/{photo_id}/review', response_model=OkOut)
def review_photo(photo_id: int, payload: PhotoReviewIn, db: Session = Depends(get_db), user=Depends(require_role(Role.operator))):
    photo = db.get(Photo, photo_id)
    if not photo or photo.workspace_id != user.workspace_id:
        raise HTTPException(status_code=404, detail='Not found')

    photo.status = PhotoStatus.accepted if payload.status.value == 'accepted' else PhotoStatus.rejected
    photo.reject_reason = payload.reject_reason

    item = db.get(OrderItem, photo.order_item_id)
    order = db.get(Order, item.order_id)
    recalc_payout_for_order(db, order)
    db.commit()
    return OkOut(ok=True)


@router.get('/file/{photo_id}')
def file(photo_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    photo = db.get(Photo, photo_id)
    if not photo or photo.workspace_id != user.workspace_id:
        raise HTTPException(status_code=404, detail='Not found')

    base_dir = UPLOAD_BASE.resolve()
    requested = (UPLOAD_BASE / photo.file_path).resolve()
    if base_dir not in requested.parents and requested != base_dir:
        raise HTTPException(status_code=400, detail='Invalid file path')
    if not requested.exists():
        raise HTTPException(status_code=404, detail='File not found')

    return FileResponse(requested)
