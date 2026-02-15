from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


url = make_url(settings.database_url)
connect_args: dict[str, bool] = {}
if url.get_backend_name().startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(settings.database_url, future=True, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
