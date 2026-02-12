from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import require_role
from ..database import get_db
from ..models import Payout, Role
from ..schemas import PayoutOut

router = APIRouter(prefix="/payouts", tags=["payouts"])


@router.get('', response_model=list[PayoutOut])
def list_payouts(db: Session = Depends(get_db), user=Depends(require_role(Role.promoter))):
    return db.query(Payout).filter(Payout.workspace_id == user.workspace_id, Payout.promoter_id == user.id).all()
