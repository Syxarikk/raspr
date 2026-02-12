from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_role
from ..database import get_db
from ..models import Role, User
from ..schemas import UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get('/me', response_model=UserOut)
def me(user=Depends(get_current_user)):
    return user


@router.get('/promoters', response_model=list[UserOut])
def promoters(db: Session = Depends(get_db), user=Depends(require_role(Role.operator))):
    return db.query(User).filter(User.workspace_id == user.workspace_id, User.role == Role.promoter).all()


@router.patch('/promoters/{user_id}/ready', response_model=UserOut)
def set_ready(user_id: int, payload: dict, db: Session = Depends(get_db), _: User = Depends(require_role(Role.operator))):
    promoter = db.get(User, user_id)
    promoter.is_ready = bool(payload.get('is_ready', True))
    promoter.suspicious_note = payload.get('suspicious_note')
    db.commit()
    db.refresh(promoter)
    return promoter
