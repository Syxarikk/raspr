from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_role
from ..database import get_db
from ..guards import get_scoped_entity
from ..models import Role, User
from ..schemas import PromoterAvailabilityIn, UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get('/me', response_model=UserOut)
def me(user=Depends(get_current_user)):
    return user


@router.get('/promoters', response_model=list[UserOut])
def promoters(db: Session = Depends(get_db), user=Depends(require_role(Role.operator))):
    return db.query(User).filter(User.workspace_id == user.workspace_id, User.role == Role.promoter).all()


@router.patch('/promoters/{user_id}/availability', response_model=UserOut)
def set_availability(
    user_id: int,
    payload: PromoterAvailabilityIn,
    db: Session = Depends(get_db),
    operator: User = Depends(require_role(Role.operator)),
):
    promoter = get_scoped_entity(db, User, user_id, operator.workspace_id, "Promoter not found")
    if promoter.role != Role.promoter:
        raise HTTPException(status_code=404, detail="Promoter not found")

    promoter.is_ready = payload.is_ready
    promoter.suspicious_note = payload.suspicious_note
    db.commit()
    db.refresh(promoter)
    return promoter
