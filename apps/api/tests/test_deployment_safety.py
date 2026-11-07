import importlib.util
from pathlib import Path
from sqlalchemy import create_engine, inspect
from alembic.migration import MigrationContext
from alembic.operations import Operations


def test_checkout_reservation_migration_is_additive_and_reversible():
    path = Path(__file__).parents[1] / 'alembic/versions/20261015_0004_checkout_reservations.py'
    spec = importlib.util.spec_from_file_location('checkout_migration', path)
    migration = importlib.util.module_from_spec(spec); spec.loader.exec_module(migration)
    temporary = create_engine('sqlite:///:memory:')
    with temporary.begin() as connection:
        connection.exec_driver_sql('CREATE TABLE users (id VARCHAR(36) PRIMARY KEY)')
        connection.exec_driver_sql("INSERT INTO users(id) VALUES ('preserved')")
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert 'billing_checkout_reservations' in inspect(connection).get_table_names()
            migration.downgrade()
            assert connection.exec_driver_sql('SELECT id FROM users').scalar_one() == 'preserved'


def test_production_startup_does_not_create_or_alter_schema(monkeypatch):
    from app import main
    from app.core.config import get_settings
    settings = get_settings()
    monkeypatch.setattr(settings, 'environment', 'production')
    def ddl_forbidden(*args, **kwargs):
        raise AssertionError('Production startup must not run DDL')
    monkeypatch.setattr(main.Base.metadata, 'create_all', ddl_forbidden)
    monkeypatch.setattr(main, 'ensure_local_schema', ddl_forbidden)
    monkeypatch.setattr(main, 'initialize_all_lesson_status', lambda: None)
    application = main.create_app()
    application.router.on_startup[0]()
