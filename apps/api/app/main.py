from pathlib import Path
import mimetypes

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.database import Base, engine
from app.core.config import get_settings
from app.core.avatar_storage import ensure_avatar_dir
from app.core.schema_maintenance import ensure_local_schema
from app.routers import admin, auth, avatar, billing, children, learning, me, quests, rankings, share, site
from app.seeds.seed import ensure_dev_owner
from app.services.content_status import initialize_all_lesson_status
from app.routers import payment_integration
from app.routers import mpp_orders
from sqlalchemy.orm import Session


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="4-craft Adaptive Learning API", version="0.1.0")

    # Serve uploaded avatars at /storage/avatars. The directory has to be
    # the same one the upload endpoint writes to, otherwise every photo
    # 404s and the frontend falls back to the mascot.
    mimetypes.add_type("image/webp", ".webp")
    _avatar_dir = ensure_avatar_dir()
    app.mount("/storage/avatars", StaticFiles(directory=str(_avatar_dir)), name="avatars")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(auth.router)
    app.include_router(billing.router)
    app.include_router(me.router)
    app.include_router(children.router)
    app.include_router(learning.router)
    app.include_router(quests.router)
    app.include_router(rankings.router)
    app.include_router(avatar.router)
    app.include_router(share.router)
    app.include_router(site.router)
    app.include_router(admin.router)
    app.include_router(payment_integration.router)
    app.include_router(mpp_orders.router)

    @app.on_event("startup")
    def create_tables() -> None:
        if settings.environment.lower() in {'local', 'dev', 'development', 'test'}:
            Base.metadata.create_all(bind=engine)
            ensure_local_schema(engine)
        if settings.environment.lower() in {"local", "dev", "development", "test"}:
            with Session(engine) as session:
                ensure_dev_owner(session)
                session.commit()
        # Initialize content status sidecar for all existing JSON lessons
        initialize_all_lesson_status()

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok"}

    @app.get('/health/ready')
    def readiness() -> dict:
        from fastapi import HTTPException
        from sqlalchemy import text
        try:
            with engine.connect() as connection:
                connection.execute(text('SELECT membership_provider, mpp_access_ends_at FROM child_profiles LIMIT 0'))
                for table in ('mpp_package_prices', 'mpp_purchase_orders', 'mpp_purchase_events', 'billing_checkout_reservations'):
                    connection.execute(text('SELECT 1 FROM ' + table + ' LIMIT 0'))
        except Exception:
            raise HTTPException(503, {'code': 'DATABASE_SCHEMA_NOT_READY'}) from None
        return {'status': 'ready'}

    @app.get("/")
    def root() -> dict:
        return {
            "name": "4-craft Adaptive Learning API",
            "status": "ok",
            "docs": "/docs",
            "health": "/health",
        }

    return app


app = create_app()
