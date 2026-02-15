from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_role
from ..database import get_db
from ..guards import get_scoped_entity
from ..models import Address, Order, OrderItem, OrderItemWorkType, OrderStatus, Role, User, WorkType
from ..schemas import IdOut, OkOut, OrderCreate, OrderDetailOut, OrderItemOut, OrderOut, OrderStatusIn, OrderStatusOut
from ..services.payouts import recalc_payout_for_order

router = APIRouter(prefix="/orders", tags=["orders"])

ALLOWED_ORDER_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.draft: {OrderStatus.assigned},
    OrderStatus.assigned: {OrderStatus.in_progress, OrderStatus.draft},
    OrderStatus.in_progress: {OrderStatus.review, OrderStatus.assigned},
    OrderStatus.review: {OrderStatus.payment, OrderStatus.in_progress},
    OrderStatus.payment: {OrderStatus.completed, OrderStatus.review},
    OrderStatus.completed: set(),
}

PROMOTER_ALLOWED_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.assigned: {OrderStatus.in_progress},
    OrderStatus.in_progress: {OrderStatus.review},
}


@router.get('', response_model=list[OrderOut])
def list_orders(db: Session = Depends(get_db), user=Depends(get_current_user)):
    q = db.query(Order).filter(Order.workspace_id == user.workspace_id)
    if user.role == Role.promoter:
        q = q.filter(Order.promoter_id == user.id)
    return q.order_by(Order.id.desc()).all()


@router.post('', response_model=IdOut)
def create_order(payload: OrderCreate, db: Session = Depends(get_db), operator: User = Depends(require_role(Role.operator))):
    if payload.status not in {OrderStatus.draft, OrderStatus.assigned}:
        raise HTTPException(status_code=422, detail="new order can only start as Draft or Assigned")

    promoter = get_scoped_entity(db, User, payload.promoter_id, operator.workspace_id, "Promoter not found")
    if promoter.role != Role.promoter:
        raise HTTPException(status_code=422, detail="promoter_id must point to a promoter user")

    address_ids = sorted({item.address_id for item in payload.items})
    work_type_ids = sorted({work_type_id for item in payload.items for work_type_id in item.work_type_ids})

    addresses = db.query(Address).filter(Address.workspace_id == operator.workspace_id, Address.id.in_(address_ids)).all()
    if len(addresses) != len(address_ids):
        raise HTTPException(status_code=422, detail="one or more addresses do not belong to workspace")

    work_types = db.query(WorkType).filter(WorkType.workspace_id == operator.workspace_id, WorkType.id.in_(work_type_ids)).all()
    if len(work_types) != len(work_type_ids):
        raise HTTPException(status_code=422, detail="one or more work_types do not belong to workspace")

    order = Order(
        workspace_id=operator.workspace_id,
        created_by_id=operator.id,
        promoter_id=payload.promoter_id,
        title=payload.title,
        comment=payload.comment,
        deadline_at=payload.deadline_at,
        status=payload.status,
    )
    db.add(order)
    db.flush()

    for item in payload.items:
        order_item = OrderItem(order_id=order.id, address_id=item.address_id, comment=item.comment)
        db.add(order_item)
        db.flush()

        for wt_id in item.work_type_ids:
            db.add(OrderItemWorkType(order_item_id=order_item.id, work_type_id=wt_id))

    db.commit()
    db.refresh(order)
    return IdOut(id=order.id)


@router.get('/{order_id}', response_model=OrderDetailOut)
def order_detail(order_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    order = db.get(Order, order_id)
    if not order or order.workspace_id != user.workspace_id:
        raise HTTPException(status_code=404, detail='Not found')
    if user.role == Role.promoter and order.promoter_id != user.id:
        raise HTTPException(status_code=403, detail='Forbidden')

    items: list[OrderItemOut] = []
    for item in db.query(OrderItem).filter(OrderItem.order_id == order.id).all():
        work_type_ids = [x.work_type_id for x in db.query(OrderItemWorkType).filter(OrderItemWorkType.order_item_id == item.id).all()]
        items.append(OrderItemOut(id=item.id, address_id=item.address_id, work_type_ids=work_type_ids, comment=item.comment))

    return OrderDetailOut(id=order.id, title=order.title, status=order.status, items=items, promoter_id=order.promoter_id)


@router.patch('/{order_id}/status', response_model=OrderStatusOut)
def set_status(order_id: int, payload: OrderStatusIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    order = db.get(Order, order_id)
    if not order or order.workspace_id != user.workspace_id:
        raise HTTPException(status_code=404, detail='Not found')
    if user.role == Role.promoter and order.promoter_id != user.id:
        raise HTTPException(status_code=403, detail='Forbidden')

    if payload.status == order.status:
        return OrderStatusOut(ok=True, status=order.status)

    allowed_targets = ALLOWED_ORDER_TRANSITIONS.get(order.status, set())
    if payload.status not in allowed_targets:
        raise HTTPException(status_code=422, detail='invalid order status transition')

    if user.role == Role.promoter:
        promoter_targets = PROMOTER_ALLOWED_TRANSITIONS.get(order.status, set())
        if payload.status not in promoter_targets:
            raise HTTPException(status_code=403, detail='promoter cannot perform this transition')

    order.status = payload.status
    recalc_payout_for_order(db, order)
    db.commit()
    return OrderStatusOut(ok=True, status=order.status)


@router.delete('/{order_id}', response_model=OkOut)
def delete_order(order_id: int, db: Session = Depends(get_db), user=Depends(require_role(Role.operator))):
    order = db.get(Order, order_id)
    if not order or order.workspace_id != user.workspace_id:
        raise HTTPException(status_code=404, detail='Not found')

    db.delete(order)
    db.commit()
    return OkOut(ok=True)
