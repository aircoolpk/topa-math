from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import get_settings
from app.core.database import Base
from app.models import entities  # noqa: F401
from app.models import payment_integration  # noqa: F401
from app.models import mpp_purchase  # noqa: F401
from app.models import checkout_reservation  # noqa: F401
from app.models import site_announcement  # noqa: F401

config = context.config
# Migrations must not run through a transaction pooler, so the direct
# (non-pooled) connection string is preferred when one is configured.
_settings = get_settings()
_migration_url = _settings.database_url_direct or _settings.database_url
config.set_main_option("sqlalchemy.url", _migration_url.replace("%", "%%"))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=_migration_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
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
