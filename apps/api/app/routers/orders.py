from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_role
from ..database import get_db
from ..models import Address, Order, OrderItem, OrderItemWorkType, OrderStatus, Role
from ..schemas import OrderCreate, OrderStatusIn
from ..services.payouts import recalc_payout_for_order

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get('')
def list_orders(db: Session = Depends(get_db), user=Depends(get_current_user)):
    q = db.query(Order).filter(Order.workspace_id == user.workspace_id)
    if user.role == Role.promoter:
        q = q.filter(Order.promoter_id == user.id)
    orders = q.order_by(Order.id.desc()).all()
    result = []
    for o in orders:
        result.append({
            'id': o.id,
            'title': o.title,
            'status': o.status,
            'promoter_id': o.promoter_id,
            'deadline_at': o.deadline_at,
            'comment': o.comment,
        })
    return result


@router.post('')
def create_order(payload: OrderCreate, db: Session = Depends(get_db), user=Depends(require_role(Role.operator))):
    order = Order(
        workspace_id=user.workspace_id,
        created_by_id=user.id,
        promoter_id=payload.promoter_id,
        title=payload.title,
        comment=payload.comment,
        deadline_at=payload.deadline_at,
        status=payload.status,
    )
    db.add(order)
    db.flush()
    for item in payload.items:
        addr = db.get(Address, item.address_id)
        if not addr:
            raise HTTPException(status_code=404, detail='Address not found')
        oi = OrderItem(order_id=order.id, address_id=item.address_id, comment=item.comment)
        db.add(oi)
        db.flush()
        for wt_id in item.work_type_ids:
            db.add(OrderItemWorkType(order_item_id=oi.id, work_type_id=wt_id))
    db.commit()
    db.refresh(order)
    return {'id': order.id}


@router.get('/{order_id}')
def order_detail(order_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    order = db.get(Order, order_id)
    if not order or order.workspace_id != user.workspace_id:
        raise HTTPException(status_code=404, detail='Not found')
    if user.role == Role.promoter and order.promoter_id != user.id:
        raise HTTPException(status_code=403, detail='Forbidden')

    items = []
    for item in db.query(OrderItem).filter(OrderItem.order_id == order.id).all():
        work_type_ids = [x.work_type_id for x in db.query(OrderItemWorkType).filter(OrderItemWorkType.order_item_id == item.id).all()]
        items.append({'id': item.id, 'address_id': item.address_id, 'work_type_ids': work_type_ids, 'comment': item.comment})
    return {'id': order.id, 'title': order.title, 'status': order.status, 'items': items, 'promoter_id': order.promoter_id}


@router.patch('/{order_id}/status')
def set_status(order_id: int, payload: OrderStatusIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    order = db.get(Order, order_id)
    if not order or order.workspace_id != user.workspace_id:
        raise HTTPException(status_code=404, detail='Not found')
    if user.role == Role.promoter and order.promoter_id != user.id:
        raise HTTPException(status_code=403, detail='Forbidden')
    order.status = payload.status
    recalc_payout_for_order(db, order)
    db.commit()
    return {'ok': True, 'status': order.status}


@router.delete('/{order_id}', response_model=dict)
def delete_order(order_id: int, db: Session = Depends(get_db), user=Depends(require_role(Role.operator))):
    order = db.get(Order, order_id)
    if not order or order.workspace_id != user.workspace_id:
        raise HTTPException(status_code=404, detail='Not found')

    db.delete(order)
    db.commit()
    return {'ok': True}
