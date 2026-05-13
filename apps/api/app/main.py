from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, engine
from app.core.config import get_settings
from app.core.schema_maintenance import ensure_local_schema
from app.routers import admin, auth, avatar, billing, children, learning, me, quests, rankings
from app.seeds.seed import ensure_dev_owner
from sqlalchemy.orm import Session


def create_app() -> FastAPI:
    app = FastAPI(title="4-craft Adaptive Learning API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:3000", "http://localhost:3000"],
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
    app.include_router(admin.router)

    @app.on_event("startup")
    def create_tables() -> None:
        Base.metadata.create_all(bind=engine)
        ensure_local_schema(engine)
        if get_settings().environment.lower() in {"local", "dev", "development", "test"}:
            with Session(engine) as session:
                ensure_dev_owner(session)
                session.commit()

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok"}

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
