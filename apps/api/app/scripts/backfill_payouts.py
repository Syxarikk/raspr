from __future__ import annotations

import argparse

from app.database import SessionLocal
from app.models import Order
from app.services.payouts import recalc_payout_for_order


def run_backfill(*, dry_run: bool, batch_size: int) -> int:
    processed = 0
    db = SessionLocal()
    try:
        query = db.query(Order).order_by(Order.id.asc()).yield_per(batch_size)
        for order in query:
            recalc_payout_for_order(db, order)
            processed += 1

            if not dry_run and processed % batch_size == 0:
                db.commit()

        if dry_run:
            db.rollback()
        else:
            db.commit()
    finally:
        db.close()

    return processed


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill payouts for all orders")
    parser.add_argument("--dry-run", action="store_true", help="Run recalculation without persisting changes")
    parser.add_argument("--batch-size", type=int, default=200, help="Commit interval for persistent mode")
    args = parser.parse_args()

    if args.batch_size < 1:
        raise SystemExit("batch-size must be >= 1")

    processed = run_backfill(dry_run=args.dry_run, batch_size=args.batch_size)
    mode = "dry-run" if args.dry_run else "apply"
    print(f"[{mode}] processed orders: {processed}")


if __name__ == "__main__":
    main()
