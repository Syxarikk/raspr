from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_role
from ..database import get_db
from ..models import Role, WorkType
from ..schemas import WorkTypeIn, WorkTypeOut

router = APIRouter(prefix="/work-types", tags=["work-types"])


@router.get('', response_model=list[WorkTypeOut])
def list_work_types(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(WorkType).filter(WorkType.workspace_id == user.workspace_id).all()


@router.post('', response_model=WorkTypeOut)
def create_work_type(payload: WorkTypeIn, db: Session = Depends(get_db), user=Depends(require_role(Role.operator))):
    wt = WorkType(workspace_id=user.workspace_id, **payload.model_dump())
    db.add(wt)
    db.commit()
    db.refresh(wt)
    return wt


@router.patch('/{work_type_id}', response_model=WorkTypeOut)
def update_work_type(work_type_id: int, payload: WorkTypeIn, db: Session = Depends(get_db), user=Depends(require_role(Role.operator))):
    work_type = db.get(WorkType, work_type_id)
    if not work_type or work_type.workspace_id != user.workspace_id:
        raise HTTPException(status_code=404, detail='Work type not found')

    for key, value in payload.model_dump().items():
        setattr(work_type, key, value)

    db.commit()
    db.refresh(work_type)
    return work_type


@router.delete('/{work_type_id}', response_model=dict)
def delete_work_type(work_type_id: int, db: Session = Depends(get_db), user=Depends(require_role(Role.operator))):
    work_type = db.get(WorkType, work_type_id)
    if not work_type or work_type.workspace_id != user.workspace_id:
        raise HTTPException(status_code=404, detail='Work type not found')

    db.delete(work_type)
    db.commit()
    return {'ok': True}
