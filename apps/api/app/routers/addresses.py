import csv
import io
from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_role
from ..database import get_db
from ..models import Address, Role
from ..schemas import AddressIn, AddressOut

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


@router.post('/import-csv', response_model=dict)
def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db), user=Depends(require_role(Role.operator))):
    content = file.file.read().decode('utf-8')
    reader = csv.DictReader(io.StringIO(content))
    count = 0
    for row in reader:
        db.add(Address(
            workspace_id=user.workspace_id,
            district=row.get('district'),
            street=row.get('street', ''),
            building=row.get('building', ''),
            lat=float(row['lat']) if row.get('lat') else None,
            lng=float(row['lng']) if row.get('lng') else None,
            comment=row.get('comment')
        ))
        count += 1
    db.commit()
    return {'imported': count}
