from fastapi import APIRouter, Depends
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
