"""Tests for the admin-managed site announcements feature.

Announcements live in Postgres (not in the baked homepage.json) and are merged
into the public homepage payload at request time.
"""

import json
import os
from datetime import UTC, datetime, timedelta

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SMTP_HOST"] = ""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import Base, engine
from app.main import app
from app.models import SiteAnnouncement, User
from app.services import homepage_content
from app.services.homepage_content import (
    DEFAULT_ANNOUNCEMENTS_SUBTITLE,
    DEFAULT_ANNOUNCEMENTS_TITLE,
    REQUIRED_TOP_LEVEL_KEYS,
    load_homepage_config,
    validate_homepage_config,
)

PUBLIC_ITEM_KEYS = {"id", "title", "body", "link_url", "published_at"}
ADMIN_ITEM_KEYS = {
    "id",
    "title",
    "body",
    "link_url",
    "published",
    "sort_order",
    "published_at",
    "created_at",
    "updated_at",
}


@pytest.fixture()
def client() -> TestClient:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as test_client:
        yield test_client


def _headers(client: TestClient, email: str, *, role: str = "admin") -> dict[str, str]:
    register = client.post("/auth/register", json={"email": email, "password": "password123"})
    assert register.status_code == 200
    headers = {"Authorization": f"Bearer {register.json()['access_token']}"}
    if role != "parent":
        with Session(engine) as session:
            user = session.scalar(select(User).where(User.email == email))
            assert user is not None
            user.role = role
            session.commit()
    return headers


def _admin_headers(client: TestClient, email: str = "announcement-admin@example.com") -> dict[str, str]:
    return _headers(client, email, role="admin")


def _parent_headers(client: TestClient, email: str = "announcement-parent@example.com") -> dict[str, str]:
    return _headers(client, email, role="parent")


def _seed_announcement(
    *,
    title: str,
    body: str = "",
    link_url: str | None = None,
    published: bool = True,
    sort_order: int = 0,
    published_at: datetime | None = None,
    created_at: datetime | None = None,
) -> SiteAnnouncement:
    with Session(engine) as session:
        row = SiteAnnouncement(
            title=title,
            body=body,
            link_url=link_url,
            published=published,
            sort_order=sort_order,
            published_at=published_at if published_at is not None else (datetime.now(UTC) if published else None),
            **({"created_at": created_at} if created_at is not None else {}),
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return row


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------


def test_public_announcements_returns_only_published_rows(client: TestClient) -> None:
    _seed_announcement(title="Published news", body="hello", published=True)
    _seed_announcement(title="Draft news", body="secret", published=False)

    response = client.get("/site/announcements")

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == {"items"}
    assert [item["title"] for item in payload["items"]] == ["Published news"]


def test_public_announcement_item_shape_is_exact(client: TestClient) -> None:
    _seed_announcement(title="Shape", body="body text", link_url="/news/1", published=True)

    item = client.get("/site/announcements").json()["items"][0]

    assert set(item) == PUBLIC_ITEM_KEYS
    assert item["id"]
    assert item["title"] == "Shape"
    assert item["body"] == "body text"
    assert item["link_url"] == "/news/1"
    assert item["published_at"]


def test_public_announcements_are_limited_to_20(client: TestClient) -> None:
    for index in range(25):
        _seed_announcement(title=f"News {index:02d}", published=True, sort_order=index)

    items = client.get("/site/announcements").json()["items"]

    assert len(items) == 20
    assert items[0]["title"] == "News 00"


def test_public_announcements_order_by_sort_order_then_published_at_then_created_at(client: TestClient) -> None:
    now = datetime.now(UTC)
    _seed_announcement(
        title="B newer",
        published=True,
        sort_order=1,
        published_at=now - timedelta(days=1),
        created_at=now - timedelta(days=3),
    )
    _seed_announcement(
        title="A older",
        published=True,
        sort_order=1,
        published_at=now - timedelta(days=5),
        created_at=now - timedelta(days=1),
    )
    _seed_announcement(
        title="C same date later",
        published=True,
        sort_order=1,
        published_at=now - timedelta(days=1),
        created_at=now - timedelta(days=2),
    )
    _seed_announcement(title="Z sort 0", published=True, sort_order=0, published_at=now)

    titles = [item["title"] for item in client.get("/site/announcements").json()["items"]]

    assert titles[0] == "Z sort 0"
    assert set(titles[1:]) == {"A older", "B newer", "C same date later"}
    # Same published_at -> newest created_at first.
    assert titles[1] == "C same date later"
    assert titles[2] == "B newer"
    assert titles[3] == "A older"


def test_public_announcements_endpoint_survives_a_missing_migration(client: TestClient) -> None:
    SiteAnnouncement.__table__.drop(bind=engine)
    try:
        response = client.get("/site/announcements")
        homepage = client.get("/site/homepage")

        assert response.status_code == 200
        assert response.json() == {"items": []}
        assert homepage.status_code == 200
        assert homepage.json()["announcements"]["items"] == []
    finally:
        Base.metadata.create_all(bind=engine, tables=[SiteAnnouncement.__table__])


# ---------------------------------------------------------------------------
# Homepage merge
# ---------------------------------------------------------------------------


def test_homepage_contains_announcements_section_with_defaults(client: TestClient) -> None:
    _seed_announcement(title="Homepage news", body="details", published=True)

    response = client.get("/site/homepage")

    assert response.status_code == 200
    section = response.json()["announcements"]
    assert section["title"] == DEFAULT_ANNOUNCEMENTS_TITLE
    assert section["subtitle"] == DEFAULT_ANNOUNCEMENTS_SUBTITLE
    assert [item["title"] for item in section["items"]] == ["Homepage news"]
    assert set(section["items"][0]) == PUBLIC_ITEM_KEYS


def test_homepage_announcements_section_uses_json_title_and_subtitle(client: TestClient, tmp_path, monkeypatch) -> None:
    config = load_homepage_config()
    config["announcements"] = {"title": "ประกาศจากทีมงาน", "subtitle": "อัปเดตล่าสุด"}
    config_path = tmp_path / "homepage.json"
    config_path.write_text(json.dumps(config, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setattr(homepage_content, "HOMEPAGE_PATH", config_path)

    section = client.get("/site/homepage").json()["announcements"]

    assert section["title"] == "ประกาศจากทีมงาน"
    assert section["subtitle"] == "อัปเดตล่าสุด"


def test_homepage_keeps_every_existing_section_working(client: TestClient) -> None:
    payload = client.get("/site/homepage").json()

    for key in REQUIRED_TOP_LEVEL_KEYS:
        assert key in payload
    assert payload["hero"]["headline"]
    assert payload["published_at"]


def test_homepage_json_keeps_announcements_optional() -> None:
    assert "announcements" not in REQUIRED_TOP_LEVEL_KEYS

    payload = load_homepage_config()
    assert "announcements" not in payload
    assert validate_homepage_config(payload) is payload


def test_homepage_json_accepts_an_optional_announcements_section() -> None:
    payload = load_homepage_config()
    payload["announcements"] = {"title": "T", "subtitle": "S", "items": [{"title": "x"}]}

    assert validate_homepage_config(payload) is payload


def test_save_homepage_config_does_not_persist_announcement_items(client: TestClient, tmp_path, monkeypatch) -> None:
    config = load_homepage_config()
    config_path = tmp_path / "homepage.json"
    backup_dir = tmp_path / "_backups"
    monkeypatch.setattr(homepage_content, "HOMEPAGE_PATH", config_path)
    monkeypatch.setattr(homepage_content, "BACKUP_DIR", backup_dir)

    config["announcements"] = {"title": "T", "subtitle": "S", "items": [{"title": "x"}]}
    saved = homepage_content.save_homepage_config(config)

    written = json.loads(config_path.read_text(encoding="utf-8"))
    assert written["announcements"] == {"title": "T", "subtitle": "S"}
    assert saved["config"]["announcements"] == {"title": "T", "subtitle": "S"}


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------


def test_admin_create_announcement_returns_201_and_full_row(client: TestClient) -> None:
    headers = _admin_headers(client)

    response = client.post(
        "/admin/site/announcements",
        headers=headers,
        json={"title": "ปิดเทอมปีใหม่", "body": "เริ่ม 1 ม.ค.", "link_url": "/news/term", "sort_order": 3},
    )

    assert response.status_code == 201
    item = response.json()["item"]
    assert set(item) == ADMIN_ITEM_KEYS
    assert item["id"]
    assert item["title"] == "ปิดเทอมปีใหม่"
    assert item["body"] == "เริ่ม 1 ม.ค."
    assert item["link_url"] == "/news/term"
    assert item["sort_order"] == 3
    assert item["published"] is False
    assert item["published_at"] is None
    assert item["created_at"]
    assert item["updated_at"]

    with Session(engine) as session:
        stored = session.get(SiteAnnouncement, item["id"])
        assert stored is not None
        assert stored.title == "ปิดเทอมปีใหม่"


def test_admin_create_published_announcement_sets_published_at(client: TestClient) -> None:
    headers = _admin_headers(client)

    response = client.post(
        "/admin/site/announcements",
        headers=headers,
        json={"title": "Live now", "published": True},
    )

    assert response.status_code == 201
    item = response.json()["item"]
    assert item["published"] is True
    assert item["published_at"] is not None
    assert client.get("/site/announcements").json()["items"][0]["title"] == "Live now"


def test_admin_create_announcement_without_title_returns_422(client: TestClient) -> None:
    headers = _admin_headers(client)

    response = client.post("/admin/site/announcements", headers=headers, json={"body": "no title"})

    assert response.status_code == 422


def test_admin_create_announcement_with_blank_title_returns_422(client: TestClient) -> None:
    headers = _admin_headers(client)

    response = client.post("/admin/site/announcements", headers=headers, json={"title": "   "})

    assert response.status_code == 422


def test_admin_create_announcement_with_unsafe_link_returns_422(client: TestClient) -> None:
    headers = _admin_headers(client)

    response = client.post(
        "/admin/site/announcements",
        headers=headers,
        json={"title": "Bad link", "link_url": "javascript:alert(1)"},
    )

    assert response.status_code == 422


def test_admin_list_returns_published_and_unpublished_rows(client: TestClient) -> None:
    headers = _admin_headers(client)
    client.post("/admin/site/announcements", headers=headers, json={"title": "Draft"})
    client.post("/admin/site/announcements", headers=headers, json={"title": "Live", "published": True})

    response = client.get("/admin/site/announcements", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == {"items"}
    assert {item["title"] for item in payload["items"]} == {"Draft", "Live"}
    for item in payload["items"]:
        assert set(item) == ADMIN_ITEM_KEYS


def test_admin_patch_updates_only_the_given_fields(client: TestClient) -> None:
    headers = _admin_headers(client)
    created = client.post(
        "/admin/site/announcements",
        headers=headers,
        json={"title": "Before", "body": "old body", "sort_order": 1},
    ).json()["item"]

    response = client.patch(
        f"/admin/site/announcements/{created['id']}",
        headers=headers,
        json={"title": "After", "published": True},
    )

    assert response.status_code == 200
    item = response.json()["item"]
    assert set(item) == ADMIN_ITEM_KEYS
    assert item["title"] == "After"
    assert item["published"] is True
    assert item["published_at"] is not None
    # Untouched fields keep their previous value.
    assert item["body"] == "old body"
    assert item["sort_order"] == 1


def test_admin_patch_unknown_announcement_returns_404(client: TestClient) -> None:
    headers = _admin_headers(client)

    response = client.patch(
        "/admin/site/announcements/does-not-exist",
        headers=headers,
        json={"title": "Nope"},
    )

    assert response.status_code == 404


def test_admin_delete_removes_the_announcement(client: TestClient) -> None:
    headers = _admin_headers(client)
    created = client.post(
        "/admin/site/announcements",
        headers=headers,
        json={"title": "Temporary", "published": True},
    ).json()["item"]
    assert client.get("/site/announcements").json()["items"]

    response = client.delete(f"/admin/site/announcements/{created['id']}", headers=headers)

    assert response.status_code == 200
    assert response.json() == {"deleted": True}
    assert client.get("/site/announcements").json()["items"] == []
    with Session(engine) as session:
        assert session.get(SiteAnnouncement, created["id"]) is None


def test_admin_delete_unknown_announcement_returns_404(client: TestClient) -> None:
    headers = _admin_headers(client)

    response = client.delete("/admin/site/announcements/does-not-exist", headers=headers)

    assert response.status_code == 404


def test_admin_announcement_endpoints_require_admin_role(client: TestClient) -> None:
    parent_headers = _parent_headers(client)

    assert client.get("/admin/site/announcements", headers=parent_headers).status_code == 403
    assert client.post("/admin/site/announcements", headers=parent_headers, json={"title": "x"}).status_code == 403
    assert client.patch("/admin/site/announcements/abc", headers=parent_headers, json={"title": "x"}).status_code == 403
    assert client.delete("/admin/site/announcements/abc", headers=parent_headers).status_code == 403


def test_admin_announcement_endpoints_require_authentication(client: TestClient) -> None:
    assert client.get("/admin/site/announcements").status_code == 401
    assert client.post("/admin/site/announcements", json={"title": "x"}).status_code == 401
    assert client.patch("/admin/site/announcements/abc", json={"title": "x"}).status_code == 401
    assert client.delete("/admin/site/announcements/abc").status_code == 401


def test_admin_edits_survive_a_homepage_json_reload(client: TestClient) -> None:
    """The announcements live in the database, not in the baked JSON file."""
    headers = _admin_headers(client)
    client.post(
        "/admin/site/announcements",
        headers=headers,
        json={"title": "Durable news", "body": "kept", "published": True},
    )

    # Simulate a fresh container: the homepage JSON is re-read from disk.
    reloaded = client.get("/site/homepage").json()

    assert reloaded["announcements"]["items"][0]["title"] == "Durable news"
    assert "announcements" not in load_homepage_config()
