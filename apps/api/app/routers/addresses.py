import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_role
from ..config import settings
from ..database import get_db
from ..models import Address, Role
from ..schemas import AddressIn, AddressOut, CsvImportOut, OkOut

router = APIRouter(prefix="/addresses", tags=["addresses"])


@router.get('', response_model=list[AddressOut])
def list_addresses(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Address).filter(Address.workspace_id == user.workspace_id).all()


@router.post('', response_model=AddressOut)
def create_address(payload: AddressIn, db: Session = Depends(get_db), user=Depends(require_role(Role.operator))):
    item = Address(workspace_id=user.workspace_id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def _read_csv_payload(file: UploadFile) -> str:
    content_type = (file.content_type or "").lower()
    allowed_mime_types = settings.allowed_csv_upload_mime_types_list
    if content_type and content_type not in allowed_mime_types:
        raise HTTPException(status_code=415, detail="unsupported csv mime type")

    max_size_bytes = settings.max_csv_upload_size_mb * 1024 * 1024
    size = 0
    payload = bytearray()
    while True:
        chunk = file.file.read(1024 * 1024)
        if not chunk:
            break
        size += len(chunk)
        if size > max_size_bytes:
            raise HTTPException(status_code=413, detail="csv file is too large")
        payload.extend(chunk)

    if not payload:
        raise HTTPException(status_code=400, detail="empty csv file")

    try:
        return payload.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=422, detail="csv must be utf-8 encoded") from exc


@router.post('/import-csv', response_model=CsvImportOut)
def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db), user=Depends(require_role(Role.operator))):
    content = _read_csv_payload(file)
    reader = csv.DictReader(io.StringIO(content))
    required_columns = {"street", "building"}
    fieldnames = set(reader.fieldnames or [])
    missing_columns = sorted(required_columns - fieldnames)
    if missing_columns:
        raise HTTPException(status_code=422, detail=f"csv missing columns: {', '.join(missing_columns)}")

    count = 0
    for line_no, row in enumerate(reader, start=2):
        street = (row.get('street') or '').strip()
        building = (row.get('building') or '').strip()
        if not street or not building:
            raise HTTPException(status_code=422, detail=f"line {line_no}: street and building are required")

        lat_raw = (row.get('lat') or '').strip()
        lng_raw = (row.get('lng') or '').strip()
        try:
            lat = float(lat_raw) if lat_raw else None
            lng = float(lng_raw) if lng_raw else None
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"line {line_no}: invalid lat/lng") from exc

        district_raw = (row.get('district') or '').strip()
        comment_raw = (row.get('comment') or '').strip()

        db.add(
            Address(
                workspace_id=user.workspace_id,
                district=district_raw or None,
                street=street,
                building=building,
                lat=lat,
                lng=lng,
                comment=comment_raw or None,
            )
        )
        count += 1
    db.commit()
    return CsvImportOut(imported=count)


@router.patch('/{address_id}', response_model=AddressOut)
def update_address(address_id: int, payload: AddressIn, db: Session = Depends(get_db), user=Depends(require_role(Role.operator))):
    address = db.get(Address, address_id)
    if not address or address.workspace_id != user.workspace_id:
        raise HTTPException(status_code=404, detail='Address not found')

    for key, value in payload.model_dump().items():
        setattr(address, key, value)

    db.commit()
    db.refresh(address)
    return address


@router.delete('/{address_id}', response_model=OkOut)
def delete_address(address_id: int, db: Session = Depends(get_db), user=Depends(require_role(Role.operator))):
    address = db.get(Address, address_id)
    if not address or address.workspace_id != user.workspace_id:
        raise HTTPException(status_code=404, detail='Address not found')

    db.delete(address)
    db.commit()
    return OkOut(ok=True)
