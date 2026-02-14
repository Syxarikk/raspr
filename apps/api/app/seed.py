from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from .auth import get_password_hash
from .database import SessionLocal
from .models import Address, Order, OrderItem, OrderItemWorkType, OrderStatus, Role, User, WorkType, Workspace


def run_seed():
    db: Session = SessionLocal()
    if db.query(Workspace).count() > 0:
        db.close()
        return

    ws = Workspace(name='Demo Workspace')
    db.add(ws)
    db.flush()

    operator = User(workspace_id=ws.id, role=Role.operator, full_name='Operator Demo', username='operator', phone='+79990000001', password_hash=get_password_hash('1234'))
    promoter = User(workspace_id=ws.id, role=Role.promoter, full_name='Promoter Demo', username='promoter', phone='+79990000002', telegram_id=123456789, password_hash=get_password_hash('1234'))
    db.add_all([operator, promoter])
    db.flush()

    names = [('Листовки', 9), ('Хенгеры', 9), ('Наклейки', 9), ('Демонтаж', 9), ('Контроль', 12)]
    work_types = []
    for name, price in names:
        wt = WorkType(workspace_id=ws.id, name=name, price_per_unit=price)
        db.add(wt)
        work_types.append(wt)
    db.flush()

    streets = ['Пушкина', 'Ленина', 'Кирова', 'Чехова']
    addresses = []
    for i in range(20):
        a = Address(workspace_id=ws.id, district='Центральный', street=streets[i % len(streets)], building=str(10 + i), lat=55.4 + i*0.001, lng=37.5 + i*0.001)
        db.add(a)
        addresses.append(a)
    db.flush()

    for idx in range(2):
        order = Order(workspace_id=ws.id, created_by_id=operator.id, promoter_id=promoter.id, title=f'Наряд #{2000+idx}', status=OrderStatus.assigned if idx == 0 else OrderStatus.review, deadline_at=datetime.utcnow()+timedelta(days=2+idx))
        db.add(order)
        db.flush()
        for a in addresses[idx*5:(idx+1)*5]:
            item = OrderItem(order_id=order.id, address_id=a.id)
            db.add(item)
            db.flush()
            for wt in work_types[:4]:
                db.add(OrderItemWorkType(order_item_id=item.id, work_type_id=wt.id))

    db.commit()
    db.close()


if __name__ == '__main__':
    run_seed()
