from sqlalchemy.orm import Session

from ..models import Order, OrderItem, OrderStatus, Payout, PayoutStatus, Photo, PhotoStatus, WorkType


def recalc_payout_for_order(db: Session, order: Order):
    photos = (
        db.query(Photo, WorkType)
        .join(OrderItem, OrderItem.id == Photo.order_item_id)
        .join(WorkType, WorkType.id == Photo.work_type_id)
        .filter(
            OrderItem.order_id == order.id,
            Photo.workspace_id == order.workspace_id,
            WorkType.workspace_id == order.workspace_id,
        )
        .all()
    )
    preliminary = 0.0
    final = 0.0
    for photo, wt in photos:
        preliminary += float(wt.price_per_unit)
        if photo.status == PhotoStatus.accepted:
            final += float(wt.price_per_unit)

    payout = db.query(Payout).filter(Payout.order_id == order.id).first()
    if not payout:
        payout = Payout(workspace_id=order.workspace_id, order_id=order.id, promoter_id=order.promoter_id)
        db.add(payout)

    payout.amount_preliminary = preliminary
    payout.amount_final = final
    if order.status == OrderStatus.payment:
        payout.status = PayoutStatus.to_pay
    elif order.status == OrderStatus.completed:
        payout.status = PayoutStatus.paid
    else:
        payout.status = PayoutStatus.review
