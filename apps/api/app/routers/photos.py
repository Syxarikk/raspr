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
from ..models import Order, OrderItem, Photo, PhotoStatus, Role
from ..schemas import PhotoReviewIn
from ..services.payouts import recalc_payout_for_order

router = APIRouter(prefix="/photos", tags=["photos"])
Path(settings.uploads_dir).mkdir(parents=True, exist_ok=True)


@router.post('/upload')
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
    if order.promoter_id != user.id:
        raise HTTPException(status_code=403, detail='forbidden')

    content = file.file.read()
    sha = hashlib.sha256(content).hexdigest()
    exists = db.query(Photo).filter(Photo.workspace_id == user.workspace_id, Photo.sha256_hash == sha).first()
    if exists:
        raise HTTPException(status_code=409, detail='duplicate file')

    ext = os.path.splitext(file.filename or '')[1] or '.jpg'
    name = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}_{sha[:8]}{ext}"
    rel_path = f"{user.workspace_id}/{name}"
    full_path = Path(settings.uploads_dir) / rel_path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_bytes(content)

    photo = Photo(
        workspace_id=user.workspace_id,
        order_item_id=order_item_id,
        work_type_id=work_type_id,
        uploader_id=user.id,
        file_path=rel_path,
        sha256_hash=sha,
        geo_lat=geo_lat,
        geo_lng=geo_lng,
    )
    db.add(photo)
    recalc_payout_for_order(db, order)
    db.commit()
    db.refresh(photo)
    return {'id': photo.id, 'uploaded_at': photo.uploaded_at}


@router.get('/order/{order_id}')
def photos_by_order(order_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    order = db.get(Order, order_id)
    if not order or order.workspace_id != user.workspace_id:
        raise HTTPException(status_code=404, detail='Not found')
    rows = db.query(Photo).join(OrderItem, Photo.order_item_id == OrderItem.id).filter(OrderItem.order_id == order_id).all()
    return [{'id': p.id, 'order_item_id': p.order_item_id, 'work_type_id': p.work_type_id, 'status': p.status, 'reject_reason': p.reject_reason, 'url': f'/photos/file/{p.id}'} for p in rows]


@router.patch('/{photo_id}/review')
def review_photo(photo_id: int, payload: PhotoReviewIn, db: Session = Depends(get_db), user=Depends(require_role(Role.operator))):
    photo = db.get(Photo, photo_id)
    if not photo or photo.workspace_id != user.workspace_id:
        raise HTTPException(status_code=404, detail='Not found')
    photo.status = PhotoStatus.accepted if payload.status == 'accepted' else PhotoStatus.rejected
    photo.reject_reason = payload.reject_reason
    item = db.get(OrderItem, photo.order_item_id)
    order = db.get(Order, item.order_id)
    recalc_payout_for_order(db, order)
    db.commit()
    return {'ok': True}


@router.get('/file/{photo_id}')
def file(photo_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    photo = db.get(Photo, photo_id)
    if not photo or photo.workspace_id != user.workspace_id:
        raise HTTPException(status_code=404, detail='Not found')
    return FileResponse(Path(settings.uploads_dir) / photo.file_path)
