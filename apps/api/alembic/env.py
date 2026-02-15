import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.database import Base
from app import models  # noqa

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Use runtime DATABASE_URL when provided (compose/.env), so migrations
# always target the same DB credentials as the API process.
runtime_database_url = os.getenv("DATABASE_URL")
if runtime_database_url:
    config.set_main_option("sqlalchemy.url", runtime_database_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
