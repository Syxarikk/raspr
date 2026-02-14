from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Payout, Role
from ..schemas import PayoutOut

router = APIRouter(prefix="/payouts", tags=["payouts"])


@router.get('', response_model=list[PayoutOut])
def list_payouts(db: Session = Depends(get_db), user=Depends(get_current_user)):
    q = db.query(Payout).filter(Payout.workspace_id == user.workspace_id)
    if user.role == Role.promoter:
        q = q.filter(Payout.promoter_id == user.id)
    return q.all()
